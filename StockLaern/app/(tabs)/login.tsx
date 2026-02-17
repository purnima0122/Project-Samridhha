import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { apiFetch, API_BASE_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

function getAuthRedirectUrl() {
  return Linking.createURL("auth");
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, updateUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const finalizeLogin = async (token: string) => {
    const profile = await apiFetch<{
      isProfileComplete: boolean;
      name?: string;
      email?: string;
      number?: string;
      address?: string;
      wardNo?: string;
    }>("/users/me", {}, token);
    updateUser({ userName: profile.name ?? null, email: profile.email ?? null });
    const needsProfile =
      !profile.isProfileComplete ||
      !profile.name ||
      !profile.number ||
      !profile.address ||
      !profile.wardNo;
    if (needsProfile) {
      router.push("/complete-profile");
      return;
    }
    router.replace("/");
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setStatus({ type: "error", message: "Please enter email and password." });
      return;
    }

    try {
      setLoading(true);
      const data = await apiFetch<{
        accessToken: string;
        RefreshToken: string;
        userId: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      signIn({
        accessToken: data.accessToken,
        refreshToken: data.RefreshToken,
        userId: data.userId,
        email: cleanEmail,
      });

      setStatus({ type: "success", message: "Login successful." });
      await finalizeLogin(data.accessToken);
    } catch (error: any) {
      setStatus({ type: "error", message: error?.message || "Login failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const redirectUrl = getAuthRedirectUrl();
    const authUrl = `${API_BASE_URL}/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const parsed = Linking.parse(result.url);
        const accessToken = typeof parsed.queryParams?.accessToken === "string" ? parsed.queryParams.accessToken : null;
        const refreshToken = typeof parsed.queryParams?.refreshToken === "string" ? parsed.queryParams.refreshToken : null;
        const userId = typeof parsed.queryParams?.userId === "string" ? parsed.queryParams.userId : null;

        if (accessToken && refreshToken && userId) {
          signIn({
            accessToken,
            refreshToken,
            userId,
            email: parsed.queryParams?.email as string | undefined,
            userName: parsed.queryParams?.name as string | undefined,
          });
          await finalizeLogin(accessToken);
        } else {
          setStatus({ type: "error", message: "Google login failed." });
        }
      } else if (result.type !== "cancel") {
        setStatus({ type: "error", message: "Google login was not completed." });
      }
    } catch (error: any) {
      setStatus({ type: "error", message: error?.message || "Google login failed." });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")} style={styles.logoBtn}>
          <View style={styles.logoIcon}>
            <Feather name="trending-up" size={18} color="#fff" />
          </View>
          <Text style={styles.logoText}>StockLearn</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>Sign in to your account</Text>
      </View>

      <View style={styles.card}>
        {status && (
          <View style={[styles.statusBanner, status.type === "error" ? styles.statusError : styles.statusSuccess]}>
            <Text style={styles.statusText}>{status.message}</Text>
          </View>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="********"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
            <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Login</Text>}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogle}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Link href="/signup" style={styles.footerLink}>Register</Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  logoBtn: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
  headerSubtitle: { color: "#CBD5E1", marginTop: 6 },
  card: {
    backgroundColor: "#1F2937",
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  label: { color: "#E2E8F0", fontSize: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    color: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  passwordRow: {
    position: "relative",
    marginBottom: 14,
  },
  passwordInput: {
    paddingRight: 44,
    marginBottom: 0,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 10,
    padding: 4,
  },
  primaryButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: { color: "#0F172A", fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#334155" },
  dividerText: { color: "#94A3B8", marginHorizontal: 8, fontSize: 12 },
  googleButton: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    alignItems: "center",
  },
  googleButtonText: { color: "#E2E8F0", fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 18 },
  footerText: { color: "#94A3B8" },
  footerLink: { color: "#22C55E", fontWeight: "700" },
  statusBanner: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  statusError: { backgroundColor: "#7F1D1D" },
  statusSuccess: { backgroundColor: "#14532D" },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});

