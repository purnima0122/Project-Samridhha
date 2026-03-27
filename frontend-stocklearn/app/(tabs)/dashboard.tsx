import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GuestAuthActions from "../components/GuestAuthActions";
import HeaderBar from "../components/HeaderBar";
import StreakDisplay from "../components/StreakDisplay";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";
import { useDataServer } from "../context/DataServerContext";
import { useGamification } from "../context/GamificationContext";
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
    _id?: string;
    symbol?: string;
    type?: string;
    price?: string;
    units?: string;
    status?: string;
  }[];
  watchlistItems: {
    _id?: string;
    symbol?: string;
    price?: string;
    change?: string;
    isPositive?: boolean;
    alertType?: string;
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
  const { gamification, streakCheck } = useGamification();
  const {
    ticks,
    stocks,
    marketStatus,
    thresholds,
    notifications,
    unreadNotificationCount,
    isConnected: isDataServerConnected,
    loadingStocks,
    loadSubscriptions,
  } = useDataServer();
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [updatingWatchlist, setUpdatingWatchlist] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [watchlistSelection, setWatchlistSelection] = useState<string[]>([]);
  const inUserMode = isAuthenticated;

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      setDashboardData(null);
      return null;
    }
    try {
      setLoadingDashboard(true);
      const data = await apiFetch<DashboardData>("/dashboard/me", {}, accessToken);
      setDashboardData(data);
      return data;
    } catch (error) {
      console.warn("Unable to load home dashboard data", error);
      return null;
    } finally {
      setLoadingDashboard(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

  const persistedWatchlistItems = dashboardData?.watchlistItems ?? [];
  const persistedWatchlistSymbols = useMemo(
    () =>
      persistedWatchlistItems
        .map((item) => String(item.symbol ?? "").toUpperCase())
        .filter((item) => Boolean(item)),
    [persistedWatchlistItems],
  );

  const watchlistItems = useMemo<DashboardData["watchlistItems"]>(
    () =>
      persistedWatchlistItems.map((item) => {
        const symbol = String(item.symbol ?? "").toUpperCase();
        const stock = stockLookup[symbol] ?? {};
        const tick = ticks[symbol] ?? {};
        const livePrice = Number(
          tick.price ?? tick.current_price ?? stock.price ?? stock.current_price ?? stock.ltp ?? NaN,
        );
        const liveChangePct = Number(tick.change_pct ?? stock.change_pct ?? NaN);
        const fallbackPrice =
          typeof item.price === "string" && item.price.trim()
            ? item.price.replace(/^NPR\s*/i, "")
            : "--";
        const fallbackChange =
          typeof item.change === "string" && item.change.trim() ? item.change : "--";

        return {
          ...item,
          symbol,
          price:
            Number.isFinite(livePrice) && livePrice > 0
              ? livePrice.toFixed(2)
              : fallbackPrice,
          change: Number.isFinite(liveChangePct)
            ? `${liveChangePct >= 0 ? "+" : ""}${liveChangePct.toFixed(2)}%`
            : fallbackChange,
          isPositive: Number.isFinite(liveChangePct)
            ? liveChangePct >= 0
            : Boolean(item.isPositive),
        };
      }),
    [persistedWatchlistItems, stockLookup, ticks],
  );
  const activeAlertCount = dashboardData?.stockAlerts?.length ?? thresholds.length;

  const marketSnapshot = useMemo(() => {
    const liveStocks = stocks
      .map((item) => {
        const symbol = String(item?.symbol ?? "").toUpperCase();
        if (!symbol) {
          return null;
        }

        const tick = ticks[symbol] ?? {};
        const price = Number(
          tick.price ?? tick.current_price ?? item.price ?? item.current_price ?? item.ltp ?? NaN,
        );
        const change = Number(tick.change_pct ?? item.change_pct ?? item.change ?? 0);
        const volume = Number(tick.volume ?? item.volume ?? 0);

        return {
          symbol,
          price: Number.isFinite(price) ? price : 0,
          change: Number.isFinite(change) ? change : 0,
          volume: Number.isFinite(volume) ? volume : 0,
        };
      })
      .filter(
        (
          item,
        ): item is {
          symbol: string;
          price: number;
          change: number;
          volume: number;
        } => Boolean(item),
      );

    const gainers = liveStocks.filter((item) => item.change > 0).length;
    const losers = liveStocks.filter((item) => item.change < 0).length;
    const topGainer =
      liveStocks.reduce<typeof liveStocks[number] | null>(
        (best, current) => (!best || current.change > best.change ? current : best),
        null,
      ) ?? null;
    const topVolume =
      liveStocks.reduce<typeof liveStocks[number] | null>(
        (best, current) => (!best || current.volume > best.volume ? current : best),
        null,
      ) ?? null;

    return {
      tracked: liveStocks.length,
      gainers,
      losers,
      topGainer,
      topVolume,
    };
  }, [stocks, ticks]);

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

  const handleAddSelectedWatchlist = useCallback(async () => {
    if (!accessToken) {
      router.push("/login");
      return;
    }

    const nextSymbols = watchlistSelection.filter(
      (symbol) => !persistedWatchlistSymbols.includes(symbol),
    );

    if (nextSymbols.length === 0) {
      if (watchlistSelection.length > 0) {
        Alert.alert("Already added", "Those symbols are already in your watchlist.");
      }
      setWatchlistSelection([]);
      return;
    }

    try {
      setUpdatingWatchlist(true);
      await Promise.all(
        nextSymbols.map((symbol) =>
          apiFetch(
            "/watchlist",
            {
              method: "POST",
              body: JSON.stringify({ symbol }),
            },
            accessToken,
          ),
        ),
      );
      setWatchlistSelection([]);
      await loadDashboard();
    } catch (error: any) {
      Alert.alert(
        "Unable to save watchlist",
        error?.message || "Please try again.",
      );
    } finally {
      setUpdatingWatchlist(false);
    }
  }, [accessToken, loadDashboard, persistedWatchlistSymbols, router, watchlistSelection]);

  const handleRemoveWatchlistItem = useCallback(async (itemId: string) => {
    if (!accessToken || !itemId) {
      return;
    }

    try {
      setUpdatingWatchlist(true);
      await apiFetch(`/watchlist/${encodeURIComponent(itemId)}`, { method: "DELETE" }, accessToken);
      await loadDashboard();
    } catch (error: any) {
      Alert.alert(
        "Unable to remove item",
        error?.message || "Please try again.",
      );
    } finally {
      setUpdatingWatchlist(false);
    }
  }, [accessToken, loadDashboard]);

  const handleClearWatchlist = useCallback(async () => {
    if (!accessToken || persistedWatchlistItems.length === 0) {
      return;
    }

    try {
      setUpdatingWatchlist(true);
      await Promise.all(
        persistedWatchlistItems
          .filter((item) => item._id)
          .map((item) =>
            apiFetch(`/watchlist/${encodeURIComponent(String(item._id))}`, { method: "DELETE" }, accessToken),
          ),
      );
      await loadDashboard();
    } catch (error: any) {
      Alert.alert(
        "Unable to clear watchlist",
        error?.message || "Please try again.",
      );
    } finally {
      setUpdatingWatchlist(false);
    }
  }, [accessToken, loadDashboard, persistedWatchlistItems]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <HeaderBar
            tint="dark"
            rightSlot={inUserMode ? <TopRightMenu theme="dark" /> : <GuestAuthActions />}
          />
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
          <View style={styles.connectionToolsRow}>
            <Text style={styles.connectionText}>
              Data feed: {isDataServerConnected ? "Connected" : "Disconnected"}
            </Text>
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
          </View>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {inUserMode && (
          <>
            <View style={styles.streakHero}>
              <StreakDisplay
                streak={gamification?.streakDays ?? 0}
                freezes={gamification?.streakFreezes ?? 0}
                maxFreezes={gamification?.maxStreakFreezes ?? 3}
                status={streakCheck?.status ?? gamification?.streakStatus ?? null}
              />
              <Text style={styles.streakHint}>{gamification?.streakMessage ?? "Don't forget me today!"}</Text>
              <View style={styles.weekRow}>
                {(gamification?.weeklyProgress ?? []).map((day) => (
                  <View
                    key={day.date}
                    style={[
                      styles.weekDay,
                      day.status === "done" && styles.weekDayDone,
                      day.status === "today" && styles.weekDayToday,
                      day.status === "locked" && styles.weekDayLocked,
                    ]}
                  >
                    <Text style={styles.weekDayLabel}>{day.label}</Text>
                    <Text style={styles.weekDayValue}>
                      {day.status === "done" ? "\u{1F525}" : day.status === "locked" ? "\u{1F9CA}" : "\u{1F614}"}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.streakMetaRow}>
                <Text style={styles.streakMetaText}>XP: {gamification?.xp ?? 0}</Text>
                <Text style={styles.streakMetaText}>Level: {gamification?.level ?? 1}</Text>
              </View>
              <TouchableOpacity style={styles.continueLearnBtn} onPress={() => router.push("/learn")}>
                <Text style={styles.continueLearnText}>
                  Continue Learning
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Active Alerts</Text>
                <Text style={styles.statValue}>{activeAlertCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Watchlist</Text>
                <Text style={styles.statValue}>{persistedWatchlistSymbols.length}</Text>
              </View>
            </View>

            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Create Watchlist</Text>
                {persistedWatchlistSymbols.length > 0 && (
                  <TouchableOpacity onPress={handleClearWatchlist} disabled={updatingWatchlist}>
                    <Text style={styles.panelLink}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.emptyText}>Select sample markets and add them to your watchlist.</Text>
              <View style={styles.watchlistChipWrap}>
                {sampleSymbols.map((symbol) => {
                  const isSaved = persistedWatchlistSymbols.includes(symbol);
                  const selected = watchlistSelection.includes(symbol);
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={[
                        styles.watchlistChip,
                        isSaved ? styles.watchlistChipSaved : null,
                        selected ? styles.watchlistChipSelected : null,
                      ]}
                      onPress={() => {
                        if (!isSaved) {
                          toggleWatchlistSelection(symbol);
                        }
                      }}
                      disabled={isSaved}
                    >
                      <Text
                        style={[
                          styles.watchlistChipText,
                          isSaved ? styles.watchlistChipTextSaved : null,
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
                  onPress={handleAddSelectedWatchlist}
                  disabled={updatingWatchlist}
                >
                  <Text style={styles.watchlistActionText}>
                    {updatingWatchlist ? "Saving..." : "Add Selected"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Watchlist Preview</Text>
                <TouchableOpacity onPress={() => router.push("/market")}>
                  <Text style={styles.panelLink}>Open market</Text>
                </TouchableOpacity>
              </View>
              {loadingDashboard && watchlistItems.length === 0 ? (
                <View style={styles.loadingInlineRow}>
                  <ActivityIndicator color="#0B3B78" />
                  <Text style={styles.loadingText}>Loading your watchlist...</Text>
                </View>
              ) : watchlistItems.length === 0 ? (
                <Text style={styles.emptyText}>No watchlist items yet.</Text>
              ) : (
                watchlistItems.slice(0, 5).map((item, index) => (
                  <View key={item._id || `${item.symbol}-${index}`} style={styles.watchRow}>
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
                      onPress={() => item._id && handleRemoveWatchlistItem(String(item._id))}
                      disabled={updatingWatchlist}
                    >
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
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
              </>
            )}
          </>
        )}

        <View style={styles.snapshotCard}>
          <View style={styles.snapshotHeader}>
            <View style={styles.snapshotCopy}>
              <Text style={styles.snapshotLabel}>Live Market Snapshot</Text>
              <Text style={styles.snapshotValue}>
                {loadingStocks && marketSnapshot.tracked === 0
                  ? "Loading..."
                  : marketSnapshot.tracked > 0
                    ? `${marketSnapshot.tracked} Stocks`
                    : "No Data Yet"}
              </Text>
              <Text style={styles.snapshotSubtext}>
                {marketStatus
                  ? `${marketStatus.is_open ? "Market Open" : "Market Closed"}${marketStatus.trading_hours ? ` • ${marketStatus.trading_hours}` : ""}`
                  : isDataServerConnected
                    ? "Feed connected. Waiting for market details."
                    : "Feed disconnected."}
              </Text>
            </View>
            <View
              style={[
                styles.snapshotBadge,
                isDataServerConnected ? styles.snapshotBadgeLive : styles.snapshotBadgeOffline,
              ]}
            >
              <Text
                style={[
                  styles.snapshotBadgeText,
                  !isDataServerConnected ? styles.snapshotBadgeTextOffline : null,
                ]}
              >
                {isDataServerConnected ? "LIVE" : "OFFLINE"}
              </Text>
            </View>
          </View>

          <View style={styles.snapshotStatsRow}>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotStatLabel}>Gainers</Text>
              <Text style={[styles.snapshotStatValue, styles.snapshotGain]}>
                {marketSnapshot.gainers}
              </Text>
            </View>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotStatLabel}>Losers</Text>
              <Text style={[styles.snapshotStatValue, styles.snapshotLoss]}>
                {marketSnapshot.losers}
              </Text>
            </View>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotStatLabel}>Top Gainer</Text>
              <Text style={styles.snapshotStatValue}>
                {marketSnapshot.topGainer?.symbol ?? "--"}
              </Text>
            </View>
          </View>

          <Text style={styles.snapshotFootnote}>
            {marketSnapshot.topGainer && marketSnapshot.topVolume
              ? `Top gainer: ${marketSnapshot.topGainer.symbol} ${marketSnapshot.topGainer.change >= 0 ? "+" : ""}${marketSnapshot.topGainer.change.toFixed(2)}% • Most active: ${marketSnapshot.topVolume.symbol} (${marketSnapshot.topVolume.volume.toLocaleString()})`
              : marketSnapshot.topGainer
                ? `Top gainer: ${marketSnapshot.topGainer.symbol} ${marketSnapshot.topGainer.change >= 0 ? "+" : ""}${marketSnapshot.topGainer.change.toFixed(2)}%`
                : marketSnapshot.topVolume
                  ? `Most active: ${marketSnapshot.topVolume.symbol} (${marketSnapshot.topVolume.volume.toLocaleString()})`
                  : "Open Market to explore the full live board."}
          </Text>
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
  connectionToolsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  connectionText: { color: "#E2E8F0", fontSize: 12, fontWeight: "600", flex: 1 },
  toolsWrap: { alignItems: "flex-end", position: "relative" },
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
  streakHero: {
    backgroundColor: "#081D38",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1E3A5F",
    padding: 14,
    marginBottom: 14,
  },
  streakHint: { color: "#93C5FD", marginTop: 6, fontSize: 12, fontWeight: "600" },
  weekRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  weekDay: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#0F2747",
    alignItems: "center",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  weekDayDone: { backgroundColor: "#14532D", borderColor: "#22C55E" },
  weekDayToday: { backgroundColor: "#1D4ED8", borderColor: "#60A5FA" },
  weekDayLocked: { backgroundColor: "#111827", borderColor: "#374151" },
  weekDayLabel: { color: "#E2E8F0", fontSize: 10, fontWeight: "700" },
  weekDayValue: { color: "#F8FAFC", marginTop: 2, fontSize: 12, fontWeight: "800" },
  streakMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  streakMetaText: { color: "#DBEAFE", fontSize: 12, fontWeight: "700" },
  continueLearnBtn: {
    marginTop: 10,
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  continueLearnText: { color: "#F8FAFC", fontSize: 12, fontWeight: "800" },
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
  loadingInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
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
  watchlistChipSaved: {
    borderColor: "#0B3B78",
    backgroundColor: "#DBEAFE",
  },
  watchlistChipText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
  },
  watchlistChipTextSaved: {
    color: "#0B3B78",
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
  snapshotHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  snapshotCopy: { flex: 1 },
  snapshotLabel: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  snapshotValue: { color: "#0F172A", fontSize: 24, fontWeight: "700" },
  snapshotSubtext: { color: "#64748B", fontSize: 12, marginTop: 6 },
  snapshotBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  snapshotBadgeLive: { backgroundColor: "#DCFCE7" },
  snapshotBadgeOffline: { backgroundColor: "#E2E8F0" },
  snapshotBadgeText: { color: "#15803D", fontWeight: "700", fontSize: 12 },
  snapshotBadgeTextOffline: { color: "#475569" },
  snapshotStatsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  snapshotStat: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  snapshotStatLabel: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  snapshotStatValue: { color: "#0F172A", fontSize: 16, fontWeight: "800", marginTop: 4 },
  snapshotGain: { color: "#16A34A" },
  snapshotLoss: { color: "#DC2626" },
  snapshotFootnote: {
    width: "100%",
    marginTop: 12,
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
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

