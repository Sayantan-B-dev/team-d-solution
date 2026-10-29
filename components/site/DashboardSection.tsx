"use client";

import type { LinkRecord, Stats, StatsRange, User } from "@/lib/types";
import AnalyticsPanel from "./AnalyticsPanel";
import LinksTable from "./LinksTable";

type Props = {
  user: User | null;
  links: LinkRecord[] | null;
  listLoading: boolean;
  listError: string | null;
  selectedCode: string | null;
  stats: Stats | null;
  statsLoading: boolean;
  statsError: string | null;
  range: StatsRange;
  deletingCode: string | null;
  onSelect: (code: string) => void;
  onCopy: (text: string, message?: string) => void;
  onDelete: (code: string) => void;
  onRetryLinks: () => void;
  onRetryStats: () => void;
  onRange: (range: StatsRange) => void;
  onTestRedirect: (shortUrl: string) => void;
  onAuth: () => void;
};

export default function DashboardSection({
  user,
  links,
  listLoading,
  listError,
  selectedCode,
  stats,
  statsLoading,
  statsError,
  range,
  deletingCode,
  onSelect,
  onCopy,
  onDelete,
  onRetryLinks,
  onRetryStats,
  onRange,
  onTestRedirect,
  onAuth,
}: Props) {
  return (
    <section className="dash" id="dashboard">
      <div className="sec-h">
        <div>
          <span className="label">Analytics</span>
          <h2>{user ? "Your links" : "Your dashboard"}</h2>
        </div>
        <span className="label">{user ? "Rate limit: 20 new links / min" : "Locked"}</span>
      </div>

      {!user ? (
        <div className="locked">
          <svg
            className="locked-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          <h3>Log in to unlock your dashboard</h3>
          <p>
            Your links, click charts, devices and referrers live here. Sign in with Google —
            guest links you already created on this browser come with you.
          </p>
          <button className="pill" type="button" onClick={onAuth}>
            Log in with Google ↗
          </button>
        </div>
      ) : (
        <div className="grid2">
          <div>
            <LinksTable
              links={links}
              loading={listLoading}
              error={listError}
              selectedCode={selectedCode}
              deletingCode={deletingCode}
              onSelect={onSelect}
              onCopy={onCopy}
              onDelete={onDelete}
              onRetry={onRetryLinks}
            />
          </div>

          <div>
            <AnalyticsPanel
              user={user}
              links={links}
              selectedCode={selectedCode}
              stats={stats}
              loading={statsLoading}
              error={statsError}
              range={range}
              onRange={onRange}
              onRefresh={onRetryStats}
              onTestRedirect={onTestRedirect}
              onAuth={onAuth}
            />
          </div>
        </div>
      )}
    </section>
  );
}
