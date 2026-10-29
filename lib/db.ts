import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as {
  shortwavePool?: Pool;
  shortwaveSchema?: Promise<void>;
};

// Keep in sync with db/setup.sql.
const SCHEMA_SQL = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

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

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  owner_token_hash text,
  code text not null unique,
  url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table links add column if not exists owner_token_hash text;
alter table links alter column user_id drop not null;

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

create index if not exists links_user_created_idx on links (user_id, created_at desc);
create index if not exists links_owner_created_idx
  on links (owner_token_hash, created_at desc)
  where owner_token_hash is not null;

create table if not exists clicks (
  id bigserial primary key,
  link_id uuid not null references links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text,
  user_agent text,
  device text not null default 'desktop',
  visitor_hash text not null
);

create index if not exists clicks_link_time_idx on clicks (link_id, clicked_at desc);
create index if not exists clicks_link_visitor_idx on clicks (link_id, visitor_hash);
create index if not exists clicks_link_breakdown_idx
  on clicks (link_id, clicked_at desc)
  include (device, referrer);
create index if not exists users_email_idx on users (lower(email));
create index if not exists users_role_idx on users (role);
`;

export function hasDatabase(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL);
}

export function getPool(): Pool {
  const rawConnectionString = process.env.NEON_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error("NEON_DATABASE_URL is not configured.");
  }

  let connectionString = rawConnectionString;
  try {
    const parsed = new URL(rawConnectionString);
    parsed.searchParams.delete("sslmode");
    connectionString = parsed.toString();
  } catch {
    // Keep the raw string when it is not a parseable URL.
  }

  if (!globalForDb.shortwavePool) {
    globalForDb.shortwavePool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      // Keep one idle connection alive. Neon charges a full TLS + auth
      // handshake on every new connection (~200-400ms), which is what made
      // /api/links look slow. With min: 1 the pool never closes its last
      // connection, so warm requests reuse it.
      min: 1,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      statement_timeout: 8_000,
      application_name: "snip",
    });

    globalForDb.shortwavePool.on("error", (error) => {
      console.error("Unexpected database pool error:", error.message);
    });
  }

  return globalForDb.shortwavePool;
}

export async function ensureSchema(): Promise<void> {
  if (!globalForDb.shortwaveSchema) {
    globalForDb.shortwaveSchema = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((error: unknown) => {
        globalForDb.shortwaveSchema = undefined;
        throw error;
      });
  }

  return globalForDb.shortwaveSchema;
}

export async function db<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await ensureSchema();
  return getPool().query<T>(text, params);
}

/**
 * Run several statements atomically. Used for the guest daily quota, where the
 * count and the insert must not race.
 */
export async function withTransaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
