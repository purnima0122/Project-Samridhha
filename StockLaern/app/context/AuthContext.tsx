import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as FileSystem from "expo-file-system/legacy";
import { apiFetch } from "../lib/api";

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
  isAdmin: boolean;
};

type UserProfileResponse = {
  isProfileComplete: boolean;
  name?: string;
  email?: string;
  isAdmin?: boolean;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  isHydrated: boolean;
  isProfileResolved: boolean;
  isProfileComplete: boolean | null;
  signIn: (params: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    userName?: string | null;
    email?: string | null;
    isAdmin?: boolean | null;
  }) => void;
  signOut: () => void;
  updateUser: (params: {
    userName?: string | null;
    email?: string | null;
    isAdmin?: boolean | null;
    isProfileComplete?: boolean | null;
  }) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  userName: null,
  email: null,
  isAdmin: false,
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
      return JSON.parse(raw) as AuthState;
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
    return JSON.parse(raw) as AuthState;
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
  const [isProfileResolved, setIsProfileResolved] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const hasRuntimeAuthMutation = useRef(false);

  const applyAuthState = useCallback((next: AuthState) => {
    setAuth(next);
    void storeAuth(next);
  }, []);

  const signOut = useCallback(() => {
    hasRuntimeAuthMutation.current = true;
    setIsHydrated(true);
    setIsProfileComplete(null);
    setIsProfileResolved(true);
    setAuth(initialState);
    void clearAuth();
  }, []);

  const signIn = useCallback(
    ({
      accessToken,
      refreshToken,
      userId,
      userName,
      email,
      isAdmin,
    }: {
      accessToken: string;
      refreshToken: string;
      userId: string;
      userName?: string | null;
      email?: string | null;
      isAdmin?: boolean | null;
    }) => {
      hasRuntimeAuthMutation.current = true;
      setIsHydrated(true);
      setIsProfileComplete(null);
      setIsProfileResolved(false);

      applyAuthState({
        accessToken,
        refreshToken,
        userId,
        userName: userName ?? null,
        email: email ?? null,
        isAdmin: Boolean(isAdmin),
      });
    },
    [applyAuthState],
  );

  const updateUser = useCallback(
    ({
      userName,
      email,
      isAdmin,
      isProfileComplete: nextProfileComplete,
    }: {
      userName?: string | null;
      email?: string | null;
      isAdmin?: boolean | null;
      isProfileComplete?: boolean | null;
    }) => {
      setAuth((prev) => {
        const resolvedUserName = userName ?? prev.userName;
        const resolvedEmail = email ?? prev.email;
        const resolvedIsAdmin = isAdmin ?? prev.isAdmin;

        if (
          resolvedUserName === prev.userName &&
          resolvedEmail === prev.email &&
          resolvedIsAdmin === prev.isAdmin
        ) {
          return prev;
        }

        const next = {
          ...prev,
          userName: resolvedUserName,
          email: resolvedEmail,
          isAdmin: resolvedIsAdmin,
        };
        void storeAuth(next);
        return next;
      });

      if (typeof nextProfileComplete === "boolean") {
        setIsProfileComplete(nextProfileComplete);
        setIsProfileResolved(true);
      } else if (nextProfileComplete === null) {
        setIsProfileComplete(null);
        setIsProfileResolved(false);
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (!auth.accessToken) {
      setIsProfileComplete(null);
      setIsProfileResolved(true);
      return;
    }

    setIsProfileResolved(false);

    const applyProfile = (profile: UserProfileResponse, token = auth.accessToken) => {
      setAuth((prev) => {
        const next = {
          ...prev,
          accessToken: token,
          userName: profile.name ?? prev.userName,
          email: profile.email ?? prev.email,
          isAdmin: Boolean(profile.isAdmin ?? prev.isAdmin),
        };
        void storeAuth(next);
        return next;
      });
      setIsProfileComplete(Boolean(profile.isProfileComplete));
      setIsProfileResolved(true);
    };

    try {
      const profile = await apiFetch<UserProfileResponse>("/users/me", {}, auth.accessToken);
      applyProfile(profile);
      return;
    } catch (error: any) {
      if (error?.status === 401 && auth.refreshToken && auth.userId) {
        try {
          const refreshed = await apiFetch<{
            accessToken: string;
            RefreshToken: string;
          }>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken: auth.refreshToken }),
          });

          const refreshedToken = refreshed.accessToken;
          const refreshedRefreshToken = refreshed.RefreshToken;

          setAuth((prev) => {
            const next = {
              ...prev,
              accessToken: refreshedToken,
              refreshToken: refreshedRefreshToken,
            };
            void storeAuth(next);
            return next;
          });

          const profile = await apiFetch<UserProfileResponse>(
            "/users/me",
            {},
            refreshedToken,
          );
          applyProfile(profile, refreshedToken);
          return;
        } catch {
          signOut();
          return;
        }
      }

      // Avoid trapping valid sessions in onboarding when profile lookup fails transiently.
      setIsProfileComplete((prev) => prev ?? true);
      setIsProfileResolved(true);
    }
  }, [auth.accessToken, auth.refreshToken, auth.userId, signOut]);

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
          isAdmin: Boolean(stored.isAdmin),
        };
      });

      setIsProfileComplete(null);
      setIsProfileResolved(!stored?.accessToken);
      setIsHydrated(true);
    };

    void hydrateAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!auth.accessToken) {
      setIsProfileComplete(null);
      setIsProfileResolved(true);
      return;
    }

    void refreshProfile();
  }, [auth.accessToken, auth.refreshToken, auth.userId, isHydrated, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      isAuthenticated: Boolean(auth.accessToken),
      isHydrated,
      isProfileResolved,
      isProfileComplete,
      signIn,
      signOut,
      updateUser,
      refreshProfile,
    }),
    [
      auth,
      isHydrated,
      isProfileComplete,
      isProfileResolved,
      refreshProfile,
      signIn,
      signOut,
      updateUser,
    ],
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
