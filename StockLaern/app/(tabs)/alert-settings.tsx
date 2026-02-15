import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
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

const alertTypes = [
  {
    title: "Volume Spike Alert",
    desc: "Get notified when volume exceeds average by a threshold.",
    icon: "bar-chart-2",
    color: "#2563EB",
    bg: "#DBEAFE",
    metaLeft: "Threshold 150%",
    metaRight: "Timeframe 1 hour",
  },
  {
    title: "Price Jump Alert",
    desc: "Alert when price increases by a set percentage.",
    icon: "trending-up",
    color: "#16A34A",
    bg: "#DCFCE7",
    metaLeft: "Threshold 3%",
    metaRight: "Timeframe realtime",
  },
  {
    title: "Price Drop Alert",
    desc: "Alert when price drops below a set percentage.",
    icon: "trending-down",
    color: "#DC2626",
    bg: "#FEE2E2",
    metaLeft: "Threshold 3%",
    metaRight: "Timeframe realtime",
  },
  {
    title: "Trend Change Alert",
    desc: "Detect bullish or bearish trend reversals.",
    icon: "activity",
    color: "#7C3AED",
    bg: "#EDE9FE",
    metaLeft: "Sensitivity medium",
    metaRight: "Timeframe 24 hours",
  },
];

const notifications = [
  { title: "NABIL volume spike", time: "2m ago", color: "#2563EB" },
  { title: "NICA price jump +3.2%", time: "12m ago", color: "#16A34A" },
  { title: "EBL price drop -2.8%", time: "38m ago", color: "#DC2626" },
];

export default function AlertSettingsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);

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
                <TouchableOpacity style={styles.alertButton}>
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
            <Text style={styles.sectionTitle}>Recent Notifications</Text>
            <View style={styles.notificationCard}>
              {notifications.map((item) => (
                <View key={item.title} style={styles.notificationRow}>
                  <View style={[styles.notificationDot, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationTime}>{item.time}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#94A3B8" />
                </View>
              ))}
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
