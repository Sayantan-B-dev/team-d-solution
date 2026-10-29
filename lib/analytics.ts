import { createHmac } from "node:crypto";

export type Device = "mobile" | "tablet" | "desktop";

export function deviceFromUserAgent(userAgent: string | null): Device {
  if (!userAgent) return "desktop";

  const value = userAgent.toLowerCase();
  const isTablet =
    /ipad|tablet|kindle|playbook|silk/.test(value) ||
    (/android/.test(value) && !/mobile/.test(value));
  if (isTablet) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|windows phone/.test(value)) return "mobile";
  return "desktop";
}

export function browserFromUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Other";
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/OPR\/|Opera/.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Other";
}

export function referrerHost(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host || "Direct";
  } catch {
    return "Direct";
  }
}

export function visitorFingerprint(ip: string, userAgent: string | null): string {
  const secret = process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET || "dlinkit-dev-only";
  return createHmac("sha256", secret).update(`${ip}|${userAgent ?? ""}`).digest("hex");
}
