import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, LogBox, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  GamificationProvider,
  useGamification,
} from "./context/GamificationContext";
import BadgeCongratulations from "./components/BadgeCongratulations";

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
      <GamificationProvider>
        <AppGate />
      </GamificationProvider>
    </AuthProvider>
  );
}

function GlobalGamificationOverlays() {
  const { currentBadge, markCurrentBadgeSeen } = useGamification();

  return <BadgeCongratulations badge={currentBadge} onClose={markCurrentBadgeSeen} />;
}

function AppGate() {
  const router = useRouter();
  const segments = useSegments();
  const {
    isAuthenticated,
    isHydrated,
    isProfileResolved,
    isProfileComplete,
  } = useAuth();

  const currentRoute = useMemo<string>(() => {
    if (segments[0] === "(tabs)") {
      return segments[1] ?? "";
    }
    return segments[0] ?? "";
  }, [segments]);

  const isAuthRoute = currentRoute === "auth";
  const isLoginOrSignupRoute = currentRoute === "login" || currentRoute === "signup";
  const isProfileSetupRoute =
    currentRoute === "profile-setup" || currentRoute === "complete-profile";

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated) {
      if (isProfileSetupRoute) {
        router.replace("/login");
      }
      return;
    }

    if (!isProfileResolved) {
      return;
    }

    if (isProfileComplete === false && !isProfileSetupRoute) {
      router.replace("/profile-setup" as any);
      return;
    }

    if (isProfileComplete === true && (isProfileSetupRoute || isAuthRoute || isLoginOrSignupRoute)) {
      router.replace("/dashboard");
    }
  }, [
    isAuthRoute,
    isAuthenticated,
    isHydrated,
    isLoginOrSignupRoute,
    isProfileComplete,
    isProfileSetupRoute,
    isProfileResolved,
    router,
  ]);

  if (!isHydrated || (isAuthenticated && !isProfileResolved)) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#0B3B78" />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <GlobalGamificationOverlays />
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
});
