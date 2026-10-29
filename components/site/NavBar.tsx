"use client";

import type { User } from "@/lib/types";
import ThemeToggle from "./ThemeToggle";

type Props = {
  user: User | null;
  onAuth: () => void;
};

export default function NavBar({ user, onAuth }: Props) {
  const initial = user?.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <nav aria-label="Primary">
      <a className="logo" href="#top">
        // Snip
      </a>

      <div className="nav-r">
        <a className="hide-m" href="#top">
          Shorten
        </a>
        <a className="hide-m" href="#dashboard">
          Dashboard
        </a>
        <a className="hide-m" href="#about">
          About
        </a>
        {user?.role === "admin" ? (
          <a className="hide-m" href="#admin">
            Admin
          </a>
        ) : null}

        <ThemeToggle />

        {user ? (
          <span className="nav-user">
            {user.avatarUrl ? (
              // Google avatar host; a plain img avoids remote-pattern config.
              <img
                className="nav-avatar"
                src={user.avatarUrl}
                alt=""
                width={28}
                height={28}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="nav-avatar nav-avatar-fallback" aria-hidden="true">
                {initial}
              </span>
            )}
            <span className="label">{user.name}</span>
          </span>
        ) : null}

        <button className="pill sm" type="button" onClick={onAuth}>
          {user ? "Log out ↗" : "Log in ↗"}
        </button>
      </div>
    </nav>
  );
}
