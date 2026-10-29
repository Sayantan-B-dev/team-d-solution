import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { isSecureRequest } from "./request";

/**
 * Guests (not signed in) can shorten links without an account, but only a few
 * per day. Ownership is proven by an httpOnly cookie that never leaves the
 * server, so the token itself is never stored in the database — only its hash.
 */
export const GUEST_COOKIE = "sw_guest";
export const GUEST_DAILY_LIMIT = 5;
export const GUEST_WINDOW_HOURS = 24;
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function guestTokenFrom(req: NextRequest): string | null {
  const raw = req.cookies.get(GUEST_COOKIE)?.value;
  return raw && TOKEN_PATTERN.test(raw) ? raw : null;
}

export function newGuestToken(): string {
  return randomBytes(32).toString("hex");
}

export function guestHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function guestCookieOptions(req: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(req),
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
  };
}

export const GUEST_WINDOW_SQL = `interval '${GUEST_WINDOW_HOURS} hours'`;
