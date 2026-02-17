import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";
import { useDataServer } from "../context/DataServerContext";
import { apiFetch } from "../lib/api";

export default function DashboardScreen() {
  const router = useRouter();
  const { accessToken, userName, email, updateUser } = useAuth();
  const { ticks, isConnected, marketStatus, subscribe } = useDataServer();
  const [spikeAlertsEnabled, setSpikeAlertsEnabled] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [dashboardName, setDashboardName] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [profileDetails, setProfileDetails] = useState<{
    name?: string;
    email?: string;
    number?: string;
    wardNo?: string;
    address?: string;
  } | null>(null);

  const loadDashboard = async () => {
    if (!accessToken) return;
    try {
      setLoadingDashboard(true);
      const [data, profile] = await Promise.all([
        apiFetch<{
          userName: string;
          spikeAlertsEnabled: boolean;
          stockAlerts: any[];
          watchlistItems: any[];
        }>("/dashboard/me", {}, accessToken),
        apiFetch<{
          name?: string;
          email?: string;
          number?: string;
          wardNo?: string;
          address?: string;
        }>("/users/me", {}, accessToken),
      ]);
      setSpikeAlertsEnabled(Boolean(data.spikeAlertsEnabled));
      setStockAlerts(data.stockAlerts || []);
      setWatchlistItems(data.watchlistItems || []);
      setDashboardName(data.userName || null);
      setProfileDetails(profile || null);
      updateUser({ userName: profile?.name ?? null, email: profile?.email ?? null });
    } catch (error) {
      console.warn("Unable to load dashboard", error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Subscribe to watchlist stock ticks
  useEffect(() => {
    if (watchlistItems.length > 0) {
      const symbols = watchlistItems
        .map((item: any) => item.symbol)
        .filter(Boolean);
      if (symbols.length > 0) {
        subscribe(symbols);
      }
    }
  }, [watchlistItems]);

  const updateAlertSetting = async (value: boolean) => {
    setSpikeAlertsEnabled(value);
    if (!accessToken) return;
    try {
      await apiFetch("/dashboard/settings", {
        method: "PATCH",
        body: JSON.stringify({ spikeAlertsEnabled: value }),
      }, accessToken);
    } catch (error) {
      console.warn("Unable to update settings", error);
    }
  };

  // Enrich watchlist items with live tick data
  const getWatchlistPrice = (item: any) => {
    const tick = ticks[item.symbol?.toUpperCase()];
    if (tick) {
      return {
        price: `NPR ${Number(tick.current_price).toFixed(2)}`,
        change: `${tick.change_pct >= 0 ? "+" : ""}${Number(tick.change_pct).toFixed(2)}%`,
        isPositive: tick.change_pct >= 0,
      };
    }
    return {
      price: item.price || "--",
      change: item.change || "--",
      isPositive: item.isPositive ?? true,
    };
  };

  useEffect(() => {
    loadDashboard();
  }, [accessToken]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <HeaderBar
            tint="dark"
            rightSlot={<TopRightMenu theme="dark" details={profileDetails} />}
          />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Welcome, {dashboardName || userName || email?.split("@")[0] || "User"}!
          </Text>
          <Text style={styles.headerSubtitle}>
            Your personalized NEPSE overview{" "}
            {marketStatus?.is_open ? "🟢 Open" : "🔴 Closed"}
            {isConnected ? " · Live" : ""}
          </Text>
        </View>
        <View style={styles.toolsTriggerRow}>
          <View style={styles.toolsDropdownWrap}>
            <TouchableOpacity style={styles.toolsTrigger} onPress={() => setShowTools((prev) => !prev)}>
              <Feather name="menu" size={18} color="#fff" />
              <Text style={styles.toolsTriggerText}>Personalized Tools</Text>
            </TouchableOpacity>
            {showTools && (
              <View style={styles.toolsDropdown}>
                <Text style={styles.toolsDropdownTitle}>Added Features for You</Text>
                <TouchableOpacity
                  style={styles.toolsDropdownRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/(tabs)/alert-settings");
                  }}
                >
                  <View style={styles.toolsDropdownLeft}>
                    <Feather name="bell" size={16} color="#0B3B78" />
                    <Text style={styles.toolsDropdownText}>Personalized spike alert tracking</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
                <View style={styles.toolsDropdownDivider} />
                <TouchableOpacity
                  style={styles.toolsDropdownRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/(tabs)/news");
                  }}
                >
                  <View style={styles.toolsDropdownLeft}>
                    <Feather name="file-text" size={16} color="#0B3B78" />
                    <Text style={styles.toolsDropdownText}>Curated news and market updates</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
                <View style={styles.toolsDropdownDivider} />
                <TouchableOpacity
                  style={styles.toolsDropdownRow}
                  onPress={() => {
                    setShowTools(false);
                    router.push("/(tabs)/learn");
                  }}
                >
                  <View style={styles.toolsDropdownLeft}>
                    <Feather name="book-open" size={16} color="#0B3B78" />
                    <Text style={styles.toolsDropdownText}>Learning progress and insights</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {!accessToken && (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>Login required</Text>
          <Text style={styles.gateText}>
            Sign in to access your personalized dashboard, alerts, and watchlist.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(tabs)/login")}>
            <Text style={styles.primaryButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {accessToken && (
        <>
          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active Alerts</Text>
              <Text style={styles.statValue}>{stockAlerts.length}</Text>
              <Text style={styles.statSub}>spike alerts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Watchlist</Text>
              <Text style={styles.statValue}>{watchlistItems.length}</Text>
              <Text style={styles.statSub}>stocks tracked</Text>
            </View>
          </View>

          <View style={styles.learnCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.learnTitle}>Ready to learn?</Text>
              <Text style={styles.learnSubtitle}>
                Continue the Beginner Guide and track your progress.
              </Text>
            </View>
            <TouchableOpacity style={styles.learnButton} onPress={() => router.push("/(tabs)/learn")}>
              <Text style={styles.learnButtonText}>Go to Learn</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notificationsCard}>
            <View style={styles.notificationsHeader}>
              <View style={styles.notificationsTitleRow}>
                <Feather name="bell" size={16} color="#0B3B78" />
                <Text style={styles.notificationsTitle}>Notifications</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/(tabs)/alert-settings")}>
                <Text style={styles.notificationsLink}>View all</Text>
              </TouchableOpacity>
            </View>
            {stockAlerts.length === 0 ? (
              <Text style={styles.notificationsEmpty}>No notifications yet.</Text>
            ) : (
              stockAlerts.slice(0, 3).map((alert, index) => (
                <View key={index} style={styles.notificationRow}>
                  <View style={styles.notificationDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notificationTitle}>
                      {alert.symbol || "Stock"} {alert.type || "alert"} {alert.price || ""}
                    </Text>
                    <Text style={styles.notificationSub}>Tap to manage alerts</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </View>
              ))
            )}
          </View>

          {/* Spike Alerts Section */}
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertCardTitle}>Spike Alerts</Text>
              <Switch
                value={spikeAlertsEnabled}
                onValueChange={updateAlertSetting}
                trackColor={{ false: "#E5E7EB", true: "#22c55e" }}
                thumbColor="#fff"
              />
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>SYMBOL</Text>
              <Text style={styles.tableHeaderText}>TYPE</Text>
              <Text style={styles.tableHeaderText}>PRICE</Text>
              <Text style={styles.tableHeaderText}>UNITS</Text>
              <Text style={styles.tableHeaderText}>STATUS</Text>
            </View>


            {/* Alert Entries */}
            {loadingDashboard && stockAlerts.length === 0 ? (
              <View style={styles.emptyAlerts}>
                <ActivityIndicator color="#70A288" />
                <Text style={styles.emptyAlertsText}>Loading alerts...</Text>
              </View>
            ) : stockAlerts.length > 0 ? (
              stockAlerts.map((alert, index) => (
                <View key={index} style={styles.alertRow}>
                  <Text style={styles.alertRowText}>{alert.symbol}</Text>
                  <Text style={styles.alertRowText}>{alert.type}</Text>
                  <Text style={styles.alertRowText}>{alert.price}</Text>
                  <Text style={styles.alertRowText}>{alert.units}</Text>
                  <View style={styles.statusIcon}>
                    <Feather name="bell" size={16} color="#22c55e" />
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyAlerts}>
                <Text style={styles.emptyAlertsText}>No alerts configured</Text>
              </View>
            )}


            {/* Add Alert Button */}
            <TouchableOpacity
              style={styles.addAlertButton}
              onPress={() => router.push("/(tabs)/alert-settings")}
            >
              <Feather name="plus" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.addAlertButtonText}>ADD STOCK ALERT</Text>
            </TouchableOpacity>
          </View>

          {/* My Watchlist Section */}

          <View style={styles.watchlistSection}>
            <View style={styles.watchlistHeader}>
              <Text style={styles.watchlistTitle}>My Watchlist</Text>
              <TouchableOpacity>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {loadingDashboard && watchlistItems.length === 0 ? (
              <View style={styles.emptyAlerts}>
                <ActivityIndicator color="#70A288" />
                <Text style={styles.emptyAlertsText}>Loading watchlist...</Text>
              </View>
            ) : watchlistItems.length > 0 ? (
              watchlistItems.map((item, index) => (
                <View key={index} style={styles.watchlistCard}>
                  <View style={styles.watchlistCardContent}>
                    <View style={styles.watchlistLeft}>
                      <Text style={styles.stockSymbol}>{item.symbol}</Text>
                      {item.alertType && (
                        <View style={styles.alertBadge}>
                          <Text style={styles.alertBadgeText}>{item.alertType}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.watchlistRight}>
                      <Text style={styles.stockPrice}>{getWatchlistPrice(item).price}</Text>
                      <Text style={[styles.stockChange, { color: getWatchlistPrice(item).isPositive ? "#10B981" : "#EF4444" }]}>
                        {getWatchlistPrice(item).change}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.watchlistActions}>
                    <TouchableOpacity style={styles.viewDetailsBtn}>
                      <Feather name="eye" size={16} color="#64748B" />
                      <Text style={styles.viewDetailsText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.setAlertBtn}>
                      <Feather name="settings" size={16} color="#3B82F6" />
                      <Text style={styles.setAlertText}>Set Alert</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyAlerts}>
                <Text style={styles.emptyAlertsText}>No watchlist items yet</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: "#0A2D5C",
    overflow: "visible",
    position: "relative",
    elevation: 4,
    zIndex: 2,
  },
  headerTop: { marginBottom: 16 },
  headerContent: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#E0E7FF",
  },
  toolsTriggerRow: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  toolsDropdownWrap: {
    alignSelf: "flex-end",
    position: "relative",
    zIndex: 20,
  },
  toolsTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  toolsTriggerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  toolsDropdown: {
    position: "absolute",
    right: 0,
    top: 44,
    width: 260,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 30,
  },
  toolsDropdownTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  toolsDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  toolsDropdownLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  toolsDropdownText: { fontSize: 12, fontWeight: "600", color: "#1E293B", flex: 1 },
  toolsDropdownDivider: { height: 1, backgroundColor: "#F1F5F9" },
  gateCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  gateTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  gateText: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  primaryButton: {
    backgroundColor: "#0B3B78",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  statsRow: {
    marginHorizontal: 20,
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0A2D5C", marginTop: 6 },
  statSub: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
  learnCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  learnTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  learnSubtitle: { fontSize: 12, color: "#64748B", marginTop: 4 },
  learnButton: {
    backgroundColor: "#0B3B78",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  learnButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  notificationsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  notificationsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  notificationsTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationsTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  notificationsLink: { fontSize: 12, color: "#0B3B78", fontWeight: "600" },
  notificationsEmpty: { fontSize: 12, color: "#94A3B8" },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0B3B78",
  },
  notificationTitle: { fontSize: 13, color: "#0F172A", fontWeight: "600" },
  notificationSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  alertCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#0B3B78",
  },
  alertCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#D4E8DD",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  alertRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  alertRowText: {
    flex: 1,
    fontSize: 13,
    color: "#1E293B",
    textAlign: "center",
  },
  statusIcon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAlerts: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAlertsText: {
    fontSize: 14,
    color: "#64748B",
  },
  addAlertButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B3B78",
    paddingVertical: 14,
    paddingHorizontal: 20,
    margin: 16,
    borderRadius: 12,
  },
  addAlertButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  watchlistSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  watchlistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  watchlistTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  editText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#04395E",
  },
  watchlistCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  watchlistCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  watchlistLeft: {
    flex: 1,
  },
  stockSymbol: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  alertBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },
  watchlistRight: {
    alignItems: "flex-end",
  },
  stockPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  stockChange: {
    fontSize: 14,
    fontWeight: "600",
  },
  watchlistActions: {
    flexDirection: "row",
    gap: 12,
  },
  viewDetailsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    gap: 6,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  setAlertBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#E0ECFF",
    borderRadius: 10,
    gap: 6,
  },
  setAlertText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B3B78",
  },
});
