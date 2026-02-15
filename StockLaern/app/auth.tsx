import { View, Text, StyleSheet } from "react-native";

export default function AuthRedirectScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Completing sign-in…</Text>
      <Text style={styles.subtitle}>You can close this tab and return to the app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 8, textAlign: "center" },
});
