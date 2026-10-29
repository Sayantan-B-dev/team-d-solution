import type { Summary, User } from "@/lib/types";

const TAGS = ["JWT auth", "Cache", "Rate limit", "Alias", "Expiry"];

export default function StatsStrip({ user, summary }: { user: User | null; summary: Summary }) {
  return (
    <div className="strip">
      <div>
        <span className="label">{user ? "Your account" : "Account"}</span>
        <span className="who" title={user?.name ?? undefined}>
          {user ? user.name : "Signed out"}
        </span>
        {user?.role === "admin" ? (
          <span className="tag on" style={{ marginLeft: 8 }}>
            Admin
          </span>
        ) : null}
      </div>
      <div>
        <span className="big">{summary.linkCount.toLocaleString("en-US")}</span>
        <span className="label">links created</span>
      </div>
      <div>
        <span className="big">{summary.totalClicks.toLocaleString("en-US")}</span>
        <span className="label">total clicks</span>
      </div>
      <div>
        <span className="big">{summary.uniqueVisitors.toLocaleString("en-US")}</span>
        <span className="label">unique visitors</span>
      </div>
      <div>
        <span className="label tags-label">Core + bonus</span>
        <div className="tags">
          {TAGS.map((tag) => (
            <span className="tag on" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
