import type { NextRequest } from "next/server";
import { publicOrigin } from "./url";

const CALLBACK_PATH = "/api/auth/callback/google";

/**
 * The redirect URI sent to Google. It must match Google Cloud Console exactly.
 *
 * - Trims whitespace and normalizes a wrong callback path to the real route.
 * - Falls back to the request origin when the value is missing or a placeholder.
 * - In local development, if the configured origin points at a different
 *   loopback port than the one being browsed, uses the real origin instead of
 *   redirecting the browser to a port that is not running.
 * - In production the configured value wins, so a custom domain keeps working.
 */
export function resolveRedirectUri(req: NextRequest): string {
  const derived = new URL(CALLBACK_PATH, publicOrigin(req)).toString();
  const raw = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!raw || /[[\]]/.test(raw) || /your-app|example\.com/i.test(raw)) {
    return derived;
  }

  let configured: URL;
  try {
    configured = new URL(raw);
  } catch {
    console.warn("[auth] GOOGLE_REDIRECT_URI is not a valid absolute URL; using the request origin.");
    return derived;
  }

  if (!configured.pathname.endsWith(CALLBACK_PATH)) {
    console.warn(`[auth] GOOGLE_REDIRECT_URI path ${configured.pathname} is wrong; using ${CALLBACK_PATH}.`);
    configured.pathname = CALLBACK_PATH;
  }
  configured.search = "";
  configured.hash = "";

  const actual = new URL(publicOrigin(req));
  const loopback = (host: string) =>
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";

  // A localhost value copied into production (a very common copy-paste) would
  // send Google straight back to the developer's machine. Prefer the request
  // origin whenever the configured value points at loopback and the real
  // request does not.
  if (loopback(configured.hostname) && !loopback(actual.hostname)) {
    console.warn(
      `[auth] GOOGLE_REDIRECT_URI points at ${configured.origin} but the request came from ${actual.origin}; using ${derived}. ` +
        "Set GOOGLE_REDIRECT_URI to the deployed callback and register it in Google Cloud Console."
    );
    return derived;
  }

  if (
    loopback(configured.hostname) &&
    loopback(actual.hostname) &&
    configured.origin !== actual.origin
  ) {
    console.warn(
      `[auth] GOOGLE_REDIRECT_URI origin ${configured.origin} does not match ${actual.origin}; using ${derived}. ` +
        "Register the exact URI you browse in Google Cloud Console."
    );
    return derived;
  }

  return configured.toString();
}
