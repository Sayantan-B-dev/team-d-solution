import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  upsertUser,
} from "@/lib/auth";
import { invalidateCache } from "@/lib/data-cache";
import { db } from "@/lib/db";
import { GUEST_COOKIE, guestHash } from "@/lib/guest";
import { resolveRedirectUri } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleTokens = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function fail(req: NextRequest, reason: string) {
  const url = new URL("/", req.url);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthDescription = req.nextUrl.searchParams.get("error_description");
  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (oauthError) {
    console.error(`[auth] Google returned ${oauthError}: ${oauthDescription ?? "no description"}`);
    return fail(req, "auth_cancelled");
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    console.error(
      `[auth] OAuth state check failed (code=${Boolean(code)}, state=${Boolean(state)}, cookie=${Boolean(
        cookieState
      )}).`
    );
    return fail(req, "auth_state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = resolveRedirectUri(req);

  if (!clientId || !clientSecret) return fail(req, "config");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      const raw = await tokenResponse.text().catch(() => "");
      let detail = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw) as GoogleTokens;
        detail = `${parsed.error ?? "unknown"}${parsed.error_description ? `: ${parsed.error_description}` : ""}`;
      } catch {
        // Keep the raw body preview.
      }
      console.error(
        `[auth] Token exchange failed with ${tokenResponse.status} (${detail}). ` +
          `redirect_uri=${redirectUri}. Check that this exact URI is registered in Google Cloud Console.`
      );
      return fail(req, "auth_failed");
    }

    const tokens = (await tokenResponse.json()) as GoogleTokens;
    if (!tokens.access_token) return fail(req, "auth_failed");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      console.error(`[auth] Google userinfo failed with ${profileResponse.status}.`);
      return fail(req, "auth_failed");
    }

    const profile = (await profileResponse.json()) as GoogleProfile;
    if (!profile.sub || !profile.email || profile.email_verified === false) {
      console.error("[auth] Google profile is missing a verified email.");
      return fail(req, "auth_failed");
    }

    const user = await upsertUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture,
    });

    // Hand any links this browser created as a guest over to the account.
    const guestToken = req.cookies.get(GUEST_COOKIE)?.value;
    if (guestToken) {
      try {
        const claimed = await db(
          `update links
           set user_id = $1, owner_token_hash = null
           where owner_token_hash = $2`,
          [user.id, guestHash(guestToken)]
        );

        if (claimed.rowCount) {
          console.log(`[auth] Claimed ${claimed.rowCount} guest link(s) for ${user.id}.`);
          invalidateCache(`links:${user.id}`);
          invalidateCache("admin:");
        }
      } catch (error) {
        console.error(
          "[auth] Could not claim guest links:",
          error instanceof Error ? error.message : "unknown error"
        );
      }
    }

    const sessionToken = await createSessionToken(user);
    const response = NextResponse.redirect(new URL("/?welcome=1", req.url), 303);
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(req));
    response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    response.cookies.set(GUEST_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    console.error("Google sign-in failed:", error instanceof Error ? error.message : "unknown error");
    return fail(req, "server");
  }
}
