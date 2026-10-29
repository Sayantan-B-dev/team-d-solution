import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const MAX_URL_LENGTH = 2048;
const MAX_EXPIRY_DAYS = 365;

export const RESERVED_CODES = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "callback",
  "dashboard",
  "db",
  "docs",
  "favicon.ico",
  "health",
  "login",
  "logout",
  "oauth",
  "privacy",
  "r",
  "robots.txt",
  "settings",
  "setup",
  "sitemap.xml",
  "static",
  "stats",
  "terms",
  "_next",
  "_vercel",
]);

export function isCodeShape(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function generateCode(length = 7): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return code;
}

export type UrlResult = { ok: true; url: string } | { ok: false; message: string };

export function normalizeUrl(raw: unknown): UrlResult {
  if (typeof raw !== "string") {
    return { ok: false, message: "Enter the URL you want to shorten." };
  }

  let value = raw.trim();
  if (!value) {
    return { ok: false, message: "Enter the URL you want to shorten." };
  }
  if (value.length > MAX_URL_LENGTH) {
    return { ok: false, message: "That URL is too long. Keep it under 2048 characters." };
  }
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return { ok: false, message: "That URL contains control characters." };
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "That does not look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "Only http and https links are supported." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: "URLs with embedded credentials are not supported." };
  }
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
    return { ok: false, message: "That does not look like a valid public URL." };
  }

  // Avoid short links that point at another short link on this deployment.
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) {
    try {
      const self = new URL(appUrl);
      if (parsed.origin === self.origin && parsed.pathname.startsWith("/r/")) {
        return { ok: false, message: "That URL is already a Snip link. Enter the destination instead." };
      }
    } catch {
      // APP_URL is optional and may be malformed; ignore it.
    }
  }

  return { ok: true, url: parsed.toString() };
}

export type AliasResult = { ok: true; alias: string | null } | { ok: false; message: string };

export function parseAlias(raw: unknown): AliasResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, alias: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Alias must be text." };
  }

  const alias = raw.trim();
  if (!alias) {
    return { ok: true, alias: null };
  }
  if (!CODE_PATTERN.test(alias)) {
    return {
      ok: false,
      message: "Alias must be 3-32 characters using letters, numbers, hyphens, or underscores.",
    };
  }
  if (RESERVED_CODES.has(alias.toLowerCase())) {
    return { ok: false, message: "That alias is reserved. Try another one." };
  }

  return { ok: true, alias };
}

export type ExpiryResult = { ok: true; expiresAt: string | null } | { ok: false; message: string };

export function parseExpiry(raw: unknown): ExpiryResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, expiresAt: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Expiry must be a date." };
  }

  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    return { ok: false, message: "That expiry date is not valid." };
  }

  const now = Date.now();
  if (timestamp <= now + 5_000) {
    return { ok: false, message: "Expiry must be at least a few seconds in the future." };
  }
  if (timestamp > now + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, message: "Expiry can be at most one year from now." };
  }

  return { ok: true, expiresAt: new Date(timestamp).toISOString() };
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
