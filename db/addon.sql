-- ===========================================================================
-- // Snip — add-on migration for an existing database
--
-- Run this only when the tables already exist and you want the newer
-- user/admin role support. `setup.sql` also includes these statements.
--
-- Idempotent and non-destructive.
--   psql "$NEON_DATABASE_URL" -f db/addon.sql
-- ===========================================================================

begin;

alter table users add column if not exists role text not null default 'user';

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

create index if not exists users_role_idx on users (role);

commit;

analyze users;

-- Make yourself an admin (replace the email, then sign out and back in):
--   update users set role = 'admin' where lower(email) = lower('you@example.com');
--
-- The query above is intentionally commented out. Run it yourself in the
-- Neon SQL Editor or with psql. The session JWT caches the role, so sign out
-- and sign in again after changing it. Admin routes also re-check the role in
-- the database, so the console works as soon as the row is updated.

-- Verification
select email, role, created_at
from users
order by role desc, created_at asc;

select count(*)::int as admins from users where role = 'admin';
