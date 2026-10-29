import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirectUri } from "@/lib/oauth";
import { publicOrigin } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safe OAuth diagnostics. No secret is returned: the client ID is already
 * public in Google's authorize URL, and the client secret is only reported as
 * present or missing.
 *
 * Open http://localhost:3000/api/auth/diagnose while testing sign-in. The
 * `effectiveRedirectUri` must exactly match an Authorized redirect URI in
 * Google Cloud Console -> Credentials -> your OAuth client.
 */
export async function GET(req: NextRequest) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim() ?? "";
  const effective = resolveRedirectUri(req);
  const origin = publicOrigin(req);

  let configuredOrigin: string | null = null;
  try {
    configuredOrigin = configured ? new URL(configured).origin : null;
  } catch {
    configuredOrigin = null;
  }

  return NextResponse.json(
    {
      requestOrigin: origin,
      configuredRedirectUri: configured || null,
      configuredOrigin,
      effectiveRedirectUri: effective,
      callbackPath: "/api/auth/callback/google",
      originMatchesConfigured: configuredOrigin ? configuredOrigin === origin : null,
      clientIdSet: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
      clientSecretSet: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
      authSecretSet: Boolean(process.env.AUTH_SECRET?.trim()),
      note:
        "Add effectiveRedirectUri to Google Cloud Console -> APIs & Services -> Credentials -> your OAuth 2.0 Client -> Authorized redirect URIs. It must match character for character.",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
