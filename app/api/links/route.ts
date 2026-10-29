import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getCached, setCached } from "@/lib/data-cache";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkRow = {
  code: string;
  url: string;
  created_at: Date;
  expires_at: Date | null;
  total_clicks: number;
  unique_clicks: number;
};

type SummaryRow = {
  link_count: number;
  total_clicks: number;
  unique_visitors: number;
  last_24h: number;
};

type Payload = {
  links: Array<{
    code: string;
    url: string;
    shortUrl: string;
    createdAt: string;
    expiresAt: string | null;
    totalClicks: number;
    uniqueClicks: number;
  }>;
  summary: {
    linkCount: number;
    totalClicks: number;
    uniqueVisitors: number;
    last24h: number;
  };
};

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return apiError(401, "unauthorized", "Sign in to view your links.");
  }

  const origin = publicOrigin(req);
  const cacheKey = `links:${user.id}:${origin}`;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  if (!fresh) {
    const cached = getCached<Payload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "cache-control": "no-store", "x-data-cache": "hit" },
      });
    }
  }

  try {
    const [linksResult, summaryResult] = await Promise.all([
      db<LinkRow>(
        `select l.code,
                l.url,
                l.created_at,
                l.expires_at,
                count(c.id)::int as total_clicks,
                count(distinct c.visitor_hash)::int as unique_clicks
         from links l
         left join clicks c on c.link_id = l.id
         where l.user_id = $1
         group by l.id
         order by l.created_at desc
         limit 100`,
        [user.id]
      ),
      db<SummaryRow>(
        `select count(distinct l.id)::int as link_count,
                count(c.id)::int as total_clicks,
                count(distinct c.visitor_hash)::int as unique_visitors,
                count(c.id) filter (where c.clicked_at >= now() - interval '24 hours')::int as last_24h
         from links l
         left join clicks c on c.link_id = l.id
         where l.user_id = $1`,
        [user.id]
      ),
    ]);

    const summary = summaryResult.rows[0] ?? {
      link_count: 0,
      total_clicks: 0,
      unique_visitors: 0,
      last_24h: 0,
    };

    const payload: Payload = {
      links: linksResult.rows.map((row) => ({
        code: row.code,
        url: row.url,
        shortUrl: `${origin}/r/${row.code}`,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
        totalClicks: row.total_clicks,
        uniqueClicks: row.unique_clicks,
      })),
      summary: {
        linkCount: summary.link_count,
        totalClicks: summary.total_clicks,
        uniqueVisitors: summary.unique_visitors,
        last24h: summary.last_24h,
      },
    };

    setCached(cacheKey, payload, 5_000);

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store", "x-data-cache": "miss" },
    });
  } catch (error) {
    console.error("Could not list links:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not load your links. Please try again.");
  }
}
