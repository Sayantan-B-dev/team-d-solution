"use client";

import { useEffect, useRef } from "react";

type Props = {
  onClose: () => void;
};

export default function AuthModal({ onClose }: Props) {
  const actionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    actionRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h3 id="auth-title">Log in</h3>
        <p>
          Continue with Google to create links and see your analytics. Snip stores only your name,
          email and avatar so your links and clicks stay yours.
        </p>
        <div className="row">
          <a ref={actionRef} className="pill" href="/api/auth/google">
            Continue with Google ↗
          </a>
          <button className="pill ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
