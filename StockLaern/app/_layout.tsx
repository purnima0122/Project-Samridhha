import { Slot } from "expo-router";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { AuthProvider } from "./context/AuthContext";

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
      <Slot />
    </AuthProvider>
  );
}
