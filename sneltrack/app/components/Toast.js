"use client";

import { createContext, useContext, useState, useEffect } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toastMessage, setToastMessage] = useState(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const toast = {
    show: (message) => {
      setToastMessage(message);
    },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-8 py-4 rounded-lg shadow-lg animate-fade-in min-w-[300px] max-w-md text-center">
          {toastMessage}
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

