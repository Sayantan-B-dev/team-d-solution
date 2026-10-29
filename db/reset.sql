-- // dlinkit — DESTRUCTIVE reset
--
-- Deletes ALL users, links and clicks in this database.
-- There is no undo. Only run this on a development/demo database.
--
-- After running this file, run db/setup.sql again.
-- The npm wrapper does both automatically:
--   npm run db:reset
--
--   psql "$NEON_DATABASE_URL" -f db/reset.sql
--   psql "$NEON_DATABASE_URL" -f db/setup.sql

begin;

drop table if exists clicks cascade;
drop table if exists links cascade;
drop table if exists users cascade;

commit;

-- Tables are gone until db/setup.sql is re-run.
