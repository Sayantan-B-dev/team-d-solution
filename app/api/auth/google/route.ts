import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { resolveRedirectUri } from "@/lib/oauth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSecureRequest } from "@/lib/request";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = rateLimit(`auth:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) {
    return apiError(429, "rate_limited", "Too many sign-in attempts. Please wait a minute.", limit.headers);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error("[auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.");
    return NextResponse.redirect(new URL("/?error=config", req.url));
  }

  const redirectUri = resolveRedirectUri(req);
  const state = randomBytes(24).toString("hex");
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");
  authorizeUrl.searchParams.set("access_type", "online");

  console.log(`[auth] Google authorize redirect_uri=${redirectUri}`);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    maxAge: 600,
  });

  return response;
}
