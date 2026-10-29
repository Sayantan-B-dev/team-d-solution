import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell notfound">
      <span className="label">404</span>
      <h1>Page not found</h1>
      <p className="lead">
        That page does not exist. Head back, shorten a link, and watch the clicks arrive.
      </p>
      <Link className="pill" href="/">
        Back to Snip ↗
      </Link>
    </main>
  );
}
