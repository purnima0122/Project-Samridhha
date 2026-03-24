import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StreakStatus } from "../context/GamificationContext";

type Props = {
  streak: number;
  freezes: number;
  maxFreezes?: number;
  status?: StreakStatus | null;
};

export default function StreakDisplay({
  streak,
  freezes,
  maxFreezes,
  status,
}: Props) {
  if (status === "streak_lost" && freezes === 0) {
    return (
      <View style={[styles.card, styles.sadCard]}>
        <Text style={styles.emoji}>😢</Text>
        <Text style={styles.title}>Your streak is gone</Text>
        <Text style={styles.subtitle}>No freezes left</Text>
        <Text style={styles.helper}>Start fresh with a lesson today.</Text>
      </View>
    );
  }

  if (status === "freeze_used") {
    return (
      <View style={[styles.card, styles.freezeCard]}>
        <Text style={styles.emoji}>🧊</Text>
        <Text style={styles.title}>Streak freeze used!</Text>
        <Text style={styles.subtitle}>
          {freezes} freeze{freezes === 1 ? "" : "s"} remaining
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.fireCard]}>
      <Text style={styles.mainCount}>🔥 {streak} Day Streak</Text>
      <Text style={styles.subtitle}>
        🧊 {freezes}
        {typeof maxFreezes === "number" ? `/${maxFreezes}` : ""} freeze
        {freezes === 1 ? "" : "s"}
      </Text>
      {status === "at_risk" && (
        <Text style={styles.helper}>Finish a lesson today to protect it.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  fireCard: {
    backgroundColor: "#081D38",
    borderColor: "#1E3A5F",
  },
  freezeCard: {
    backgroundColor: "#0B1F33",
    borderColor: "#3B82F6",
  },
  sadCard: {
    backgroundColor: "#2A0F14",
    borderColor: "#F87171",
  },
  emoji: {
    fontSize: 34,
    marginBottom: 8,
  },
  mainCount: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "#BFDBFE",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  helper: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
});
