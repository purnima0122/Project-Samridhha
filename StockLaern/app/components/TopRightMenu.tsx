import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";

type ProfileDetails = {
  name?: string;
  email?: string;
  number?: string;
  wardNo?: string;
  address?: string;
};

type TopRightMenuProps = {
  theme?: "dark" | "light";
  details?: ProfileDetails | null;
};

export default function TopRightMenu({ theme = "dark", details }: TopRightMenuProps) {
  const router = useRouter();
  const { isAuthenticated, userName, email, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const display = useMemo(() => {
    const displayName = details?.name || userName || email?.split("@")[0] || "User";
    const displayEmail = details?.email || email || "account@example.com";
    return { displayName, displayEmail };
  }, [details?.name, details?.email, userName, email]);

  if (!isAuthenticated) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <View style={styles.wrapper}>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.iconButton, isDark ? styles.iconButtonDark : styles.iconButtonLight]}
          onPress={() => router.push("/(tabs)/alert-settings")}
        >
          <Feather name="bell" size={16} color={isDark ? "#fff" : "#0B3B78"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.trigger, isDark ? styles.triggerDark : styles.triggerLight]}
          onPress={() => setOpen((prev) => !prev)}
        >
          <View style={[styles.avatar, isDark ? styles.avatarLight : styles.avatarDark]}>
            <Feather name="user" size={14} color={isDark ? "#0B3B78" : "#fff"} />
          </View>
          <Text
            style={[styles.triggerName, isDark ? styles.triggerNameDark : styles.triggerNameLight]}
            numberOfLines={1}
          >
            {display.displayName}
          </Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={isDark ? "#fff" : "#0B3B78"} />
        </TouchableOpacity>
      </View>
        <TouchableOpacity
          style={[
            styles.dashboardButton,
            isDark ? styles.dashboardButtonDark : styles.dashboardButtonLight,
          ]}
          onPress={() => router.push("/(tabs)/dashboard")}
        >
          <Feather name="home" size={16} color={isDark ? "#fff" : "#0B3B78"} />
          <Text style={[styles.dashboardButtonText, isDark ? styles.dashboardTextDark : styles.dashboardTextLight]}>
            Return to Dashboard
          </Text>
        </TouchableOpacity>

      {open && (
        <View style={styles.menu}>
          <Text style={styles.menuName}>{display.displayName}</Text>
          <Text style={styles.menuEmail}>{display.displayEmail}</Text>
          {(details?.number || details?.wardNo || details?.address) && <View style={styles.divider} />}
          {details?.number && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{details.number}</Text>
            </View>
          )}
          {details?.wardNo && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ward</Text>
              <Text style={styles.infoValue}>{details.wardNo}</Text>
            </View>
          )}
          {details?.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{details.address}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              router.push("/(tabs)/profile");
            }}
          >
            <Feather name="user" size={16} color="#0B3B78" />
            <Text style={styles.menuItemText}>Profile Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              router.push("/(tabs)/alert-settings");
            }}
          >
            <Feather name="bell" size={16} color="#0B3B78" />
            <Text style={styles.menuItemText}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              router.push("/(tabs)/dashboard");
            }}
          >
            <Feather name="home" size={16} color="#0B3B78" />
            <Text style={styles.menuItemText}>Return to Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              signOut();
              router.push("/(tabs)/login");
            }}
          >
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "flex-end",
    position: "relative",
    zIndex: 20,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDark: { backgroundColor: "rgba(255,255,255,0.2)" },
  iconButtonLight: { backgroundColor: "#E2E8F0" },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 150,
  },
  triggerDark: { backgroundColor: "rgba(255,255,255,0.2)" },
  triggerLight: { backgroundColor: "#E2E8F0" },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLight: { backgroundColor: "#E0ECFF" },
  avatarDark: { backgroundColor: "#0B3B78" },
  triggerName: { fontSize: 12, fontWeight: "700" },
  triggerNameDark: { color: "#fff" },
  triggerNameLight: { color: "#0F172A" },
  dashboardButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dashboardButtonDark: { backgroundColor: "rgba(255,255,255,0.2)" },
  dashboardButtonLight: { backgroundColor: "#E2E8F0" },
  dashboardButtonText: { fontSize: 12, fontWeight: "700" },
  dashboardTextDark: { color: "#fff" },
  dashboardTextLight: { color: "#0B3B78" },
  menu: {
    position: "absolute",
    right: 0,
    top: 44,
    width: 230,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 30,
  },
  menuName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  menuEmail: { fontSize: 12, color: "#64748B", marginTop: 4 },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  infoLabel: { fontSize: 11, color: "#64748B" },
  infoValue: { fontSize: 11, color: "#0F172A", fontWeight: "600" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  menuItemText: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  logoutText: { color: "#EF4444" },
});
