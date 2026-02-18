import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
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
import { useDataServer } from "../context/DataServerContext";

type NotificationFilter =
  | "all"
  | "unread"
  | "volume"
  | "price"
  | "trend"
  | "learning"
  | "coaching"
  | "system";

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "volume", label: "Volume" },
  { key: "price", label: "Price" },
  { key: "trend", label: "Trend" },
  { key: "learning", label: "Learning" },
  { key: "coaching", label: "Coaching" },
  { key: "system", label: "System" },
];

function formatRelativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) {
    return "just now";
  }
  const deltaMs = Date.now() - timestamp;
  const deltaMin = Math.max(0, Math.floor(deltaMs / 60000));
  if (deltaMin < 1) return "just now";
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDay = Math.floor(deltaHr / 24);
  return `${deltaDay}d ago`;
}

function iconForType(type: string): { icon: any; color: string; bg: string } {
  switch (type) {
    case "volume":
      return { icon: "bar-chart-2", color: "#2563EB", bg: "#DBEAFE" };
    case "price":
      return { icon: "trending-up", color: "#16A34A", bg: "#DCFCE7" };
    case "trend":
      return { icon: "activity", color: "#A855F7", bg: "#EDE9FE" };
    case "learning":
      return { icon: "book-open", color: "#7C3AED", bg: "#F3E8FF" };
    case "coaching":
      return { icon: "shield", color: "#1D4ED8", bg: "#DBEAFE" };
    default:
      return { icon: "bell", color: "#0F172A", bg: "#E2E8F0" };
  }
}

export default function NotificationsScreen() {
  const {
    notifications,
    unreadNotificationCount,
    notificationSettings,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearNotifications,
    updateNotificationSettings,
  } = useDataServer();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const filteredNotifications = useMemo(() => {
    if (filter === "all") {
      return notifications;
    }
    if (filter === "unread") {
      return notifications.filter((item) => !item.read);
    }
    return notifications.filter((item) => item.type === filter);
  }, [filter, notifications]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        <Text style={styles.heroTitle}>Notifications</Text>
        <Text style={styles.heroSubtitle}>
          {unreadNotificationCount > 0
            ? `You have ${unreadNotificationCount} unread notifications`
            : "All notifications are read"}
        </Text>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            {FILTERS.map((entry) => (
              <TouchableOpacity
                key={entry.key}
                style={[styles.filterChip, filter === entry.key ? styles.filterChipSelected : null]}
                onPress={() => setFilter(entry.key)}
              >
                <Text
                  style={[styles.filterChipText, filter === entry.key ? styles.filterChipTextSelected : null]}
                >
                  {entry.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.filterActions}>
            <TouchableOpacity onPress={markAllNotificationsRead}>
              <Text style={styles.filterActionText}>Mark all read</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearNotifications}>
              <Text style={[styles.filterActionText, styles.dangerText]}>Clear all</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="inbox" size={20} color="#94A3B8" />
            <Text style={styles.emptyText}>No notifications for this filter yet.</Text>
          </View>
        ) : (
          filteredNotifications.map((item, index) => {
            const iconMeta = iconForType(item.type);
            return (
              <View key={`${item.id}-${index}`} style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: iconMeta.bg }]}>
                  <Feather name={iconMeta.icon} size={18} color={iconMeta.color} />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  <Text style={styles.itemLesson}>What this means: {item.lesson}</Text>
                  <Text style={styles.itemTip}>How to handle: {item.tip}</Text>
                  <Text style={styles.itemTime}>{formatRelativeTime(item.createdAt)}</Text>

                  <View style={styles.itemActions}>
                    {!item.read && (
                      <TouchableOpacity onPress={() => markNotificationRead(item.id)}>
                        <Text style={styles.markReadText}>Mark read</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => removeNotification(item.id)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Notification Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Volume Spike Alerts</Text>
              <Text style={styles.settingDesc}>Notify when volume spikes above threshold.</Text>
            </View>
            <Switch
              value={notificationSettings.volume}
              onValueChange={(value) => updateNotificationSettings({ volume: value })}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Price Movement Alerts</Text>
              <Text style={styles.settingDesc}>Notify on significant price changes.</Text>
            </View>
            <Switch
              value={notificationSettings.price}
              onValueChange={(value) => updateNotificationSettings({ price: value })}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Trend Change Alerts</Text>
              <Text style={styles.settingDesc}>Notify when trend reversal signals appear.</Text>
            </View>
            <Switch
              value={notificationSettings.trend}
              onValueChange={(value) => updateNotificationSettings({ trend: value })}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Learning Nudges</Text>
              <Text style={styles.settingDesc}>Show contextual lessons and quick tips.</Text>
            </View>
            <Switch
              value={notificationSettings.learning}
              onValueChange={(value) => updateNotificationSettings({ learning: value })}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Behavioral Coaching</Text>
              <Text style={styles.settingDesc}>Show discipline and risk-management reminders.</Text>
            </View>
            <Switch
              value={notificationSettings.coaching}
              onValueChange={(value) => updateNotificationSettings({ coaching: value })}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Email Notifications</Text>
              <Text style={styles.settingDesc}>UI toggle for future email integration.</Text>
            </View>
            <Switch
              value={notificationSettings.email}
              onValueChange={(value) => updateNotificationSettings({ email: value })}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EFF8",
  },
  contentContainer: {
    paddingBottom: 40,
  },
  hero: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "visible",
    position: "relative",
    zIndex: 20,
  },
  heroTitle: {
    marginTop: 0,
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
  },
  heroSubtitle: {
    marginTop: 10,
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    paddingHorizontal: 18,
    marginTop: 18,
  },
  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  filterChipSelected: {
    borderColor: "#4338CA",
    backgroundColor: "#EEF2FF",
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: "#3730A3",
  },
  filterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  filterActionText: {
    color: "#4338CA",
    fontWeight: "700",
    fontSize: 12,
  },
  dangerText: {
    color: "#DC2626",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
  },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8B4FE",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    paddingRight: 10,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EC4899",
  },
  itemMessage: {
    marginTop: 6,
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
  },
  itemLesson: {
    marginTop: 6,
    color: "#1E3A8A",
    fontSize: 12,
    lineHeight: 17,
  },
  itemTip: {
    marginTop: 4,
    color: "#4338CA",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  itemTime: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 11,
  },
  itemActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  markReadText: {
    color: "#6D28D9",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 12,
  },
  settingsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  settingsTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  settingRow: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  settingTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  settingTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  settingDesc: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 12,
  },
});
