import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        </View>
        <Text style={styles.heroTitle}>Track NEPSE like a pro, learn like a beginner.</Text>
        <Text style={styles.heroSubtitle}>
          Personalized lessons, market snapshots, and alert-ready watchlists - all in one app.
        </Text>
        <View style={styles.heroActions}>
          <Link href={isAuthenticated ? "/(tabs)/dashboard" : "/(tabs)/signup"} asChild>
            <TouchableOpacity style={styles.primaryCta}>
              <Text style={styles.primaryCtaText}>
                {isAuthenticated ? "Open Dashboard" : "Get Started"}
              </Text>
            </TouchableOpacity>
          </Link>
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={() => {
                signOut();
                router.push("/(tabs)/login");
              }}
            >
              <Text style={styles.secondaryCtaText}>Logout</Text>
            </TouchableOpacity>
          ) : (
            <Link href="/(tabs)/login" asChild>
              <TouchableOpacity style={styles.secondaryCta}>
                <Text style={styles.secondaryCtaText}>Login</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.snapshotCard}>
          <View>
            <Text style={styles.snapshotLabel}>NEPSE Index</Text>
            <Text style={styles.snapshotValue}>2,156.42</Text>
          </View>
          <View style={styles.snapshotBadge}>
            <Text style={styles.snapshotBadgeText}>+2.4%</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What you can do</Text>
        <View style={styles.featureGrid}>
          <FeatureCard
            icon="book-open"
            title="Guided Lessons"
            desc="Structured learning with quizzes."
            color="#2563EB"
            bg="#DBEAFE"
            link="/learn"
          />
          <FeatureCard
            icon="bar-chart-2"
            title="Market Insights"
            desc="Visualize trends & sectors."
            color="#7C3AED"
            bg="#F3E8FF"
            link="/insights"
          />
          <FeatureCard
            icon="trending-up"
            title="Browse Market"
            desc="Explore NEPSE companies."
            color="#16A34A"
            bg="#DCFCE7"
            link="/market"
          />
          <FeatureCard
            icon="bell"
            title="Smart Alerts"
            desc="Custom watchlist triggers."
            color="#D97706"
            bg="#FEF3C7"
            link="/(tabs)/signup"
          />
        </View>

        <View style={styles.bannerCard}>
          <Text style={styles.bannerTitle}>Ready to learn the market?</Text>
          <Text style={styles.bannerDesc}>
            {isAuthenticated
              ? "Jump into the Beginner Guide and keep building your progress."
              : "Create your account, get alerts, and finish onboarding in minutes."}
          </Text>
          <Link href={isAuthenticated ? "/(tabs)/learn" : "/(tabs)/signup"} asChild>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>
                {isAuthenticated ? "Start Learning Now" : "Start Now"}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

function FeatureCard({ icon, title, desc, link, bg, color }: any) {
  return (
    <Link href={link} asChild>
      <TouchableOpacity style={styles.featureCard}>
        <View style={[styles.featureIcon, { backgroundColor: bg }]}>
          <Feather name={icon} size={18} color={color} />
        </View>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F8FAFC" },
  hero: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: { marginBottom: 16 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", lineHeight: 32 },
  heroSubtitle: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 10 },
  heroActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  primaryCta: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  primaryCtaText: { color: "#0F172A", fontWeight: "700" },
  secondaryCta: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  secondaryCtaText: { color: "#fff", fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  snapshotCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  snapshotLabel: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  snapshotValue: { color: "#0F172A", fontSize: 24, fontWeight: "700" },
  snapshotBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  snapshotBadgeText: { color: "#15803D", fontWeight: "700", fontSize: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  featureTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  featureDesc: { fontSize: 12, color: "#64748B", marginTop: 4 },
  bannerCard: {
    marginTop: 20,
    backgroundColor: "#0B3B78",
    borderRadius: 18,
    padding: 18,
  },
  bannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  bannerDesc: { color: "#CBD5E1", fontSize: 12, marginTop: 6 },
  bannerButton: {
    marginTop: 12,
    backgroundColor: "#22C55E",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  bannerButtonText: { color: "#0F172A", fontWeight: "700" },
});
