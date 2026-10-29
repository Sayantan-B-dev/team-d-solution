"use client";

import { formatDateTime } from "@/lib/format";
import type { LinkRecord, Stats, StatsRange, User } from "@/lib/types";
import BarRows from "@/components/ui/BarRows";
import ClickChart from "@/components/ui/ClickChart";
import Countdown from "@/components/ui/Countdown";
import SegmentedControl from "@/components/ui/SegmentedControl";

const RANGE_OPTIONS: Array<{ value: StatsRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

function deviceLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

type Props = {
  user: User | null;
  links: LinkRecord[] | null;
  selectedCode: string | null;
  stats: Stats | null;
  loading: boolean;
  error: string | null;
  range: StatsRange;
  onRange: (range: StatsRange) => void;
  onRefresh: () => void;
  onTestRedirect: (shortUrl: string) => void;
  onAuth: () => void;
};

export default function AnalyticsPanel({
  user,
  links,
  selectedCode,
  stats,
  loading,
  error,
  range,
  onRange,
  onRefresh,
  onTestRedirect,
  onAuth,
}: Props) {
  if (!user) {
    return (
      <div className="empty">
        Log in to see click analytics
        <br />
        for your links.
        <div className="empty-action">
          <button className="pill sm" type="button" onClick={onAuth}>
            Log in ↗
          </button>
        </div>
      </div>
    );
  }

  const link = stats?.link ?? links?.find((item) => item.code === selectedCode) ?? null;

  if (!selectedCode || !link) {
    return (
      <div className="empty">
        Select a link to see
        <br />
        its click analytics.
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div aria-busy="true" aria-label="Loading analytics">
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="empty" role="alert">
        Could not load analytics.
        <br />
        {error}
        <div className="empty-action">
          <button className="pill sm ghost" type="button" onClick={onRefresh}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="empty">No analytics yet.</div>;
  }

  const devices = stats.devices.map((row) => ({ ...row, name: deviceLabel(row.name) }));

  return (
    <div aria-busy={loading}>
      <div className="sec-h detail-head">
        <div>
          <span className="label">Stats for</span>
          <div className="detail-code">/r/{link.code}</div>
          <div className="detail-meta">
            <span className="label">Created {formatDateTime(link.createdAt)}</span>
            <span className="label">
              {link.expiresAt ? (
                <>
                  Expires in <Countdown expiresAt={link.expiresAt} />
                </>
              ) : (
                "No expiry"
              )}
            </span>
          </div>
        </div>
        <div className="acts">
          <button
            className="pill sm"
            type="button"
            onClick={() => onTestRedirect(link.shortUrl)}
          >
            Test redirect ↗
          </button>
          <button
            className="pill sm ghost"
            type="button"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="label">Total</span>
          <div className="big">{stats.total.toLocaleString("en-US")}</div>
        </div>
        <div className="kpi">
          <span className="label">Unique</span>
          <div className="big">{stats.unique.toLocaleString("en-US")}</div>
        </div>
        <div className="kpi">
          <span className="label">Last 24h</span>
          <div className="big">{stats.last24h.toLocaleString("en-US")}</div>
        </div>
      </div>

      <div className="row chart-head">
        <span className="label">Clicks over time</span>
        <span className="label muted">{stats.rangeTotal.toLocaleString("en-US")} in range</span>
        <SegmentedControl
          label="Chart range"
          value={range}
          options={RANGE_OPTIONS}
          onChange={onRange}
        />
      </div>

      <ClickChart series={stats.series} range={range} total={stats.rangeTotal} />
      {stats.rangeTotal === 0 ? (
        <p className="chart-empty">
          No clicks in this range yet. Open the short link to record one.
        </p>
      ) : null}

      <div className="bars">
        <BarRows title="Devices" rows={devices} empty="No device data in this range." />
        <BarRows
          title="Referrers"
          rows={stats.referrers}
          empty="No referrer data in this range."
        />
      </div>

      <div className="recent">
        {stats.recent.length === 0 ? (
          <span className="recent-empty">No clicks yet — open the short link to record one.</span>
        ) : (
          stats.recent.map((click, index) => (
            <div key={`${click.clickedAt}-${index}`}>
              <span>{formatDateTime(click.clickedAt)}</span>
              <span>
                {deviceLabel(click.device)} · {click.browser}
              </span>
              <span title={click.referrer}>{click.referrer}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
