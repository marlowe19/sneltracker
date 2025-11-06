"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error for debugging
    console.error("Error caught by error boundary:", error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-10 h-10 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Oeps, er ging iets mis
        </h1>
        <p className="text-gray-600 mb-2 text-lg">
          De service is tijdelijk niet beschikbaar.
        </p>
        <p className="text-gray-500 mb-8 text-sm">
          We werken eraan om dit zo snel mogelijk op te lossen. Probeer het over
          een paar minuten opnieuw.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full bg-[#008eff] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#0077cc] transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Probeer opnieuw
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
          >
            Terug naar startpagina
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Als dit probleem aanhoudt, neem dan contact met ons op.
          </p>
        </div>
      </div>
    </main>
  );
}
