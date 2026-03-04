import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function GuestAuthActions() {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={() => router.push("/login")}>
        <Text style={[styles.buttonText, styles.loginText]}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.registerButton]} onPress={() => router.push("/signup")}>
        <Text style={[styles.buttonText, styles.registerText]}>Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  loginButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.45)",
  },
  registerButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loginText: {
    color: "#FFFFFF",
  },
  registerText: {
    color: "#0B3B78",
  },
});
