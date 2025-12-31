"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  startLocalTimer,
  stopLocalTimer,
  getRunningEntry,
} from "@/lib/localStorage/localTimerService";

/**
 * Client component that handles URL action parameters for starting/stopping local timers
 * Used on the root page when user is not authenticated
 */
function TimerActionHandlerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "start") {
      startLocalTimer();
      // Remove the action parameter from URL
      router.replace("/");
    } else if (action === "stop") {
      const running = getRunningEntry();
      if (running) {
        stopLocalTimer(running.id);
      }
      // Remove the action parameter from URL
      router.replace("/");
    }
  }, [searchParams, router]);

  return null; // This component doesn't render anything
}

export default function TimerActionHandler() {
  return (
    <Suspense fallback={null}>
      <TimerActionHandlerInner />
    </Suspense>
  );
}

