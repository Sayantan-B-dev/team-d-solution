-- ===========================================================================
-- // dlinkit — read-only test suite
--
-- Run after db/setup.sql. Nothing here writes, drops, or changes data.
--   psql "$NEON_DATABASE_URL" -f db/test.sql
--   or paste into the Neon SQL Editor.
-- ===========================================================================

-- 1. Tables. Expect clicks, links, users.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('users', 'links', 'clicks')
order by table_name;

-- 2. Role column and ownership columns.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'users' and column_name in ('id', 'email', 'role'))
    or (table_name = 'links' and column_name in ('id', 'user_id', 'owner_token_hash', 'code', 'expires_at'))
  )
order by table_name, column_name;

-- 3. Indexes. Expect 12 total: 7 explicit + 5 primary/unique.
select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('users', 'links', 'clicks')
order by tablename, indexname;

-- 4. Constraints. Expect the role check and both cascade foreign keys.
select
  conrelid::regclass as table_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('users', 'links', 'clicks')
order by 1, 2;

-- 5. Row counts and roles.
select 'users' as table_name, count(*)::int as rows from users
union all
select 'links', count(*)::int from links
union all
select 'clicks', count(*)::int from clicks;

select role, count(*)::int as users
from users
group by role
order by role;

-- 6. Per-user activity.
select
  u.email,
  u.role,
  count(distinct l.id)::int as links,
  count(c.id)::int as clicks,
  count(distinct c.visitor_hash)::int as unique_visitors,
  count(c.id) filter (where c.clicked_at >= now() - interval '24 hours')::int as last_24h,
  max(c.clicked_at) as last_click
from users u
left join links l on l.user_id = u.id
left join clicks c on c.link_id = l.id
group by u.id
order by clicks desc, u.created_at asc;

-- 7. All links with owner and totals.
select
  l.code,
  coalesce(u.email, 'guest browser') as owner,
  l.url,
  l.created_at,
  l.expires_at,
  case
    when l.expires_at is null then 'never'
    when l.expires_at <= now() then 'expired'
    else 'active'
  end as expiry_state,
  count(c.id)::int as clicks,
  count(distinct c.visitor_hash)::int as unique_visitors
from links l
left join users u on u.id = l.user_id
left join clicks c on c.link_id = l.id
group by l.id, u.email
order by l.created_at desc
limit 50;

-- 8. Top links by clicks.
select
  l.code,
  coalesce(u.email, 'guest browser') as owner,
  count(c.id)::int as clicks
from links l
left join users u on u.id = l.user_id
join clicks c on c.link_id = l.id
group by l.id, u.email
order by clicks desc, l.code asc
limit 10;

-- 9. Clicks per day for the last 14 days.
select
  series.bucket::date as day,
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
order by series.bucket;

-- 10. Recent clicks.
select
  c.clicked_at,
  l.code,
  c.device,
  coalesce(nullif(c.referrer, ''), 'Direct') as referrer,
  left(c.user_agent, 80) as user_agent
from clicks c
join links l on l.id = c.link_id
order by c.clicked_at desc
limit 20;

-- 11. Expired links still visible in dashboards.
select l.code, coalesce(u.email, 'guest browser') as owner, l.expires_at
from links l
left join users u on u.id = l.user_id
where l.expires_at is not null
  and l.expires_at <= now()
order by l.expires_at desc;

-- 12. Integrity checks. Both rows must be 0.
-- A guest link is valid: it has a token hash instead of a user_id.
select 'links without an owner' as check_name, count(*)::int as bad_rows
from links
where user_id is null
  and owner_token_hash is null
union all
select 'clicks without a link', count(*)::int
from clicks c
left join links l on l.id = c.link_id
where l.id is null;

-- 13. Admins.
select email, name, created_at
from users
where role = 'admin'
order by created_at asc;
