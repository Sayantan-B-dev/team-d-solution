import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { browserFromUserAgent } from "@/lib/analytics";
import { getCached, setCached } from "@/lib/data-cache";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TotalsRow = {
  users: number;
  admins: number;
  links: number;
  clicks: number;
  unique_visitors: number;
  last_24h: number;
};

type SeriesRow = { bucket: Date; clicks: number };

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: Date;
  link_count: number;
  click_count: number;
  last_click: Date | null;
};

type LinkRow = {
  code: string;
  url: string;
  created_at: Date;
  expires_at: Date | null;
  owner_email: string;
  owner_name: string | null;
  total_clicks: number;
  unique_clicks: number;
};

type RecentRow = {
  clicked_at: Date;
  code: string;
  device: string;
  referrer: string;
  user_agent: string | null;
};

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return apiError(401, "unauthorized", "Sign in to view the admin console.");

  const admin = await requireAdmin(req);
  if (!admin) return apiError(403, "forbidden", "Admin access is required.");

  const cacheKey = "admin:overview";
  if (req.nextUrl.searchParams.get("fresh") !== "1") {
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "cache-control": "no-store", "x-data-cache": "hit" },
      });
    }
  }

  try {
    const [totalsResult, seriesResult, usersResult, linksResult, recentResult] = await Promise.all([
      db<TotalsRow>(
        `select
           (select count(*)::int from users) as users,
           (select count(*)::int from users where role = 'admin') as admins,
           (select count(*)::int from links) as links,
           (select count(*)::int from clicks) as clicks,
           (select count(distinct visitor_hash)::int from clicks) as unique_visitors,
           (select count(*)::int from clicks where clicked_at >= now() - interval '24 hours') as last_24h`
      ),
      db<SeriesRow>(
        `select series.bucket,
                count(c.id)::int as clicks
         from generate_series(
           date_trunc('day', now()) - interval '13 days',
           date_trunc('day', now()),
           interval '1 day'
         ) as series(bucket)
         left join clicks c
           on c.clicked_at >= series.bucket
          and c.clicked_at < series.bucket + interval '1 day'
         group by series.bucket
         order by series.bucket`
      ),
      db<UserRow>(
        `select u.id,
                u.email,
                u.name,
                u.role,
                u.created_at,
                count(distinct l.id)::int as link_count,
                count(c.id)::int as click_count,
                max(c.clicked_at) as last_click
         from users u
         left join links l on l.user_id = u.id
         left join clicks c on c.link_id = l.id
         group by u.id
         order by u.created_at desc
         limit 100`
      ),
      db<LinkRow>(
        `select l.code,
                l.url,
                l.created_at,
                l.expires_at,
                u.email as owner_email,
                u.name as owner_name,
                count(c.id)::int as total_clicks,
                count(distinct c.visitor_hash)::int as unique_clicks
         from links l
         join users u on u.id = l.user_id
         left join clicks c on c.link_id = l.id
         group by l.id, u.email, u.name
         order by l.created_at desc
         limit 100`
      ),
      db<RecentRow>(
        `select c.clicked_at,
                l.code,
                c.device,
                coalesce(nullif(c.referrer, ''), 'Direct') as referrer,
                c.user_agent
         from clicks c
         join links l on l.id = c.link_id
         order by c.clicked_at desc
         limit 20`
      ),
    ]);

    const totals = totalsResult.rows[0] ?? {
      users: 0,
      admins: 0,
      links: 0,
      clicks: 0,
      unique_visitors: 0,
      last_24h: 0,
    };

    const payload = {
      totals: {
        users: totals.users,
        admins: totals.admins,
        links: totals.links,
        clicks: totals.clicks,
        uniqueVisitors: totals.unique_visitors,
        last24h: totals.last_24h,
      },
      series: seriesResult.rows.map((row) => ({
        bucket: row.bucket.toISOString(),
        clicks: row.clicks,
      })),
      users: usersResult.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role === "admin" ? "admin" : "user",
        createdAt: row.created_at.toISOString(),
        linkCount: row.link_count,
        clickCount: row.click_count,
        lastClick: row.last_click ? row.last_click.toISOString() : null,
      })),
      links: linksResult.rows.map((row) => ({
        code: row.code,
        url: row.url,
        ownerEmail: row.owner_email,
        ownerName: row.owner_name,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
        totalClicks: row.total_clicks,
        uniqueClicks: row.unique_clicks,
      })),
      recent: recentResult.rows.map((row) => ({
        clickedAt: row.clicked_at.toISOString(),
        code: row.code,
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
    console.error("Admin overview failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not load the admin overview.");
  }
}
