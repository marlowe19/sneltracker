"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppleCalendarConnectionClient({ user }) {
  const router = useRouter();
  const [checkingCalendar, setCheckingCalendar] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [formError, setFormError] = useState(null);

  // Check connection status on mount
  useEffect(() => {
    checkCalendarStatus();
  }, []);

  async function checkCalendarStatus() {
    try {
      setCheckingCalendar(true);
      setCalendarError(null);
      const res = await fetch(`/my/api/calendar/apple/status`);
      if (res.ok) {
        const data = await res.json();
        setCalendarConnected(data.isConnected);
      } else {
        setCalendarError("Kon status niet ophalen");
      }
    } catch (error) {
      console.error("Error checking calendar status:", error);
      setCalendarError("Fout bij controleren van status");
    } finally {
      setCheckingCalendar(false);
    }
  }

  async function handleConnect() {
    if (!appleId || !appPassword) {
      setFormError("Vul alle velden in");
      return;
    }

    try {
      setIsConnecting(true);
      setFormError(null);

      const res = await fetch(`/api/auth/apple-calendar/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: appleId,
          password: appPassword,
        }),
      });

      if (res.ok) {
        setCalendarConnected(true);
        setShowForm(false);
        setAppleId("");
        setAppPassword("");
        router.refresh();
      } else {
        const data = await res.json();
        setFormError(data.error || "Fout bij verbinden");
      }
    } catch (error) {
      console.error("Error connecting Apple Calendar:", error);
      setFormError("Fout bij verbinden");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      setIsDisconnecting(true);
      setCalendarError(null);

      const res = await fetch(`/api/auth/apple-calendar/disconnect`, {
        method: "POST",
      });

      if (res.ok) {
        setCalendarConnected(false);
        router.refresh();
      } else {
        setCalendarError("Fout bij loskoppelen");
      }
    } catch (error) {
      console.error("Error disconnecting Apple Calendar:", error);
      setCalendarError("Fout bij loskoppelen");
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Apple Calendar Integratie
      </h3>
      <div className="space-y-3">
        {checkingCalendar ? (
          <div className="text-sm text-gray-500">Status controleren...</div>
        ) : calendarError ? (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {calendarError}
          </div>
        ) : calendarConnected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Apple Calendar is verbonden</span>
            </div>
            <p className="text-xs text-gray-600">
              Je agenda wordt gebruikt voor projectvoorspellingen om bezette
              tijden uit te sluiten.
            </p>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-60 text-sm"
            >
              {isDisconnecting ? "Loskoppelen..." : "Loskoppelen"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Apple Calendar is niet verbonden</span>
            </div>
            <p className="text-xs text-gray-600">
              Verbind je Apple Calendar om bezette tijden uit te sluiten bij
              projectvoorspellingen.
            </p>

            {!showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] text-sm"
              >
                Verbind Apple Calendar
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Apple ID
                  </label>
                  <input
                    type="email"
                    value={appleId}
                    onChange={(e) => setAppleId(e.target.value)}
                    placeholder="jouw@email.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    App-specifiek wachtwoord
                  </label>
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Genereer een app-specifiek wachtwoord op{" "}
                    <a
                      href="https://appleid.apple.com/account/manage"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      appleid.apple.com
                    </a>
                  </p>
                </div>
                {formError && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    {formError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="flex-1 px-4 py-2 bg-[#008eff] text-white rounded-lg hover:bg-[#0073cc] disabled:opacity-60 text-sm"
                  >
                    {isConnecting ? "Verbinden..." : "Verbinden"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormError(null);
                      setAppleId("");
                      setAppPassword("");
                    }}
                    disabled={isConnecting}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-60 text-sm"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

