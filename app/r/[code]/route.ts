import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { deviceFromUserAgent, referrerHost, visitorFingerprint } from "@/lib/analytics";
import { isCodeShape } from "@/lib/links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cacheRedirect, getCachedRedirect, invalidateRedirect } from "@/lib/redirect-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlPage(
  status: number,
  title: string,
  message: string,
  code?: string,
  extraHeaders?: Record<string, string>
) {
  const safeCode = code ? code.replace(/[^a-zA-Z0-9_-]/g, "") : "";
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — // Snip</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/css/tokens.css" />
<link rel="stylesheet" href="/css/base.css" />
<script>(function(){try{var t=localStorage.getItem("snip_theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();</script>
<style>
  body { background: var(--frame); }
  .screen {
    display: grid;
    place-items: center;
    min-height: calc(100vh - 28px);
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 20px;
    border: 1px solid var(--line);
    background: var(--bg);
    text-align: center;
  }
  .inner { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 520px; }
  .mark { font-family: var(--mono); font-size: 15px; font-weight: 700; }
  .stripe { width: 44px; height: 4px; border-radius: 2px; background: var(--accent); }
  h1 { font-family: var(--display); font-size: clamp(30px, 6vw, 48px); font-weight: 500; letter-spacing: -.02em; line-height: 1.08; }
  p { margin: 0; color: var(--muted); font-family: var(--mono); font-size: 12px; line-height: 1.7; }
  .path { padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; font-family: var(--mono); font-size: 12px; }
  .back { margin-top: 6px; }
</style>
</head>
<body>
  <main class="screen">
    <div class="inner">
      <span class="mark">// Snip</span>
      <span class="stripe" aria-hidden="true"></span>
      <h1>${title}</h1>
      <p>${message}</p>
      ${safeCode ? `<span class="path">/r/${safeCode}</span>` : ""}
      <a class="pill back" href="/">Back to Snip ↗</a>
    </div>
  </main>
</body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!isCodeShape(code)) {
    return htmlPage(404, "Link not found", "That short link does not exist. It may have been deleted or mistyped.");
  }

  const ip = clientIp(req);
  const limit = rateLimit(`redirect:${ip}`, 120, 60_000);
  if (!limit.ok) {
    return htmlPage(
      429,
      "Too many requests",
      "Slow down for a moment, then try the link again.",
      undefined,
      limit.headers
    );
  }

  const now = Date.now();
  let cacheHit = false;
  let target = getCachedRedirect(code, now);

  if (target) {
    cacheHit = true;
  } else {
    let row: { url: string; expires_at: Date | null } | undefined;

    try {
      const result = await db<{ url: string; expires_at: Date | null }>(
        "select url, expires_at from links where code = $1",
        [code]
      );
      row = result.rows[0];
    } catch (error) {
      console.error("Redirect lookup failed:", error instanceof Error ? error.message : "unknown error");
      return htmlPage(503, "Temporarily unavailable", "We could not look up that link right now. Please try again.");
    }

    if (!row) {
      return htmlPage(404, "Link not found", "That short link does not exist. It may have been deleted or mistyped.", code);
    }

    target = cacheRedirect(code, row.url, row.expires_at ? row.expires_at.getTime() : null);
  }

  if (target.expiresAt !== null && target.expiresAt <= now) {
    invalidateRedirect(code);
    return htmlPage(410, "Link expired", "This short link is no longer active.", code);
  }

  const userAgent = req.headers.get("user-agent");

  try {
    await db(
      `insert into clicks (link_id, referrer, user_agent, device, visitor_hash)
       select id, $2, $3, $4, $5 from links where code = $1`,
      [
        code,
        referrerHost(req.headers.get("referer")),
        userAgent ? userAgent.slice(0, 512) : null,
        deviceFromUserAgent(userAgent),
        visitorFingerprint(ip, userAgent),
      ]
    );
  } catch (error) {
    console.error("Click tracking failed:", error instanceof Error ? error.message : "unknown error");
  }

  let destination: URL;
  try {
    destination = new URL(target.url);
    if (destination.protocol !== "http:" && destination.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    invalidateRedirect(code);
    return htmlPage(500, "Link misconfigured", "This short link points to an unsupported destination.");
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      // A redirect must be re-requested so every click is recorded.
      "cache-control": "no-store",
      "x-redirect-cache": cacheHit ? "hit" : "miss",
      ...limit.headers,
    },
  });
}
