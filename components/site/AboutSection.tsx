export default function AboutSection() {
  return (
    <section className="dash about" id="about">
      <div className="sec-h">
        <div>
          <span className="label">About</span>
          <h2>How it works</h2>
        </div>
      </div>

      <p className="lead">
        Create a link while signed in, share <span className="mono">/r/your-code</span>, and every
        visit is recorded in PostgreSQL with its timestamp, device, browser and referrer.
        Sessions are HTTP-only JWTs issued after Google sign-in, redirects are served through a
        short-lived cache, and link creation is rate limited. Custom aliases and expiry dates are
        supported, and unique visitors are counted from a hashed fingerprint — raw IP addresses
        are never stored.
      </p>

      <p className="flow">shorten → redirect → track → stats · Next.js · Neon Postgres · Google OAuth</p>
    </section>
  );
}
