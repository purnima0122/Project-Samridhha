import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, LogBox, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { apiFetch } from "./lib/api";

const SUPPRESSED_NOT_MOUNTED_UPDATE =
  "Can't perform a React state update on a component that hasn't mounted yet.";

// Expo Go + React Navigation tabs can emit this known dev-only false positive.
// Filter only this exact message and keep all other console errors intact.
if (__DEV__ && !(globalThis as any).__stocklearn_error_filter_installed__) {
  (globalThis as any).__stocklearn_error_filter_installed__ = true;
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.includes(SUPPRESSED_NOT_MOUNTED_UPDATE)) {
      return;
    }
    originalConsoleError(...args);
  };
}

export default function RootLayout() {
  useEffect(() => {
    LogBox.ignoreLogs([
      SUPPRESSED_NOT_MOUNTED_UPDATE,
    ]);
  }, []);

  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

function AppGate() {
  const router = useRouter();
  const segments = useSegments();
  const {
    accessToken,
    refreshToken,
    userId,
    email,
    userName,
    isAuthenticated,
    isHydrated,
    signIn,
    signOut,
  } = useAuth();
  const [profileResolved, setProfileResolved] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  const currentRoute = useMemo(() => {
    if (segments[0] === "(tabs)") {
      return segments[1] ?? "";
    }
    return segments[0] ?? "";
  }, [segments]);

  const isAuthRoute = currentRoute === "auth";
  const isLoginOrSignupRoute = currentRoute === "login" || currentRoute === "signup";
  const isCompleteProfileRoute = currentRoute === "complete-profile";

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      setIsProfileComplete(null);
      setProfileResolved(true);
      return;
    }

    let active = true;
    const resolveProfile = async () => {
      setProfileResolved(false);
      try {
        const profile = await apiFetch<{
          isProfileComplete: boolean;
          name?: string;
          number?: string;
          address?: string;
          wardNo?: string;
        }>("/users/me", {}, accessToken);

        if (!active) return;
        const complete =
          Boolean(profile.isProfileComplete) &&
          Boolean(profile.name) &&
          Boolean(profile.number) &&
          Boolean(profile.address) &&
          Boolean(profile.wardNo);
        setIsProfileComplete(complete);
      } catch (error: any) {
        if (!active) return;
        if (error?.status === 401) {
          if (refreshToken && userId) {
            try {
              const refreshed = await apiFetch<{
                accessToken: string;
                RefreshToken: string;
              }>("/auth/refresh", {
                method: "POST",
                body: JSON.stringify({ refreshToken }),
              });
              if (!active) return;
              signIn({
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.RefreshToken,
                userId,
                email: email ?? undefined,
                userName: userName ?? undefined,
              });
              return;
            } catch {
              if (!active) return;
            }
          }
          signOut();
          setIsProfileComplete(null);
        } else {
          // Fail closed for onboarding: unresolved profile is treated as incomplete.
          setIsProfileComplete(false);
        }
      } finally {
        if (active) {
          setProfileResolved(true);
        }
      }
    };

    void resolveProfile();
    return () => {
      active = false;
    };
  }, [accessToken, email, isHydrated, refreshToken, signIn, signOut, userId, userName]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (!profileResolved) {
      return;
    }

    if (isProfileComplete === false && !isCompleteProfileRoute) {
      router.replace("/complete-profile");
      return;
    }

    if (isProfileComplete === true && (isCompleteProfileRoute || isAuthRoute || isLoginOrSignupRoute)) {
      router.replace("/dashboard");
    }
  }, [
    isAuthRoute,
    isAuthenticated,
    isCompleteProfileRoute,
    isHydrated,
    isLoginOrSignupRoute,
    isProfileComplete,
    profileResolved,
    router,
  ]);

  if (!isHydrated || (isAuthenticated && !profileResolved)) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#0B3B78" />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
});
