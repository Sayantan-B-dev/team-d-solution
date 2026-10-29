"use client";

import { useEffect, useState } from "react";

type Props = {
  expiresAt: string | null;
  className?: string;
  empty?: string;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function Countdown({ expiresAt, className, empty = "Never" }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!expiresAt) {
    return <span className={className}>{empty}</span>;
  }

  // Avoid a server/client hydration mismatch: Date.now() is client-only here.
  if (now === null) {
    return (
      <span className={className} suppressHydrationWarning>
        …
      </span>
    );
  }

  const target = new Date(expiresAt).getTime();
  const remaining = target - now;

  if (!Number.isFinite(target)) {
    return <span className={className}>{empty}</span>;
  }

  if (remaining <= 0) {
    return (
      <span className={className} style={{ color: "var(--danger, #c0392b)" }}>
        Expired
      </span>
    );
  }

  return (
    <span className={className} title={new Date(expiresAt).toLocaleString()}>
      {formatRemaining(remaining)}
    </span>
  );
}
