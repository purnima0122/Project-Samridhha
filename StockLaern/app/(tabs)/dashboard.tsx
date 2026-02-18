import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";
import { useDataServer } from "../context/DataServerContext";
import { apiFetch } from "../lib/api";

const FALLBACK_WATCHLIST_SYMBOLS = [
  "NABIL",
  "NLIC",
  "SCB",
  "UPPER",
  "HDL",
  "NHPC",
  "SBI",
  "EBL",
  "HIDCL",
  "NTC",
  "CHCL",
  "SHPC",
];

type DashboardData = {
  userName: string;
  spikeAlertsEnabled: boolean;
  stockAlerts: {
    symbol?: string;
    type?: string;
    price?: string;
  }[];
  watchlistItems: {
    symbol?: string;
    price?: string;
    change?: string;
    isPositive?: boolean;
  }[];
};

export default function HomeScreen() {
  const router = useRouter();
  const {
    isAuthenticated,
    accessToken,
    userName,
    email,
  } = useAuth();
  const {
    ticks,
    stocks,
    thresholds,
    notifications,
    unreadNotificationCount,
    watchlistSymbols,
    addWatchlistSymbols,
    removeWatchlistSymbol,
    clearWatchlist,
    isConnected: isDataServerConnected,
    loadSubscriptions,
  } = useDataServer();
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [watchlistSelection, setWatchlistSelection] = useState<string[]>([]);
  const inUserMode = isAuthenticated;

  useEffect(() => {
    const loadDashboard = async () => {
      if (!accessToken) return;
      try {
        setLoadingDashboard(true);
        const data = await apiFetch<DashboardData>("/dashboard/me", {}, accessToken);
        setDashboardData(data);
      } catch (error) {
        console.warn("Unable to load home dashboard data", error);
      } finally {
        setLoadingDashboard(false);
      }
    };

    loadDashboard();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !isDataServerConnected) {
      return;
    }
    loadSubscriptions(accessToken);
  }, [accessToken, isDataServerConnected, loadSubscriptions]);

  const stockLookup = useMemo(() => {
    const map: Record<string, any> = {};
    for (const item of stocks) {
      const symbol = String(item?.symbol ?? "").toUpperCase();
      if (symbol) {
        map[symbol] = item;
      }
    }
    return map;
  }, [stocks]);

  const sampleSymbols = useMemo(() => {
    const fromServer = stocks
      .map((item) => String(item?.symbol ?? "").toUpperCase())
      .filter((item) => Boolean(item));
    return Array.from(new Set([...fromServer, ...FALLBACK_WATCHLIST_SYMBOLS])).slice(0, 12);
  }, [stocks]);

  const watchlistItems = useMemo<DashboardData["watchlistItems"]>(
    () =>
      watchlistSymbols.map((symbol) => {
        const stock = stockLookup[symbol] ?? {};
        const tick = ticks[symbol] ?? {};
        const price = Number(tick.current_price ?? stock.price ?? 0);
        const changePct = Number(tick.change_pct ?? stock.change_pct ?? 0);

        return {
          symbol,
          price: Number.isFinite(price) && price > 0 ? price.toFixed(2) : "--",
          change: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
          isPositive: changePct >= 0,
        };
      }),
    [watchlistSymbols, stockLookup, ticks],
  );
  const activeAlertCount = thresholds.length;

  const toggleWatchlistSelection = (symbol: string) => {
    setWatchlistSelection((prev) =>
      prev.includes(symbol)
        ? prev.filter((item) => item !== symbol)
        : [...prev, symbol],
    );
  };

  const recentNotifications = useMemo(() => {
    return notifications.slice(0, 6).map((item, index) => {
      const dotColor =
        item.type === "volume"
          ? "#2563EB"
          : item.type === "price"
            ? "#16A34A"
            : item.type === "trend"
              ? "#A855F7"
              : "#0B3B78";

      return {
        renderKey: `${item.id}-${index}`,
        id: item.id,
        title: item.title,
        detail: `${item.message}  What this means: ${item.lesson}`,
        dotColor,
      };
    });
  }, [notifications]);

  const displayName =
    dashboardData?.userName || userName || email?.split("@")[0] || "User";

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
        <Text style={styles.heroTitle}>
          {inUserMode
            ? `Welcome, ${displayName}!`
            : "Track NEPSE like a pro, learn like a beginner."}
        </Text>
        <Text style={styles.heroSubtitle}>
          {inUserMode
            ? "Your personalized learning, alerts, and watchlist in one place."
            : "Learn, explore market insights, and build confidence step by step."}
        </Text>
        {inUserMode && (
          <Text style={styles.connectionText}>
            Data feed: {isDataServerConnected ? "Connected" : "Disconnected"}
          </Text>
        )}

        {inUserMode && (
          <View style={styles.toolsWrap}>
            <TouchableOpacity
              style={styles.toolsTrigger}
              onPress={() => setShowTools((prev) => !prev)}
            >
              <Feather name="menu" size={16} color="#fff" />
              <Text style={styles.toolsTriggerText}>Personalized Tools</Text>
            </TouchableOpacity>
            {showTools && (
              <View style={styles.toolsDropdown}>
                <TouchableOpacity
                  style={styles.toolsRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/alert-settings");
                  }}
                >
                  <Text style={styles.toolsRowText}>Alerts Center</Text>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/notifications");
                  }}
                >
                  <Text style={styles.toolsRowText}>Notification Center</Text>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/news");
                  }}
                >
                  <Text style={styles.toolsRowText}>Market News</Text>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/learn");
                  }}
                >
                  <Text style={styles.toolsRowText}>Learning Progress</Text>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {inUserMode && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Active Alerts</Text>
                <Text style={styles.statValue}>{activeAlertCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Watchlist</Text>
                <Text style={styles.statValue}>{watchlistSymbols.length}</Text>
              </View>
            </View>

            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Create Watchlist</Text>
                {watchlistSymbols.length > 0 && (
                  <TouchableOpacity onPress={clearWatchlist}>
                    <Text style={styles.panelLink}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.emptyText}>Select sample markets and add them to your watchlist.</Text>
              <View style={styles.watchlistChipWrap}>
                {sampleSymbols.map((symbol) => {
                  const selected = watchlistSelection.includes(symbol);
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={[styles.watchlistChip, selected ? styles.watchlistChipSelected : null]}
                      onPress={() => toggleWatchlistSelection(symbol)}
                    >
                      <Text
                        style={[
                          styles.watchlistChipText,
                          selected ? styles.watchlistChipTextSelected : null,
                        ]}
                      >
                        {symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.watchlistActionRow}>
                <TouchableOpacity
                  style={styles.watchlistActionButton}
                  onPress={() => {
                    addWatchlistSymbols(watchlistSelection);
                    setWatchlistSelection([]);
                  }}
                >
                  <Text style={styles.watchlistActionText}>Add Selected</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loadingDashboard ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0B3B78" />
                <Text style={styles.loadingText}>Loading your overview...</Text>
              </View>
            ) : (
              <>
                <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Recent Notifications</Text>
                    <TouchableOpacity onPress={() => router.push("/notifications")}>
                      <Text style={styles.panelLink}>
                        View all {unreadNotificationCount > 0 ? `(${unreadNotificationCount} new)` : ""}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {recentNotifications.length === 0 ? (
                    <Text style={styles.emptyText}>No alerts yet. Create one from Smart Alerts.</Text>
                  ) : (
                    recentNotifications.slice(0, 3).map((item) => (
                      <View key={item.renderKey} style={styles.rowItem}>
                        <View style={[styles.dot, { backgroundColor: item.dotColor }]} />
                        <Text style={styles.rowText}>
                          {item.title} - {item.detail}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Watchlist Preview</Text>
                    <TouchableOpacity onPress={() => router.push("/market")}>
                      <Text style={styles.panelLink}>Open market</Text>
                    </TouchableOpacity>
                  </View>
                  {watchlistItems.length === 0 ? (
                    <Text style={styles.emptyText}>No watchlist items yet.</Text>
                  ) : (
                    watchlistItems.slice(0, 5).map((item, index) => (
                      <View key={index} style={styles.watchRow}>
                        <Text style={styles.watchSymbol}>{item.symbol || "--"}</Text>
                        <Text style={styles.watchPrice}>{item.price || "--"}</Text>
                        <Text
                          style={[
                            styles.watchChange,
                            { color: item.isPositive ? "#16A34A" : "#DC2626" },
                          ]}
                        >
                          {item.change || "--"}
                        </Text>
                        <TouchableOpacity
                          onPress={() => item.symbol && removeWatchlistSymbol(item.symbol)}
                        >
                          <Feather name="x" size={14} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}

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
            link={inUserMode ? "/alert-settings" : "/signup"}
          />
        </View>

        <View style={styles.bannerCard}>
          <Text style={styles.bannerTitle}>Ready to learn the market?</Text>
          <Text style={styles.bannerDesc}>
            {inUserMode
              ? "Jump into the Beginner Guide and keep building your progress."
              : "Create your account, get alerts, and finish onboarding in minutes."}
          </Text>
          <Link href={inUserMode ? "/learn" : "/signup"} asChild>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>
                {inUserMode ? "Start Learning Now" : "Start Now"}
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
    position: "relative",
    zIndex: 20,
  },
  heroTopRow: { marginBottom: 16 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", lineHeight: 32 },
  heroSubtitle: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 10 },
  connectionText: { color: "#E2E8F0", fontSize: 12, fontWeight: "600", marginTop: 8 },
  toolsWrap: { marginTop: 18, alignItems: "flex-end" },
  toolsTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toolsTriggerText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  toolsDropdown: {
    marginTop: 10,
    width: 220,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  toolsRowText: { color: "#0F172A", fontWeight: "600", fontSize: 12 },
  content: { paddingHorizontal: 20, paddingTop: 20, position: "relative", zIndex: 1 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statLabel: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  statValue: { color: "#0F172A", fontSize: 22, fontWeight: "800", marginTop: 4 },
  loadingRow: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  loadingText: { color: "#64748B", fontSize: 13 },
  panelCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  panelTitle: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  panelLink: { color: "#0B3B78", fontWeight: "600", fontSize: 12 },
  emptyText: { color: "#94A3B8", fontSize: 12 },
  watchlistChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  watchlistChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
    marginRight: 8,
    marginBottom: 8,
  },
  watchlistChipSelected: {
    borderColor: "#4338CA",
    backgroundColor: "#EEF2FF",
  },
  watchlistChipText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
  },
  watchlistChipTextSelected: {
    color: "#3730A3",
  },
  watchlistActionRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  watchlistActionButton: {
    backgroundColor: "#3730A3",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  watchlistActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  rowItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0B3B78" },
  rowText: { color: "#334155", fontSize: 12 },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  watchSymbol: { flex: 1, color: "#0F172A", fontWeight: "700", fontSize: 13 },
  watchPrice: { color: "#334155", fontSize: 12, marginRight: 12 },
  watchChange: { fontWeight: "700", fontSize: 12 },
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

