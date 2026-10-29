-- ===========================================================================
-- // Snip — complete database setup (Neon PostgreSQL)
--
-- Paste this ENTIRE file into the Neon SQL Editor and press Run.
-- Idempotent: safe on a fresh database and safe to re-run on an existing one.
-- It never deletes data.
--
-- Command line:
--   psql "$NEON_DATABASE_URL" -f db/setup.sql
--   npm run db:setup        (same file, plus a verified summary)
--
-- Contains: tables, roles, indexes, constraints, ANALYZE, verification.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- One row per Google account. `role` decides dashboard access.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

-- Upgrade an older users table.
alter table users add column if not exists role text not null default 'user';

-- Only these two roles exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'users'::regclass
  ) then
    alter table users
      add constraint users_role_check
      check (role in ('user', 'admin'));
  end if;
end
$$;

-- One row per short link. Deleting a user cascades to their links.
-- A link belongs to either a signed-in user (`user_id`) or a guest browser
-- (`owner_token_hash`, the SHA-256 of an httpOnly cookie token). It can never
-- belong to neither.
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  owner_token_hash text,
  code text not null unique,
  url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Upgrade a links table created before guest links existed.
alter table links add column if not exists owner_token_hash text;
alter table links alter column user_id drop not null;

-- Exactly one owner: a signed-in user or a guest cookie hash.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'links_owner_required'
      and conrelid = 'links'::regclass
  ) then
    alter table links
      add constraint links_owner_required
      check (user_id is not null or owner_token_hash is not null);
  end if;
end
$$;

-- One row per redirect. Deleting a link cascades to its clicks.
create table if not exists clicks (
  id bigserial primary key,
  link_id uuid not null references links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text,
  user_agent text,
  device text not null default 'desktop',
  visitor_hash text not null
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- Dashboard list: newest links first for one owner.
create index if not exists links_user_created_idx
  on links (user_id, created_at desc);

-- Analytics: recent clicks, time buckets and "last 24h" for one link.
create index if not exists clicks_link_time_idx
  on clicks (link_id, clicked_at desc);

-- Unique visitors: count(distinct visitor_hash) per link.
create index if not exists clicks_link_visitor_idx
  on clicks (link_id, visitor_hash);

-- Covering index for range totals, device split and referrer split.
create index if not exists clicks_link_breakdown_idx
  on clicks (link_id, clicked_at desc)
  include (device, referrer);

-- Owner lookup by email, case-insensitive.
create index if not exists users_email_idx
  on users (lower(email));

-- Admin console: list admins / count them.
create index if not exists users_role_idx
  on users (role);

commit;

analyze users;
analyze links;
analyze clicks;

-- ---------------------------------------------------------------------------
-- 3. Verification (read-only)
-- Expect 3 tables, 11 indexes (6 explicit + primary/unique), 0 rows on a fresh DB.
-- ---------------------------------------------------------------------------

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('users', 'links', 'clicks')
order by table_name;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name = 'role';

select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('users', 'links', 'clicks')
order by tablename, indexname;

select 'users' as table_name, count(*)::int as rows from users
union all
select 'links', count(*)::int from links
union all
select 'clicks', count(*)::int from clicks;

select role, count(*)::int as users
from users
group by role
order by role;
