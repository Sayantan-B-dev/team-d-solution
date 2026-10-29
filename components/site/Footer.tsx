const REPO_URL = "https://github.com/Sayantan-B-dev/team-d-solution";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="foot-top">
        <div className="foot-brand">
          <span className="mark">// dlinkit</span>
          <p>
            Short links with real analytics. Every click, device and referrer comes straight
            from the database.
          </p>
        </div>

        <nav className="foot-nav" aria-label="Footer">
          <div>
            <span className="label">Product</span>
            <a href="#top">Shorten</a>
            <a href="#dashboard">Dashboard</a>
            <a href="#about">About</a>
          </div>
          <div>
            <span className="label">Project</span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
            <a href="/health" target="_blank" rel="noopener noreferrer">
              Health ↗
            </a>
            <a href="/api/auth/diagnose" target="_blank" rel="noopener noreferrer">
              Auth check ↗
            </a>
          </div>
        </nav>
      </div>

      <div className="foot-bottom">
        <span>© 2026 Team D · Hack4Haldia&apos;26</span>
        <span>Next.js · Neon Postgres · Google OAuth</span>
      </div>
    </footer>
  );
}
