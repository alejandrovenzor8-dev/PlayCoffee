import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { User } from "@/types/auth.types";

const authStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name) ?? sessionStorage.getItem(name);
    } catch {
      try {
        return sessionStorage.getItem(name);
      } catch {
        return null;
      }
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      return;
    } catch {
      sessionStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {}
    try {
      sessionStorage.removeItem(name);
    } catch {}
  },
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        if (typeof window !== "undefined") {
          authStorage.removeItem("accessToken");
          authStorage.removeItem("refreshToken");
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: "playcoffee-auth",
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
