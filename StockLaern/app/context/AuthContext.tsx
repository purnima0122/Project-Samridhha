import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userName: string | null;
  email: string | null;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  isHydrated: boolean;
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
const AUTH_STORAGE_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${AUTH_STORAGE_KEY}.json`
  : null;

function getLocalStorage(): StorageLike | null {
  const host = globalThis as typeof globalThis & { localStorage?: StorageLike };
  return host.localStorage ?? null;
}

async function loadStoredAuth(): Promise<AuthState | null> {
  const storage = getLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthState;
      return parsed;
    } catch {
      return null;
    }
  }

  if (!AUTH_STORAGE_FILE) {
    return null;
  }

  try {
    const raw = await FileSystem.readAsStringAsync(AUTH_STORAGE_FILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    return parsed;
  } catch {
    return null;
  }
}

async function storeAuth(auth: AuthState) {
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } catch {
      // ignore storage errors
    }
    return;
  }

  if (!AUTH_STORAGE_FILE) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(AUTH_STORAGE_FILE, JSON.stringify(auth));
  } catch {
    // ignore storage errors
  }
}

async function clearAuth() {
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    return;
  }

  if (!AUTH_STORAGE_FILE) {
    return;
  }

  try {
    await FileSystem.deleteAsync(AUTH_STORAGE_FILE);
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasRuntimeAuthMutation = useRef(false);

  useEffect(() => {
    let active = true;
    const hydrateAuth = async () => {
      const stored = await loadStoredAuth();
      if (!active) {
        return;
      }
      setAuth((prev) => {
        if (hasRuntimeAuthMutation.current || prev.accessToken) {
          return prev;
        }
        if (!stored?.accessToken) {
          return prev;
        }
        return {
          accessToken: stored.accessToken ?? null,
          refreshToken: stored.refreshToken ?? null,
          userId: stored.userId ?? null,
          userName: stored.userName ?? null,
          email: stored.email ?? null,
        };
      });
      setIsHydrated(true);
    };

    void hydrateAuth();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      isAuthenticated: Boolean(auth.accessToken),
      isHydrated,
      signIn: ({ accessToken, refreshToken, userId, userName, email }) => {
        hasRuntimeAuthMutation.current = true;
        setIsHydrated(true);
        const next = {
          accessToken,
          refreshToken,
          userId,
          userName: userName ?? null,
          email: email ?? null,
        };
        setAuth(next);
        void storeAuth(next);
      },
      signOut: () => {
        hasRuntimeAuthMutation.current = true;
        setIsHydrated(true);
        setAuth(initialState);
        void clearAuth();
      },
      updateUser: ({ userName, email }) =>
        setAuth((prev) => {
          const resolvedUserName = userName ?? prev.userName;
          const resolvedEmail = email ?? prev.email;
          if (
            resolvedUserName === prev.userName &&
            resolvedEmail === prev.email
          ) {
            return prev;
          }
          const next = {
            ...prev,
            userName: resolvedUserName,
            email: resolvedEmail,
          };
          void storeAuth(next);
          return next;
        }),
    }),
    [auth, isHydrated],
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
