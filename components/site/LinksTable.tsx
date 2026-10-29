"use client";

import type { LinkRecord } from "@/lib/types";
import Countdown from "@/components/ui/Countdown";

type Props = {
  links: LinkRecord[] | null;
  loading: boolean;
  error: string | null;
  selectedCode: string | null;
  deletingCode: string | null;
  onSelect: (code: string) => void;
  onCopy: (text: string, message?: string) => void;
  onDelete: (code: string) => void;
  onRetry: () => void;
};

function isExpired(link: LinkRecord): boolean {
  return Boolean(link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now());
}

export default function LinksTable({
  links,
  loading,
  error,
  selectedCode,
  deletingCode,
  onSelect,
  onCopy,
  onDelete,
  onRetry,
}: Props) {
  if (loading && links === null) {
    return (
      <div aria-busy="true" aria-label="Loading your links">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty" role="alert">
        Could not load your links.
        <br />
        {error}
        <div className="empty-action">
          <button className="pill sm ghost" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!links || links.length === 0) {
    return (
      <div className="empty">
        No links yet.
        <br />
        Shorten one above to start collecting clicks.
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Link</th>
            <th scope="col">Clicks</th>
            <th scope="col">Unique</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const expired = isExpired(link);

            return (
              <tr
                key={link.code}
                className={link.code === selectedCode ? "sel" : undefined}
                onClick={() => onSelect(link.code)}
              >
                <td>
                  <span className="short">/r/{link.code}</span>
                  <span className="orig" title={link.url}>
                    {link.url}
                  </span>
                </td>
                <td>{link.totalClicks.toLocaleString("en-US")}</td>
                <td>{link.uniqueClicks.toLocaleString("en-US")}</td>
                <td>
                  <span className={`badge ${expired ? "exp" : "live"}`}>
                    {expired ? "Expired" : "Live"}
                  </span>
                  {link.expiresAt ? (
                    <span className="orig countdown">
                      <Countdown expiresAt={link.expiresAt} /> left
                    </span>
                  ) : null}
                </td>
                <td>
                  <div className="acts">
                    <button
                      className="pill sm ghost"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(link.code);
                      }}
                    >
                      Stats
                    </button>
                    <button
                      className="pill sm ghost"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopy(link.shortUrl, "Short link copied");
                      }}
                    >
                      Copy
                    </button>
                    <button
                      className="pill sm ghost"
                      type="button"
                      aria-label={`Delete /r/${link.code}`}
                      disabled={deletingCode === link.code}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(link.code);
                      }}
                    >
                      {deletingCode === link.code ? "…" : "✕"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
