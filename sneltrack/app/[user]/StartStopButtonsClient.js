"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StartStopButtonsClient({ user, onStopClick }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  async function handle(action) {
    setIsLoading(true);

    // If stopping, immediately notify parent to freeze counters
    if (action === "stop" && onStopClick) {
      onStopClick(new Date().toISOString());
    }

    try {
      await fetch(`/${encodeURIComponent(user)}/${action}`, { method: "POST" });
    } finally {
      setIsLoading(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => handle("start")}
        className="btn w-full text-base sm:text-lg py-4 rounded-xl bg-[#008eff] disabled:opacity-60"
        disabled={isLoading || isPending}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
        </svg>
        <span>Start</span>
      </button>

      <button
        type="button"
        onClick={() => handle("stop")}
        className="btn btn-secondary w-full text-base sm:text-lg py-4 rounded-xl disabled:opacity-60"
        disabled={isLoading || isPending}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
        </svg>
        <span>Stop</span>
      </button>
    </div>
  );
}
