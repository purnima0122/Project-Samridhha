import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, userName, email } = useAuth();
  const inUserMode = isAuthenticated;
  const activeEmail = email;
  const activeUserName = userName || email?.split("@")[0] || "StockLearn User";

  if (inUserMode) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.headerGradient}>
          <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <Feather name="user" size={22} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>{activeUserName}</Text>
            <Text style={styles.headerSubtitle}>{activeEmail || "your@email.com"}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Account Overview</Text>
          <View style={styles.infoRow}>
            <Feather name="mail" size={16} color="#0B3B78" />
            <Text style={styles.infoText}>{activeEmail || "email not set"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="bell" size={16} color="#0B3B78" />
            <Text style={styles.infoText}>Notifications enabled</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="grid" size={16} color="#0B3B78" />
            <Text style={styles.infoText}>Personalized home active</Text>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>quick actions</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.mainButton} onPress={() => router.push("/dashboard")}>
            <Text style={styles.mainButtonText}>Go to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/alert-settings")}>
            <Text style={styles.secondaryButtonText}>Manage Alerts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // --- Logged out view ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerGradient}>
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        <View style={styles.headerContent}>
          <View style={styles.iconContainer}>
            <Feather name="trending-up" size={24} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>Welcome to StockLearn</Text>
          <Text style={styles.headerSubtitle}>Log in or create your account to continue</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Link href="/login" asChild>
          <TouchableOpacity style={styles.mainButton}>
            <Text style={styles.mainButtonText}>Login</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/signup" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </Link>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Link href="/signup" asChild>
          <TouchableOpacity style={styles.googleBtn}>
            <GoogleLogo />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>
        </Link>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>With an account, you get:</Text>
          <BenefitItem text="Personalized price & volume spike alerts" color="#5B8DEF" />
          <BenefitItem text="Custom watchlist and learning progress" color="#0B3B78" />
        </View>
      </View>
    </ScrollView>
  );
}

function BenefitItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogoContainer}>
      {/* Google "G" Logo with colorful design */}
      <View style={styles.googleGContainer}>
        {/* Blue section (top-left) */}
        <View style={[styles.googleGPart, styles.googleGBlue]} />
        {/* Red section (top-right) */}
        <View style={[styles.googleGPart, styles.googleGRed]} />
        {/* Yellow section (bottom-left) */}
        <View style={[styles.googleGPart, styles.googleGYellow]} />
        {/* Green section (bottom-right) */}
        <View style={[styles.googleGPart, styles.googleGGreen]} />
        {/* White "G" shape overlay */}
        <View style={styles.googleGWhite}>
          <Text style={styles.googleGText}>G</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerGradient: {
    backgroundColor: "#0A2D5C",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "visible",
    position: "relative",
    elevation: 6,
    zIndex: 2,
  },
  headerContent: { gap: 8 },
  iconContainer: {
    backgroundColor: "#5B8DEF",
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  headerSubtitle: { fontSize: 14, color: "#CBD5E1" },
  formCard: {
    marginHorizontal: 20,
    marginTop: -20,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 24,
    elevation: 4,
    zIndex: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  infoText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  toggleContainer: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 4, borderRadius: 12, marginBottom: 20 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleActive: { backgroundColor: "#fff" },
  toggleText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  toggleTextActive: { color: "#0A2D5C" },
  inputBlock: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: "#1E293B" },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 20 },
  forgotText: { color: "#0B3B78", fontSize: 13, fontWeight: "600" },
  mainButton: { backgroundColor: "#0B3B78", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  mainButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: { color: "#1E293B", fontWeight: "700", fontSize: 15 },
  googleBtn: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  googleLogoContainer: {
    marginRight: 10,
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  googleGContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: "relative",
    overflow: "hidden",
  },
  googleGPart: {
    position: "absolute",
    width: "50%",
    height: "50%",
  },
  googleGBlue: {
    top: 0,
    left: 0,
    backgroundColor: "#4285F4",
    borderTopLeftRadius: 11,
  },
  googleGRed: {
    top: 0,
    right: 0,
    backgroundColor: "#EA4335",
    borderTopRightRadius: 11,
  },
  googleGYellow: {
    bottom: 0,
    left: 0,
    backgroundColor: "#FBBC05",
    borderBottomLeftRadius: 11,
  },
  googleGGreen: {
    bottom: 0,
    right: 0,
    backgroundColor: "#34A853",
    borderBottomRightRadius: 11,
  },
  googleGWhite: {
    position: "absolute",
    width: 14,
    height: 14,
    backgroundColor: "#fff",
    borderRadius: 7,
    top: 4,
    left: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  googleGText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4285F4",
    marginTop: -1,
  },
  googleBtnText: { fontWeight: "600", color: "#444" },
  benefitsContainer: { marginTop: 24, gap: 10 },
  benefitsTitle: { fontSize: 13, color: "#64748B", marginBottom: 4 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  benefitText: { fontSize: 12, color: "#475569" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText: { marginHorizontal: 8, color: "#94A3B8", fontSize: 12 },
  statusBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusTextSuccess: {
    color: "#065F46",
  },
  statusTextError: {
    color: "#B91C1C",
  },
});

