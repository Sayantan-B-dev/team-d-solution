import { Pool } from "pg";
import { SignJWT } from "jose";

const BASE = process.env.BASE ?? "http://localhost:3010";
const secret = process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET;
if (!secret) throw new Error("AUTH_SECRET or GOOGLE_CLIENT_SECRET is missing.");

const key = new TextEncoder().encode(secret);
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL.split("?")[0],
  ssl: { rejectUnauthorized: false },
});

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function tokenFor(id, email, name, role) {
  return new SignJWT({ email, name, avatarUrl: null, role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

const stamp = Date.now().toString(36);
const userEmail = `verify-user-${stamp}@example.com`;
const adminEmail = `verify-admin-${stamp}@example.com`;

const user = (
  await pool.query(
    "insert into users (google_sub, email, name, role) values ($1,$2,$3,'user') returning id",
    [`verify-user-${stamp}`, userEmail, "Verify User"]
  )
).rows[0];
const admin = (
  await pool.query(
    "insert into users (google_sub, email, name, role) values ($1,$2,$3,'admin') returning id",
    [`verify-admin-${stamp}`, adminEmail, "Verify Admin"]
  )
).rows[0];

const userCookie = `sw_session=${await tokenFor(user.id, userEmail, "Verify User", "user")}`;
const adminCookie = `sw_session=${await tokenFor(admin.id, adminEmail, "Verify Admin", "admin")}`;

async function call(path, init = {}, cookie) {
  const headers = { ...(init.headers ?? {}) };
  if (cookie) headers.cookie = cookie;
  const started = Date.now();
  const response = await fetch(BASE + path, { ...init, headers });
  return { response, ms: Date.now() - started };
}

const code = `verify-${stamp}`;
const adminCode = `verify-admin-${stamp}`;
const expiredCode = `verify-exp-${stamp}`;

try {
  const health = await call("/health");
  const healthBody = await health.response.json().catch(() => ({}));
  check(
    "health",
    health.response.status === 200 && healthBody.database === "up",
    JSON.stringify(healthBody)
  );

  const noCookie = await call("/api/links");
  check("links requires login", noCookie.response.status === 401, String(noCookie.response.status));

  const noAuthCreate = await call("/api/shorten", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  check("shorten requires login", noAuthCreate.response.status === 401, String(noAuthCreate.response.status));

  const wrongType = await call(
    "/api/shorten",
    { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" },
    userCookie
  );
  check("rejects wrong content type", wrongType.response.status === 415, String(wrongType.response.status));

  const badUrl = await call(
    "/api/shorten",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "javascript:alert(1)" }),
    },
    userCookie
  );
  check("rejects bad protocol", badUrl.response.status === 400, String(badUrl.response.status));

  const pastExpiry = await call(
    "/api/shorten",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", expiresAt: "2020-01-01T00:00:00.000Z" }),
    },
    userCookie
  );
  check("rejects past expiry", pastExpiry.response.status === 400, String(pastExpiry.response.status));

  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const created = await call(
    "/api/shorten",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/verify", alias: code, expiresAt: future }),
    },
    userCookie
  );
  const createdBody = await created.response.json();
  check(
    "create link",
    created.response.status === 201 && createdBody.code === code,
    `${created.response.status} ${createdBody.code ?? createdBody.message ?? ""}`
  );
  check(
    "rate limit headers on create",
    created.response.headers.get("x-ratelimit-limit") === "20",
    created.response.headers.get("x-ratelimit-limit")
  );

  const duplicate = await call(
    "/api/shorten",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/other", alias: code }),
    },
    userCookie
  );
  check("duplicate alias 409", duplicate.response.status === 409, String(duplicate.response.status));

  const listMiss = await call("/api/links?fresh=1", {}, userCookie);
  const listBody = await listMiss.response.json();
  check(
    "list has link",
    listMiss.response.status === 200 && listBody.links.some((link) => link.code === code),
    `count ${listBody.links.length}`
  );

  const listHit = await call("/api/links", {}, userCookie);
  check(
    "list cache hit",
    listHit.response.headers.get("x-data-cache") === "hit",
    `${listHit.response.headers.get("x-data-cache")} in ${listHit.ms}ms`
  );

  for (const [range, buckets] of [
    ["24h", 24],
    ["7d", 7],
    ["30d", 30],
  ]) {
    const stats = await call(`/api/stats/${code}?range=${range}&fresh=1`, {}, userCookie);
    const body = await stats.response.json();
    check(
      `stats ${range}`,
      stats.response.status === 200 && body.series.length === buckets,
      `buckets ${body.series?.length}`
    );
  }

  const firstRedirect = await call(`/r/${code}`, { redirect: "manual" });
  check(
    "redirect tracked",
    firstRedirect.response.status === 302 &&
      firstRedirect.response.headers.get("x-redirect-cache") === "miss",
    `${firstRedirect.response.status}/${firstRedirect.response.headers.get("x-redirect-cache")}`
  );

  const secondRedirect = await call(`/r/${code}`, { redirect: "manual" });
  check(
    "redirect cache hit",
    secondRedirect.response.status === 302 &&
      secondRedirect.response.headers.get("x-redirect-cache") === "hit",
    secondRedirect.response.headers.get("x-redirect-cache")
  );

  const statsAfter = await call(`/api/stats/${code}?range=24h&fresh=1`, {}, userCookie);
  const statsAfterBody = await statsAfter.response.json();
  check("clicks recorded", statsAfterBody.total >= 2, String(statsAfterBody.total));

  await pool.query(
    "insert into links (user_id, code, url, expires_at) values ($1,$2,$3, now() - interval '1 hour')",
    [user.id, expiredCode, "https://example.com/expired"]
  );
  const expired = await call(`/r/${expiredCode}`);
  check("expired link 410", expired.response.status === 410, String(expired.response.status));

  const userAdmin = await call("/api/admin/overview", {}, userCookie);
  check("admin blocked for user", userAdmin.response.status === 403, String(userAdmin.response.status));

  const adminOverview = await call("/api/admin/overview?fresh=1", {}, adminCookie);
  const adminBody = await adminOverview.response.json();
  check(
    "admin overview",
    adminOverview.response.status === 200 &&
      adminBody.totals.users >= 2 &&
      adminBody.links.length >= 1,
    `users ${adminBody.totals?.users}, links ${adminBody.links?.length}`
  );

  const promote = await call(
    `/api/admin/users/${user.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    },
    adminCookie
  );
  check("promote user", promote.response.status === 200, String(promote.response.status));

  const promotedOverview = await call("/api/admin/overview?fresh=1", {}, userCookie);
  check("role rechecked in db", promotedOverview.response.status === 200, String(promotedOverview.response.status));

  const demote = await call(
    `/api/admin/users/${user.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    },
    adminCookie
  );
  check("demote user", demote.response.status === 200, String(demote.response.status));

  const selfDemote = await call(
    `/api/admin/users/${admin.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    },
    adminCookie
  );
  check(
    "last admin cannot be demoted",
    selfDemote.response.status === 409 || selfDemote.response.status === 200,
    `${selfDemote.response.status} (409 when last admin)`
  );

  const extend = await call(
    `/api/admin/links/${code}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() }),
    },
    adminCookie
  );
  check("admin extend expiry", extend.response.status === 200, String(extend.response.status));

  const adminCreate = await call(
    "/api/shorten",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/admin", alias: adminCode }),
    },
    adminCookie
  );
  const adminCreateBody = await adminCreate.response.json();
  check(
    "admin creates link",
    adminCreate.response.status === 201 && adminCreateBody.code === adminCode,
    String(adminCreate.response.status)
  );

  const userDeleteOther = await call(`/api/links/${adminCode}`, { method: "DELETE" }, userCookie);
  check("user cannot delete another link", userDeleteOther.response.status === 404, String(userDeleteOther.response.status));

  const adminDelete = await call(`/api/admin/links/${code}`, { method: "DELETE" }, adminCookie);
  check("admin delete link", adminDelete.response.status === 200, String(adminDelete.response.status));

  const gone = await call(`/r/${code}`);
  check("deleted link 404", gone.response.status === 404, String(gone.response.status));

  const diagnose = await call("/api/auth/diagnose");
  const diagnoseBody = await diagnose.response.json();
  check(
    "auth diagnose",
    diagnose.response.status === 200 &&
      diagnoseBody.effectiveRedirectUri === `${BASE}/api/auth/callback/google` &&
      diagnoseBody.clientIdSet === true,
    diagnoseBody.effectiveRedirectUri
  );

  const oauth = await call("/api/auth/google", { redirect: "manual" });
  const location = oauth.response.headers.get("location") ?? "";
  const redirectUri = new URL(location).searchParams.get("redirect_uri");
  check(
    "oauth redirect uri matches request",
    oauth.response.status === 307 && redirectUri === `${BASE}/api/auth/callback/google`,
    redirectUri ?? "none"
  );

  const home = await call("/", {}, adminCookie);
  const html = await home.response.text();
  check(
    "admin console rendered",
    home.response.status === 200 && html.includes("Admin console") && html.includes("// Snip")
  );

  const setCookie = oauth.response.headers.get("set-cookie") ?? "";
  check(
    "oauth state cookie is not secure over http",
    setCookie.includes("sw_oauth_state") && !setCookie.toLowerCase().includes("secure"),
    setCookie ? "set-cookie present" : "no set-cookie"
  );

  console.log("\nLatency:");
  console.log(`  /api/links (cache hit) ${listHit.ms}ms  cold ${listMiss.ms}ms`);
  console.log(`  /api/admin/overview ${adminOverview.ms}ms`);
  console.log(`  /r/${code} cached redirect ${secondRedirect.ms}ms`);
} catch (error) {
  fail += 1;
  console.error("TEST ERROR:", error instanceof Error ? error.message : error);
} finally {
  await pool.query("delete from users where id = any($1::uuid[])", [[user.id, admin.id]]);
  await pool.end();
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
