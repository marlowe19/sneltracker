"use client";

import { useEffect, useState } from "react";
import {
  getLocalEntries,
  clearLocalEntries,
  getLocalEntryCount,
} from "@/lib/localStorage/localTimerService";

/**
 * SyncOnLoginClient - Syncs local entries to Supabase when user is logged in
 * 
 * This component should be placed on the user's main page.
 * It checks for local entries on mount and syncs them to the user's account.
 */
export default function SyncOnLoginClient({ user }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    async function syncLocalEntries() {
      // Check if there are local entries to sync
      const localEntries = getLocalEntries();
      const stoppedEntries = localEntries.filter(e => !e.is_running);
      
      if (stoppedEntries.length === 0) {
        return;
      }

      setSyncing(true);

      try {
        const response = await fetch(
          `/${encodeURIComponent(user)}/api/sync-entries`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries: stoppedEntries }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          setSyncResult({
            success: true,
            synced: result.synced.length,
            failed: result.failed.length,
          });
          
          // Clear local entries after successful sync
          // Only clear stopped entries that were synced
          if (result.synced.length > 0) {
            clearLocalEntries();
          }
        } else {
          const error = await response.json();
          console.error("Sync failed:", error);
          setSyncResult({
            success: false,
            error: error.message || "Sync failed",
          });
        }
      } catch (error) {
        console.error("Error syncing local entries:", error);
        setSyncResult({
          success: false,
          error: error.message,
        });
      } finally {
        setSyncing(false);
      }
    }

    syncLocalEntries();
  }, [user]);

  // Show a brief toast notification if entries were synced
  if (syncing) {
    return (
      <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span>Lokale timers synchroniseren...</span>
      </div>
    );
  }

  if (syncResult?.success && syncResult.synced > 0) {
    return (
      <SyncSuccessToast 
        count={syncResult.synced} 
        onClose={() => setSyncResult(null)} 
      />
    );
  }

  return null;
}

function SyncSuccessToast({ count, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>
        {count} {count === 1 ? "timer" : "timers"} gesynchroniseerd
      </span>
    </div>
  );
}

