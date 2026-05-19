"use client";

import { createContext, useContext, useState, useEffect } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastState) {
      const timer = setTimeout(() => {
        setToastState(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastState]);

  const toast = {
    /** @param {string} message @param {{ variant?: 'success' | 'error' }} [opts] */
    show: (message, opts = {}) => {
      setToastState({
        message,
        variant: opts.variant === "error" ? "error" : "success",
      });
    },
  };

  const bgClass =
    toastState?.variant === "error" ? "bg-red-500" : "bg-green-500";

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification */}
      {toastState && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bgClass} text-white px-8 py-4 rounded-lg shadow-lg animate-fade-in min-w-[300px] max-w-md text-center`}
        >
          {toastState.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

