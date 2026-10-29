"use client";

import { useState, type FormEvent } from "react";
import type { LinkRecord, User } from "@/lib/types";
import HeroArtwork from "./HeroArtwork";

type Props = {
  user: User | null;
  authError: string | null;
  onCreated: (link: LinkRecord) => void;
  onRequestAuth: () => void;
  onCopy: (text: string, message?: string) => void;
  onViewStats: (code: string) => void;
};

export default function Hero({
  user,
  authError,
  onCreated,
  onRequestAuth,
  onCopy,
  onViewStats,
}: Props) {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LinkRecord | null>(null);
  // Guests get 5 links per day; the server is the source of truth and reports
  // the remainder after every create.
  const [guestRemaining, setGuestRemaining] = useState<number | null>(null);
  const [guestLimited, setGuestLimited] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (!user && guestLimited) {
      onRequestAuth();
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Paste a URL to shorten.");
      return;
    }

    const trimmedAlias = alias.trim();
    if (trimmedAlias && !/^[A-Za-z0-9_-]{3,32}$/.test(trimmedAlias)) {
      setError("Alias: 3–32 letters, numbers, hyphens or underscores.");
      return;
    }

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setError("Expiry must be in the future.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          alias: trimmedAlias || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Out of free guest links: offer sign-in instead of an error only.
        if (data.error === "guest_limit") {
          setGuestRemaining(0);
          setGuestLimited(true);
          return;
        }
        throw new Error(data.message ?? "Could not create the link.");
      }

      if (data.guest) {
        setGuestRemaining(data.guest.remaining);
        setGuestLimited(data.guest.remaining === 0);
      }

      const link: LinkRecord = {
        code: data.code,
        url: data.url,
        shortUrl: data.shortUrl,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt ?? null,
        totalClicks: 0,
        uniqueClicks: 0,
      };

      setResult(link);
      setUrl("");
      setAlias("");
      setExpiresAt("");
      onCreated(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hero" id="top">
      <div className="hero-l">
        {authError ? (
          <p className="auth-alert" role="alert">
            {authError}
          </p>
        ) : null}

        <div className="h1wrap">
          <svg className="spark" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1c.6 6.4 4.6 10.4 11 11-6.4.6-10.4 4.6-11 11-.6-6.4-4.6-10.4-11-11 6.4-.6 10.4-4.6 11-11z" />
          </svg>
          <h1>
            Short links.
            <br />
            Real analytics.
          </h1>
        </div>

        <p className="lead">
          Shorten any URL, share it anywhere, and see exactly who clicks — time, device and
          referrer for every single visit.
        </p>

        <form className="shorten" onSubmit={handleSubmit} autoComplete="off" noValidate>
          <div className="field full">
            <label htmlFor="destination">Destination URL</label>
            <input
              id="destination"
              type="url"
              inputMode="url"
              placeholder="https://example.com/very/long/campaign-link"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="alias">Custom alias (optional)</label>
            <input
              id="alias"
              type="text"
              placeholder="summer-sale"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              maxLength={32}
            />
          </div>

          <div className="field">
            <label htmlFor="expiry">Expires (optional)</label>
            <input
              id="expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>

          <div className="actions">
            {!user && guestLimited ? (
              <button className="pill" type="button" onClick={onRequestAuth}>
                Log in to keep shortening
              </button>
            ) : (
              <button className="pill" type="submit" disabled={submitting}>
                {submitting ? "Shortening…" : "Shorten link"}
              </button>
            )}
            <p className="err" role="status">
              {error}
            </p>
          </div>

          {!user && guestLimited ? (
            <div className="guest-limit" role="alert">
              <b>Daily free limit reached.</b>
              <span>
                You have used all 5 free links for today. Log in with Google to keep
                shortening — the links you already made on this browser move with you.
              </span>
              <div>
                <button className="pill sm" type="button" onClick={onRequestAuth}>
                  Log in with Google ↗
                </button>
              </div>
            </div>
          ) : null}

          {!user && !guestLimited && guestRemaining !== null ? (
            <p className="label guest-quota">
              {guestRemaining} of 5 free links left today · no account needed
            </p>
          ) : null}
        </form>

        {result ? (
          <div className="result" aria-live="polite">
            <span className="label">Your short link</span>
            <div className="url">{result.shortUrl}</div>
            <div className="row">
              <button
                className="pill sm"
                type="button"
                onClick={() => onCopy(result.shortUrl, "Short link copied")}
              >
                Copy
              </button>
              {user ? (
                <button
                  className="pill sm ghost"
                  type="button"
                  onClick={() => onViewStats(result.code)}
                >
                  View stats
                </button>
              ) : (
                <button className="pill sm ghost" type="button" onClick={onRequestAuth}>
                  Log in for analytics
                </button>
              )}
            </div>
            {!user ? (
              <p className="label">
                Guest link · {guestRemaining ?? 0} of 5 free links left today. Log in to
                keep it in your dashboard.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="note">
          <b>*</b>
          <span>
            {user
              ? "Free to use. Every number in your dashboard comes from the database."
              : "No account needed: 5 free links per day. Log in with Google to unlock the dashboard, keep your links and see every click."}
          </span>
        </div>
      </div>

      <HeroArtwork />
    </div>
  );
}
