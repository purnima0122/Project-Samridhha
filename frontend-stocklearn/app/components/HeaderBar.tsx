import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type HeaderBarProps = {
  rightSlot?: ReactNode;
  tint?: "light" | "dark";
};

export default function HeaderBar({ rightSlot, tint = "light" }: HeaderBarProps) {
  const router = useRouter();
  const isLight = tint === "light";

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.brandRow} onPress={() => router.push("/")}>
        <View style={[styles.brandIcon, isLight ? styles.brandIconLight : styles.brandIconDark]}>
          <Feather name="trending-up" size={18} color={isLight ? "#0B3B78" : "#fff"} />
        </View>
        <Text style={[styles.brandText, isLight ? styles.brandTextLight : styles.brandTextDark]}>
          StockLearn
        </Text>
      </TouchableOpacity>
      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brandIconLight: { backgroundColor: "rgba(255,255,255,0.9)" },
  brandIconDark: { backgroundColor: "rgba(255,255,255,0.2)" },
  brandText: { fontSize: 15, fontWeight: "700" },
  brandTextLight: { color: "#0F172A" },
  brandTextDark: { color: "#fff" },
});
