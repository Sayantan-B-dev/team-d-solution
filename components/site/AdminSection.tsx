"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { StatsRange, User } from "@/lib/types";
import ClickChart from "@/components/ui/ClickChart";
import Countdown from "@/components/ui/Countdown";

type Overview = {
  totals: {
    users: number;
    admins: number;
    links: number;
    clicks: number;
    uniqueVisitors: number;
    last24h: number;
  };
  series: Array<{ bucket: string; clicks: number }>;
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: "user" | "admin";
    createdAt: string;
    linkCount: number;
    clickCount: number;
    lastClick: string | null;
  }>;
  links: Array<{
    code: string;
    url: string;
    ownerEmail: string;
    ownerName: string | null;
    createdAt: string;
    expiresAt: string | null;
    totalClicks: number;
    uniqueClicks: number;
  }>;
  recent: Array<{
    clickedAt: string;
    code: string;
    device: string;
    browser: string;
    referrer: string;
  }>;
};

type Props = {
  user: User | null;
  onNotify: (message: string) => void;
};

const CHART_RANGE: StatsRange = "7d";

export default function AdminSection({ user, onNotify }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/overview${fresh ? "?fresh=1" : ""}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.message ?? "Could not load the admin overview.");
      }

      setData(body as Overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the admin overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user, load]);

  const act = useCallback(
    async (key: string, url: string, init: RequestInit, message: string) => {
      setBusy(key);

      try {
        const response = await fetch(url, init);
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body.message ?? "The action failed.");
        }

        onNotify(message);
        await load(true);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : "The action failed.");
      } finally {
        setBusy(null);
      }
    },
    [load, onNotify]
  );

  if (!user || user.role !== "admin") return null;

  return (
    <section className="dash admin" id="admin">
      <div className="sec-h">
        <div>
          <span className="label">Admin console</span>
          <h2>Everything</h2>
        </div>
        <div className="acts">
          <span className="label">All users · all links · all clicks</span>
          <button
            className="pill sm ghost"
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="empty" role="alert">
          Could not load the admin console.
          <br />
          {error}
          <div className="empty-action">
            <button className="pill sm ghost" type="button" onClick={() => void load(true)}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {!data && loading ? (
        <div aria-busy="true" aria-label="Loading admin overview">
          <div className="skeleton skeleton-block" />
          <div className="skeleton skeleton-block" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="kpis admin-kpis">
            <div className="kpi">
              <span className="label">Users</span>
              <div className="big">{data.totals.users.toLocaleString("en-US")}</div>
              <span className="label">{data.totals.admins} admin(s)</span>
            </div>
            <div className="kpi">
              <span className="label">Links</span>
              <div className="big">{data.totals.links.toLocaleString("en-US")}</div>
            </div>
            <div className="kpi">
              <span className="label">Clicks</span>
              <div className="big">{data.totals.clicks.toLocaleString("en-US")}</div>
            </div>
            <div className="kpi">
              <span className="label">Unique</span>
              <div className="big">{data.totals.uniqueVisitors.toLocaleString("en-US")}</div>
            </div>
            <div className="kpi">
              <span className="label">Last 24h</span>
              <div className="big">{data.totals.last24h.toLocaleString("en-US")}</div>
            </div>
          </div>

          <div className="admin-block">
            <div className="row chart-head">
              <span className="label">Platform clicks · last 14 days</span>
              <span className="label muted">
                {data.series.reduce((sum, point) => sum + point.clicks, 0).toLocaleString("en-US")}{" "}
                total
              </span>
            </div>
            <ClickChart
              series={data.series}
              range={CHART_RANGE}
              total={data.series.reduce((sum, point) => sum + point.clicks, 0)}
            />
          </div>

          <div className="admin-block">
            <div className="row chart-head">
              <span className="label">Users</span>
              <span className="label muted">{data.users.length} shown</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Role</th>
                    <th scope="col">Links</th>
                    <th scope="col">Clicks</th>
                    <th scope="col">Last click</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((row) => {
                    const nextRole = row.role === "admin" ? "user" : "admin";
                    const key = `user-${row.id}`;

                    return (
                      <tr key={row.id}>
                        <td>
                          <span className="short">{row.name || row.email}</span>
                          <span className="orig" title={row.email}>
                            {row.email}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${row.role === "admin" ? "live" : "exp"}`}>
                            {row.role}
                          </span>
                        </td>
                        <td>{row.linkCount.toLocaleString("en-US")}</td>
                        <td>{row.clickCount.toLocaleString("en-US")}</td>
                        <td>{row.lastClick ? formatDateTime(row.lastClick) : "—"}</td>
                        <td>
                          <div className="acts">
                            <button
                              className="pill sm ghost"
                              type="button"
                              disabled={busy === key}
                              onClick={() =>
                                void act(
                                  key,
                                  `/api/admin/users/${row.id}`,
                                  {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ role: nextRole }),
                                  },
                                  `${row.email} is now ${nextRole}.`
                                )
                              }
                            >
                              {busy === key ? "…" : nextRole === "admin" ? "Make admin" : "Make user"}
                            </button>
                            <button
                              className="pill sm ghost"
                              type="button"
                              disabled={busy === key}
                              onClick={() => {
                                if (!window.confirm(`Delete ${row.email} and all their links/clicks?`)) {
                                  return;
                                }
                                void act(
                                  key,
                                  `/api/admin/users/${row.id}`,
                                  { method: "DELETE" },
                                  `Deleted ${row.email}.`
                                );
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-block">
            <div className="row chart-head">
              <span className="label">All links</span>
              <span className="label muted">{data.links.length} shown</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Link</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Clicks</th>
                    <th scope="col">Unique</th>
                    <th scope="col">Expiry</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.links.map((row) => {
                    const key = `link-${row.code}`;
                    const extendTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

                    return (
                      <tr key={row.code}>
                        <td>
                          <span className="short">/r/{row.code}</span>
                          <span className="orig" title={row.url}>
                            {row.url}
                          </span>
                        </td>
                        <td>
                          <span className="short">{row.ownerName || row.ownerEmail}</span>
                          <span className="orig">{row.ownerEmail}</span>
                        </td>
                        <td>{row.totalClicks.toLocaleString("en-US")}</td>
                        <td>{row.uniqueClicks.toLocaleString("en-US")}</td>
                        <td>
                          <Countdown expiresAt={row.expiresAt} />
                        </td>
                        <td>
                          <div className="acts">
                            <button
                              className="pill sm ghost"
                              type="button"
                              disabled={busy === key}
                              onClick={() =>
                                void act(
                                  key,
                                  `/api/admin/links/${row.code}`,
                                  {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ expiresAt: extendTo }),
                                  },
                                  `Extended /r/${row.code} by 30 days.`
                                )
                              }
                            >
                              +30d
                            </button>
                            <button
                              className="pill sm ghost"
                              type="button"
                              disabled={busy === key}
                              onClick={() =>
                                void act(
                                  key,
                                  `/api/admin/links/${row.code}`,
                                  {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ expiresAt: null }),
                                  },
                                  `Cleared the expiry on /r/${row.code}.`
                                )
                              }
                            >
                              No expiry
                            </button>
                            <button
                              className="pill sm ghost"
                              type="button"
                              disabled={busy === key}
                              onClick={() => {
                                if (!window.confirm(`Delete /r/${row.code}?`)) return;
                                void act(
                                  key,
                                  `/api/admin/links/${row.code}`,
                                  { method: "DELETE" },
                                  `Deleted /r/${row.code}.`
                                );
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-block">
            <div className="row chart-head">
              <span className="label">Recent clicks · all links</span>
            </div>
            <div className="recent">
              {data.recent.length === 0 ? (
                <span className="recent-empty">No clicks recorded yet.</span>
              ) : (
                data.recent.map((click, index) => (
                  <div key={`${click.clickedAt}-${index}`}>
                    <span>{formatDateTime(click.clickedAt)}</span>
                    <span>
                      /r/{click.code} · {click.device} · {click.browser}
                    </span>
                    <span title={click.referrer}>{click.referrer}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
