import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userName: string | null;
  email: string | null;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  signIn: (params: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    userName?: string | null;
    email?: string | null;
  }) => void;
  signOut: () => void;
  updateUser: (params: { userName?: string | null; email?: string | null }) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  userName: null,
  email: null,
};

const AUTH_STORAGE_KEY = "stocklearn_auth";

function loadStoredAuth(): AuthState | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    return parsed;
  } catch {
    return null;
  }
}

function storeAuth(auth: AuthState) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // ignore storage errors
  }
}

function clearAuth() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(initialState);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (stored?.accessToken) {
      setAuth({
        accessToken: stored.accessToken ?? null,
        refreshToken: stored.refreshToken ?? null,
        userId: stored.userId ?? null,
        userName: stored.userName ?? null,
        email: stored.email ?? null,
      });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      isAuthenticated: Boolean(auth.accessToken),
      signIn: ({ accessToken, refreshToken, userId, userName, email }) => {
        const next = {
          accessToken,
          refreshToken,
          userId,
          userName: userName ?? null,
          email: email ?? null,
        };
        setAuth(next);
        storeAuth(next);
      },
      signOut: () => {
        setAuth(initialState);
        clearAuth();
      },
      updateUser: ({ userName, email }) =>
        setAuth((prev) => {
          const next = {
            ...prev,
            userName: userName ?? prev.userName,
            email: email ?? prev.email,
          };
          storeAuth(next);
          return next;
        }),
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
