import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./context/AuthContext";

function firstValue(value?: string | string[]): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function AuthRedirectScreen() {
  const params = useLocalSearchParams<{
    accessToken?: string | string[];
    refreshToken?: string | string[];
    userId?: string | string[];
    email?: string | string[];
    name?: string | string[];
    isAdmin?: string | string[];
  }>();
  const { accessToken, refreshToken, userId, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  const authPayload = useMemo(
    () => ({
      accessToken: firstValue(params.accessToken),
      refreshToken: firstValue(params.refreshToken),
      userId: firstValue(params.userId),
      email: firstValue(params.email),
      userName: firstValue(params.name),
      isAdmin: firstValue(params.isAdmin),
    }),
    [params],
  );

  useEffect(() => {
    if (processedRef.current) {
      return;
    }

    if (!authPayload.accessToken || !authPayload.refreshToken || !authPayload.userId) {
      if (accessToken && refreshToken && userId) {
        processedRef.current = true;
        return;
      }
      setError("Missing login details from Google redirect. Please try again.");
      return;
    }

    if (
      accessToken === authPayload.accessToken &&
      refreshToken === authPayload.refreshToken &&
      userId === authPayload.userId
    ) {
      processedRef.current = true;
      return;
    }

    processedRef.current = true;
    signIn({
      accessToken: authPayload.accessToken,
      refreshToken: authPayload.refreshToken,
      userId: authPayload.userId,
      email: authPayload.email,
      userName: authPayload.userName,
      isAdmin: authPayload.isAdmin === "true",
    });
  }, [accessToken, authPayload, refreshToken, signIn, userId]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in Failed</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color="#0B3B78" />
          <Text style={styles.title}>Completing sign-in...</Text>
          <Text style={styles.subtitle}>Please wait while we finish your login.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0F172A", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#64748B", textAlign: "center" },
});
