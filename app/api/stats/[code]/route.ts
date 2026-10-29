import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { browserFromUserAgent } from "@/lib/analytics";
import { getCached, setCached } from "@/lib/data-cache";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/url";
import type { StatsRange } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES = {
  "24h": { buckets: 24, step: "1 hour" },
  "7d": { buckets: 7, step: "1 day" },
  "30d": { buckets: 30, step: "1 day" },
} as const;

type LinkRow = {
  id: string;
  code: string;
  url: string;
  created_at: Date;
  expires_at: Date | null;
};

type TotalsRow = {
  total: number;
  unique_visitors: number;
  last_24h: number;
};

type SeriesRow = { bucket: Date; clicks: number };
type ReferrerRow = { name: string; clicks: number };
type DeviceRow = { name: string; clicks: number };
type RecentRow = {
  clicked_at: Date;
  device: string;
  user_agent: string | null;
  referrer: string;
};

function parseRange(value: string | null): StatsRange {
  if (value === "24h" || value === "30d") return value;
  return "7d";
}

function windowFor(range: StatsRange) {
  const now = new Date();

  if (range === "24h") {
    const end = new Date(now);
    end.setUTCMinutes(0, 0, 0);
    const start = new Date(end.getTime() - 23 * 3_600_000);
    return { start, end };
  }

  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - (RANGES[range].buckets - 1) * 86_400_000);
  return { start, end };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError(401, "unauthorized", "Sign in to view analytics.");
  }

  const { code } = await params;
  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const { start, end } = windowFor(range);
  const origin = publicOrigin(req);
  const cacheKey = `stats:${user.id}:${code}:${range}:${origin}`;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  if (!fresh) {
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "cache-control": "no-store", "x-data-cache": "hit" },
      });
    }
  }

  try {
    const linkResult = await db<LinkRow>(
      `select id, code, url, created_at, expires_at
       from links
       where code = $1 and user_id = $2`,
      [code, user.id]
    );

    const link = linkResult.rows[0];
    if (!link) {
      return apiError(404, "not_found", "Link not found.");
    }

    const linkId = link.id;
    const rangeStart = start.toISOString();

    const [totalsResult, rangeTotalResult, seriesResult, referrersResult, devicesResult, recentResult] =
      await Promise.all([
        db<TotalsRow>(
          `select count(*)::int as total,
                  count(distinct visitor_hash)::int as unique_visitors,
                  count(*) filter (where clicked_at >= now() - interval '24 hours')::int as last_24h
           from clicks
           where link_id = $1`,
          [linkId]
        ),
        db<{ range_total: number }>(
          `select count(*)::int as range_total
           from clicks
           where link_id = $1 and clicked_at >= $2`,
          [linkId, rangeStart]
        ),
        db<SeriesRow>(
          `select series.bucket,
                  count(c.id)::int as clicks
           from generate_series($1::timestamptz, $2::timestamptz, $3::interval) as series(bucket)
           left join clicks c
             on c.link_id = $4
            and c.clicked_at >= series.bucket
            and c.clicked_at < series.bucket + $3::interval
           group by series.bucket
           order by series.bucket`,
          [rangeStart, end.toISOString(), RANGES[range].step, linkId]
        ),
        db<ReferrerRow>(
          `select coalesce(nullif(referrer, ''), 'Direct') as name,
                  count(*)::int as clicks
           from clicks
           where link_id = $1 and clicked_at >= $2
           group by 1
           order by clicks desc, name asc
           limit 5`,
          [linkId, rangeStart]
        ),
        db<DeviceRow>(
          `select device as name,
                  count(*)::int as clicks
           from clicks
           where link_id = $1 and clicked_at >= $2
           group by device
           order by clicks desc`,
          [linkId, rangeStart]
        ),
        db<RecentRow>(
          `select clicked_at,
                  device,
                  user_agent,
                  coalesce(nullif(referrer, ''), 'Direct') as referrer
           from clicks
           where link_id = $1
           order by clicked_at desc
           limit 20`,
          [linkId]
        ),
      ]);

    const totals = totalsResult.rows[0] ?? {
      total: 0,
      unique_visitors: 0,
      last_24h: 0,
    };

    const payload = {
      link: {
        code: link.code,
        url: link.url,
        shortUrl: `${origin}/r/${link.code}`,
        createdAt: link.created_at.toISOString(),
        expiresAt: link.expires_at ? link.expires_at.toISOString() : null,
      },
      total: totals.total,
      unique: totals.unique_visitors,
      last24h: totals.last_24h,
      range,
      rangeTotal: rangeTotalResult.rows[0]?.range_total ?? 0,
      series: seriesResult.rows.map((row) => ({
        bucket: row.bucket.toISOString(),
        clicks: row.clicks,
      })),
      referrers: referrersResult.rows,
      devices: devicesResult.rows,
      recent: recentResult.rows.map((row) => ({
        clickedAt: row.clicked_at.toISOString(),
        device: row.device,
        browser: browserFromUserAgent(row.user_agent),
        referrer: row.referrer,
      })),
    };

    setCached(cacheKey, payload, 3_000);

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store", "x-data-cache": "miss" },
    });
  } catch (error) {
    console.error("Could not load stats:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not load analytics. Please try again.");
  }
}
