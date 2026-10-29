import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { invalidateCache } from "@/lib/data-cache";
import { db, withTransaction } from "@/lib/db";
import {
  GUEST_COOKIE,
  GUEST_DAILY_LIMIT,
  GUEST_WINDOW_HOURS,
  GUEST_WINDOW_SQL,
  guestCookieOptions,
  guestHash,
  guestTokenFrom,
  newGuestToken,
} from "@/lib/guest";
import { generateCode, normalizeUrl, parseAlias, parseExpiry } from "@/lib/links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicOrigin } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const GUEST_WINDOW_MS = GUEST_WINDOW_HOURS * 60 * 60 * 1000;

type PgError = { code?: string };

type GuestInsert =
  | { kind: "created"; used: number }
  | { kind: "limited"; retryAfter: number };

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  const ip = clientIp(req);

  // Guests get a stable identity from an httpOnly cookie so the daily quota
  // can be enforced. A brand new visitor simply starts with a full quota.
  const existingGuestToken = user ? null : guestTokenFrom(req);
  const guestToken = user ? null : (existingGuestToken ?? newGuestToken());
  const ownerHash = guestToken ? guestHash(guestToken) : "";

  const minuteLimit = rateLimit(
    user ? `shorten:${user.id}:${ip}` : `shorten:guest:${ownerHash}`,
    user ? 20 : 10,
    60_000
  );

  if (!minuteLimit.ok) {
    return apiError(
      429,
      "rate_limited",
      `You are creating links too quickly. Try again in ${minuteLimit.retryAfter}s.`,
      minuteLimit.headers
    );
  }

  const headers: Record<string, string> = { ...minuteLimit.headers };

  // Extra guard per IP so clearing the cookie cannot bypass the daily quota.
  if (!user) {
    const ipLimit = rateLimit(`shorten:guest-ip:${ip}`, 20, 60 * 60_000);
    if (!ipLimit.ok) {
      return apiError(
        429,
        "rate_limited",
        "Too many links from this network. Try again later, or sign in.",
        { ...headers, "retry-after": String(ipLimit.retryAfter) }
      );
    }
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return apiError(415, "unsupported_media_type", "Send the body as application/json.", headers);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return apiError(413, "body_too_large", "That request body is too large.", headers);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Send a JSON body with a url field.", headers);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError(400, "invalid_body", "Send a JSON object with a url field.", headers);
  }

  const { url, alias, expiresAt } = body as Record<string, unknown>;

  const parsedUrl = normalizeUrl(url);
  if (!parsedUrl.ok) return apiError(400, "invalid_url", parsedUrl.message, headers);

  const parsedAlias = parseAlias(alias);
  if (!parsedAlias.ok) return apiError(400, "invalid_alias", parsedAlias.message, headers);

  const parsedExpiry = parseExpiry(expiresAt);
  if (!parsedExpiry.ok) return apiError(400, "invalid_expiry", parsedExpiry.message, headers);

  const requestedAlias = parsedAlias.alias;
  let code = requestedAlias ?? generateCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      let used = 0;

      if (user) {
        await db(
          `insert into links (user_id, code, url, expires_at)
           values ($1, $2, $3, $4)`,
          [user.id, code, parsedUrl.url, parsedExpiry.expiresAt]
        );
      } else {
        // Count and insert in one transaction, serialized per guest, so two
        // parallel requests can never exceed the daily quota.
        const outcome = await withTransaction<GuestInsert>(async (client) => {
          await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerHash]);

          const quota = await client.query<{ used: number; oldest: Date | null }>(
            `select count(*)::int as used, min(created_at) as oldest
             from links
             where owner_token_hash = $1
               and created_at > now() - ${GUEST_WINDOW_SQL}`,
            [ownerHash]
          );

          const counted = quota.rows[0]?.used ?? 0;
          if (counted >= GUEST_DAILY_LIMIT) {
            const oldest = quota.rows[0]?.oldest;
            const retryAfter = oldest
              ? Math.max(1, Math.ceil((new Date(oldest).getTime() + GUEST_WINDOW_MS - Date.now()) / 1000))
              : 3_600;
            return { kind: "limited" as const, retryAfter };
          }

          await client.query(
            `insert into links (user_id, owner_token_hash, code, url, expires_at)
             values (null, $1, $2, $3, $4)`,
            [ownerHash, code, parsedUrl.url, parsedExpiry.expiresAt]
          );

          return { kind: "created" as const, used: counted + 1 };
        });

        if (outcome.kind === "limited") {
          return apiError(
            429,
            "guest_limit",
            `You have used all ${GUEST_DAILY_LIMIT} free links for today. Sign in with Google to keep shortening links.`,
            {
              ...headers,
              "retry-after": String(outcome.retryAfter),
              "x-guest-limit": String(GUEST_DAILY_LIMIT),
              "x-guest-remaining": "0",
            }
          );
        }

        used = outcome.used;
      }

      if (user) {
        invalidateCache(`links:${user.id}`);
        invalidateCache(`stats:${user.id}:`);
        invalidateCache("admin:");
      }

      const responseHeaders: Record<string, string> = { ...headers };
      if (!user) {
        responseHeaders["x-guest-limit"] = String(GUEST_DAILY_LIMIT);
        responseHeaders["x-guest-remaining"] = String(Math.max(0, GUEST_DAILY_LIMIT - used));
      }

      const response = NextResponse.json(
        {
          code,
          url: parsedUrl.url,
          shortUrl: `${publicOrigin(req)}/r/${code}`,
          expiresAt: parsedExpiry.expiresAt,
          guest: user ? null : { limit: GUEST_DAILY_LIMIT, used, remaining: GUEST_DAILY_LIMIT - used },
        },
        { status: 201, headers: responseHeaders }
      );

      if (!user && guestToken && !existingGuestToken) {
        response.cookies.set(GUEST_COOKIE, guestToken, guestCookieOptions(req));
      }

      return response;
    } catch (error) {
      const pgError = error as PgError;

      if (pgError.code === "23505") {
        if (requestedAlias) {
          return apiError(409, "alias_taken", "That alias is already in use. Try another one.", headers);
        }
        code = generateCode();
        continue;
      }

      console.error("Could not create link:", error instanceof Error ? error.message : "unknown error");
      return apiError(500, "database_error", "Could not save the link. Please try again.", headers);
    }
  }

  return apiError(
    500,
    "code_generation_failed",
    "Could not allocate a short code. Please try again.",
    headers
  );
}
