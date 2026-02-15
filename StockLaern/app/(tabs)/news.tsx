import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";

const sampleNews = [
  {
    title: "NEPSE: Commercial banks lead today’s turnover",
    source: "NEPSE Bulletin",
    time: "2 hours ago",
  },
  {
    title: "Banking sector sees steady volume spike",
    source: "Market Research",
    time: "5 hours ago",
  },
  {
    title: "Weekly overview: Top movers in commercial sector",
    source: "StockLearn Research",
    time: "1 day ago",
  },
];

export default function NewsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.gateContainer]}>
        <Text style={styles.gateTitle}>Login required</Text>
        <Text style={styles.gateText}>
          News & research is available to logged-in users only.
        </Text>
        <TouchableOpacity style={styles.gateButton} onPress={() => router.push("/(tabs)/login")}>
          <Text style={styles.gateButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        <Text style={styles.headerTitle}>News & Research</Text>
        <Text style={styles.headerSubtitle}>
          Curated NEPSE updates focused on commercial sector activity.
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {sampleNews.map((item) => (
          <View key={item.title} style={styles.newsCard}>
            <View style={styles.newsIcon}>
              <Feather name="file-text" size={18} color="#0B3B78" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.newsTitle}>{item.title}</Text>
              <Text style={styles.newsMeta}>{item.source} • {item.time}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  gateContainer: { paddingHorizontal: 20 },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "visible",
    position: "relative",
    elevation: 4,
    zIndex: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 12 },
  headerSubtitle: { fontSize: 13, color: "#E0E7FF", marginTop: 6 },
  content: { paddingHorizontal: 20, paddingTop: 16, zIndex: 0 },
  newsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  newsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E0ECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  newsTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  newsMeta: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
  gateTitle: { fontSize: 20, fontWeight: "700", color: "#0F172A", marginTop: 80 },
  gateText: { fontSize: 13, color: "#64748B", marginTop: 8, lineHeight: 18 },
  gateButton: {
    marginTop: 16,
    backgroundColor: "#0B3B78",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  gateButtonText: { color: "#fff", fontWeight: "700" },
});
