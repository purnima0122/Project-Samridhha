import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";
import { useDataServer } from "../context/DataServerContext";

const alertTypes = [
  {
    title: "Volume Spike Alert",
    desc: "Get notified when volume exceeds average by a threshold.",
    icon: "bar-chart-2",
    color: "#2563EB",
    bg: "#DBEAFE",
    metaLeft: "Threshold 150%",
    metaRight: "Timeframe 1 hour",
    alertConfig: { price_threshold_pct: 5.0, volume_threshold_multiplier: 1.5 },
  },
  {
    title: "Price Jump Alert",
    desc: "Alert when price increases by a set percentage.",
    icon: "trending-up",
    color: "#16A34A",
    bg: "#DCFCE7",
    metaLeft: "Threshold 3%",
    metaRight: "Timeframe realtime",
    alertConfig: { price_threshold_pct: 3.0, volume_threshold_multiplier: 5.0 },
  },
  {
    title: "Price Drop Alert",
    desc: "Alert when price drops below a set percentage.",
    icon: "trending-down",
    color: "#DC2626",
    bg: "#FEE2E2",
    metaLeft: "Threshold 3%",
    metaRight: "Timeframe realtime",
    alertConfig: { price_threshold_pct: 3.0, volume_threshold_multiplier: 5.0 },
  },
  {
    title: "Trend Change Alert",
    desc: "Detect bullish or bearish trend reversals.",
    icon: "activity",
    color: "#7C3AED",
    bg: "#EDE9FE",
    metaLeft: "Sensitivity medium",
    metaRight: "Timeframe 24 hours",
    alertConfig: { price_threshold_pct: 5.0, volume_threshold_multiplier: 2.0 },
  },
];

export default function AlertSettingsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { alerts, isConnected, setAlertThreshold, stocks } = useDataServer();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [symbolInput, setSymbolInput] = useState("");

  const handleCreateAlert = (alertConfig: { price_threshold_pct: number; volume_threshold_multiplier: number }) => {
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      Alert.alert("Enter Symbol", "Please enter a stock symbol (e.g. NABIL) in the field above.");
      return;
    }
    setAlertThreshold({
      user_id: accessToken || "anonymous",
      symbol,
      price_threshold_pct: alertConfig.price_threshold_pct,
      volume_threshold_multiplier: alertConfig.volume_threshold_multiplier,
    });
    Alert.alert("Alert Created", `Threshold set for ${symbol}. You'll receive real-time alerts via WebSocket.`);
    setSymbolInput("");
  };

  const formatAlertTime = (index: number) => {
    const times = ["just now", "1m ago", "2m ago", "5m ago", "10m ago"];
    return times[index] || `${index}m ago`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        <Text style={styles.heroTitle}>Smart Alert Types</Text>
        <Text style={styles.heroSubtitle}>
          Set intelligent alerts for volume, price, and trend shifts.
          {isConnected ? " 🟢 Connected" : " 🔴 Disconnected"}
        </Text>
      </LinearGradient>

      {!accessToken && (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>Login required</Text>
          <Text style={styles.gateText}>
            Create an account to configure alert types, notifications, and watchlist triggers.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(tabs)/login")}>
            <Text style={styles.primaryButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {accessToken && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alert Types</Text>
            <View style={styles.symbolInputRow}>
              <TextInput
                style={styles.symbolInput}
                placeholder="Enter stock symbol (e.g. NABIL)"
                value={symbolInput}
                onChangeText={setSymbolInput}
                autoCapitalize="characters"
              />
            </View>
            {alertTypes.map((item) => (
              <View key={item.title} style={styles.alertCard}>
                <View style={styles.alertCardHeader}>
                  <View style={[styles.alertIcon, { backgroundColor: item.bg }]}>
                    <Feather name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>{item.title}</Text>
                    <Text style={styles.alertDesc}>{item.desc}</Text>
                  </View>
                </View>
                <View style={styles.alertMetaRow}>
                  <Text style={styles.alertMetaText}>{item.metaLeft}</Text>
                  <Text style={styles.alertMetaText}>{item.metaRight}</Text>
                </View>
                <TouchableOpacity
                  style={styles.alertButton}
                  onPress={() => handleCreateAlert(item.alertConfig)}
                >
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={styles.alertButtonText}>Create Alert</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            <View style={styles.preferenceCard}>
              <View style={styles.preferenceRow}>
                <View>
                  <Text style={styles.preferenceTitle}>Push Notifications</Text>
                  <Text style={styles.preferenceText}>Instant alerts on your phone.</Text>
                </View>
                <Switch value={pushEnabled} onValueChange={setPushEnabled} />
              </View>
              <View style={styles.preferenceRow}>
                <View>
                  <Text style={styles.preferenceTitle}>Email Summary</Text>
                  <Text style={styles.preferenceText}>Daily recap of triggers.</Text>
                </View>
                <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
              </View>
              <View style={styles.preferenceRow}>
                <View>
                  <Text style={styles.preferenceTitle}>In-App Alerts</Text>
                  <Text style={styles.preferenceText}>Show alerts in notification center.</Text>
                </View>
                <Switch value={inAppEnabled} onValueChange={setInAppEnabled} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Recent Notifications {alerts.length > 0 ? `(${alerts.length})` : ""}
            </Text>
            <View style={styles.notificationCard}>
              {alerts.length > 0 ? (
                alerts.slice(0, 10).map((item, index) => (
                  <View key={index} style={styles.notificationRow}>
                    <View style={[styles.notificationDot, {
                      backgroundColor:
                        item.alert?.alert_type === "price" ? "#16A34A"
                          : item.alert?.alert_type === "volume" ? "#2563EB"
                            : "#7C3AED"
                    }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationTitle}>
                        {item.alert?.symbol} {item.alert?.alert_type} — {item.alert?.message || "threshold crossed"}
                      </Text>
                      <Text style={styles.notificationTime}>{formatAlertTime(index)}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </View>
                ))
              ) : (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Feather name="bell-off" size={24} color="#94A3B8" />
                  <Text style={[styles.notificationTime, { marginTop: 8 }]}>
                    No alerts triggered yet. Create thresholds above to start receiving real-time alerts.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  hero: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "visible",
    position: "relative",
    zIndex: 2,
    elevation: 4,
  },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 10 },
  heroSubtitle: { color: "#E0E7FF", fontSize: 13, marginTop: 6 },
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
  section: { paddingHorizontal: 20, marginTop: 20 },
  symbolInputRow: { marginBottom: 12 },
  symbolInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  alertCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  alertCardHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  alertDesc: { fontSize: 12, color: "#64748B", marginTop: 4 },
  alertMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
  },
  alertMetaText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  alertButton: {
    marginTop: 12,
    backgroundColor: "#0B3B78",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  alertButtonText: { color: "#fff", fontWeight: "700" },
  preferenceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  preferenceTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  preferenceText: { fontSize: 12, color: "#64748B", marginTop: 4 },
  notificationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  notificationDot: { width: 10, height: 10, borderRadius: 5 },
  notificationTitle: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  notificationTime: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});
