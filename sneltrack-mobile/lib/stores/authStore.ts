// lib/stores/authStore.ts
import { create } from "zustand";
import type { ApiUser } from "../api/types";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: ApiUser | null;
  setAuthenticated: (user: ApiUser) => void;
  setUnauthenticated: () => void;
  setChecking: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "unknown",
  user: null,
  setAuthenticated: (user) => set({ status: "authenticated", user }),
  setUnauthenticated: () => set({ status: "unauthenticated", user: null }),
  setChecking: () => set({ status: "unknown" }),
}));
