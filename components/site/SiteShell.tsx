"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkRecord, Stats, StatsRange, Summary, User } from "@/lib/types";
import AboutSection from "./AboutSection";
import AdminSection from "./AdminSection";
import AuthModal from "./AuthModal";
import DashboardSection from "./DashboardSection";
import Footer from "./Footer";
import Hero from "./Hero";
import NavBar from "./NavBar";
import StatsStrip from "./StatsStrip";
import Toast from "./Toast";

const EMPTY_SUMMARY: Summary = {
  linkCount: 0,
  totalClicks: 0,
  uniqueVisitors: 0,
  last24h: 0,
};

type Props = {
  user: User | null;
  authError: string | null;
};

export default function SiteShell({ user, authError }: Props) {
  const [links, setLinks] = useState<LinkRecord[] | null>(user ? null : []);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [listLoading, setListLoading] = useState(Boolean(user));
  const [listError, setListError] = useState<string | null>(null);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [range, setRange] = useState<StatsRange>("7d");

  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastId = useRef(0);

  const notify = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadLinks = useCallback(async (selectAfter?: string, silent = false) => {
    if (!silent) {
      setListLoading(true);
      setListError(null);
    }

    try {
      const response = await fetch(`/api/links${silent ? "?fresh=1" : ""}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? "Could not load your links.");
      }

      const nextLinks: LinkRecord[] = data.links ?? [];
      setLinks(nextLinks);
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setSelectedCode((current) => {
        if (selectAfter) return selectAfter;
        if (current && nextLinks.some((link) => link.code === current)) return current;
        return nextLinks[0]?.code ?? null;
      });
    } catch (error) {
      if (!silent) {
        setListError(error instanceof Error ? error.message : "Could not load your links.");
        setLinks((current) => current ?? []);
      }
    } finally {
      if (!silent) setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadLinks();
  }, [user, loadLinks]);

  useEffect(() => {
    if (!user || !selectedCode) {
      setStats(null);
      setStatsLoading(false);
      setStatsError(null);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);

    fetch(
      `/api/stats/${encodeURIComponent(selectedCode)}?range=${range}${statsVersion ? "&fresh=1" : ""}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message ?? "Could not load analytics.");
        }
        return data as Stats;
      })
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setLinks((current) =>
          current
            ? current.map((link) =>
                link.code === data.link.code
                  ? { ...link, totalClicks: data.total, uniqueClicks: data.unique }
                  : link
              )
            : current
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatsError(error instanceof Error ? error.message : "Could not load analytics.");
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, selectedCode, range, statsVersion]);

  const handleSelect = useCallback((code: string) => {
    setStats(null);
    setSelectedCode(code);
  }, []);

  const handleViewStats = useCallback(
    (code: string) => {
      handleSelect(code);
      document.getElementById("dashboard")?.scrollIntoView({ block: "start" });
    },
    [handleSelect]
  );

  const handleCreated = useCallback(
    (link: LinkRecord) => {
      setLinks((current) => [link, ...(current ?? []).filter((item) => item.code !== link.code)]);
      setSummary((current) => ({ ...current, linkCount: current.linkCount + 1 }));
      setStats(null);
      setSelectedCode(link.code);
      notify(`/r/${link.code} is live. Share it and watch the clicks land.`);
      void loadLinks(link.code, true);
    },
    [notify, loadLinks]
  );

  const handleCopy = useCallback(
    async (text: string, message = "Copied") => {
      try {
        await navigator.clipboard.writeText(text);
        notify(message);
        return;
      } catch {
        // Fall through to the legacy path for non-secure origins.
      }

      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();

      try {
        document.execCommand("copy");
        notify(message);
      } catch {
        notify("Copy failed. Select the link text and copy it manually.");
      }

      area.remove();
    },
    [notify]
  );

  const handleDelete = useCallback(
    async (code: string) => {
      const confirmed = window.confirm(
        `Delete /r/${code}? All of its click history will be removed.`
      );
      if (!confirmed) return;

      setDeletingCode(code);

      try {
        const response = await fetch(`/api/links/${encodeURIComponent(code)}`, {
          method: "DELETE",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message ?? "Could not delete the link.");
        }

        setLinks((current) => (current ?? []).filter((link) => link.code !== code));
        if (selectedCode === code) {
          setSelectedCode(null);
          setStats(null);
        }
        notify(`Deleted /r/${code}.`);
        void loadLinks(undefined, true);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not delete the link.");
      } finally {
        setDeletingCode(null);
      }
    },
    [selectedCode, notify, loadLinks]
  );

  const handleAuth = useCallback(async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      notify("Could not sign out. Please try again.");
    }
  }, [user, notify]);

  const handleTestRedirect = useCallback(
    (shortUrl: string) => {
      window.open(shortUrl, "_blank", "noopener,noreferrer");
      notify("Opened in a new tab. Refreshing stats after the redirect.");
      window.setTimeout(() => {
        setStatsVersion((version) => version + 1);
        void loadLinks(undefined, true);
      }, 2200);
    },
    [notify, loadLinks]
  );

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="shell">
        <NavBar user={user} onAuth={handleAuth} />

        <main id="main" tabIndex={-1}>
          <Hero
            user={user}
            authError={authError}
            onCreated={handleCreated}
            onRequestAuth={() => setAuthOpen(true)}
            onCopy={handleCopy}
            onViewStats={handleViewStats}
          />

          <StatsStrip user={user} summary={summary} />

          <DashboardSection
            user={user}
            links={links}
            listLoading={listLoading}
            listError={listError}
            selectedCode={selectedCode}
            stats={stats}
            statsLoading={statsLoading}
            statsError={statsError}
            range={range}
            deletingCode={deletingCode}
            onSelect={handleSelect}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onRetryLinks={() => void loadLinks()}
            onRetryStats={() => setStatsVersion((version) => version + 1)}
            onRange={setRange}
            onTestRedirect={handleTestRedirect}
            onAuth={() => setAuthOpen(true)}
          />

          <AdminSection user={user} onNotify={notify} />

          <AboutSection />
        </main>

        <Footer />
      </div>

      {authOpen ? <AuthModal onClose={closeAuth} /> : null}
      {toast ? <Toast key={toast.id} text={toast.text} /> : null}
    </>
  );
}
