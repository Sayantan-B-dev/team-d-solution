/** True when the browser reached us over HTTPS, including through a proxy. */
export function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";

  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}
