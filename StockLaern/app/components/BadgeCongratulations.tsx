import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { BadgeItem } from "../context/GamificationContext";

const MESSAGES = [
  "You're on fire! 🔥",
  "Who is the superstar? YOU! ⭐",
  "Let's Go! 🚀",
  "Keep shining! ✨",
  "Unstoppable! 💪",
];

type Props = {
  badge: BadgeItem | null;
  onClose: () => void;
};

export default function BadgeCongratulations({ badge, onClose }: Props) {
  const [message] = useState(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
  );

  if (!badge) {
    return null;
  }

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.congrats}>🎉 Congratulations!</Text>
          <Text style={styles.badgeIcon}>{badge.icon}</Text>
          <Text style={styles.badgeName}>{badge.name}</Text>
          <Text style={styles.badgeDescription}>{badge.description}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Keep Going!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.76)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
  },
  congrats: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  badgeIcon: {
    fontSize: 52,
    marginTop: 18,
  },
  badgeName: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  badgeDescription: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: "center",
  },
  message: {
    color: "#0B3B78",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
  },
});
