import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { accessToken, updateUser } = useAuth();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [address, setAddress] = useState("");
  const [wardNo, setWardNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accessToken) {
      setError("Please log in again.");
      return;
    }

    const cleanName = name.trim();
    const cleanNumber = number.replace(/\s+/g, "");
    const cleanWard = wardNo.trim();

    if (!cleanName || !cleanNumber || !address || !cleanWard) {
      setError("Please fill all the fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updated = await apiFetch<{
        name: string;
        email: string;
      }>("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: cleanName,
          number: cleanNumber,
          address,
          wardNo: cleanWard,
        }),
      }, accessToken);

      updateUser({ userName: updated.name, email: updated.email });
      router.push("/(tabs)/dashboard");
    } catch (err: any) {
      setError(err?.message || "Unable to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Your Profile</Text>
        <Text style={styles.headerSubtitle}>We need a few details to finish signup.</Text>
      </View>

      <View style={styles.card}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={number}
          onChangeText={setNumber}
          keyboardType="phone-pad"
          placeholder="98XXXXXXXX"
        />

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Your address" />

        <Text style={styles.label}>Ward Number</Text>
        <TextInput
          style={styles.input}
          value={wardNo}
          onChangeText={(text) => setWardNo(text.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholder="Ward no"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save & Continue</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#0A2D5C",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: { marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSubtitle: { marginTop: 6, color: "#CBD5E1", fontSize: 13 },
  card: {
    marginTop: -20,
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    color: "#1E293B",
  },
  primaryButton: {
    backgroundColor: "#0B3B78",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },
  errorText: { color: "#B91C1C", fontSize: 12, fontWeight: "600" },
});
