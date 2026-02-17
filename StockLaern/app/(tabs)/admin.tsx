import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { useRouter } from "expo-router";

type Lesson = {
  _id: string;
  title: string;
  module: string;
  content: string;
  order: number;
  duration?: number;
  videoUrl?: string;
  color?: string;
  icon?: string;
  isPublished?: boolean;
};

type AlertItem = {
  _id: string;
  symbol: string;
  type: string;
  price: string;
  units: string;
  status: string;
};

type WatchlistItem = {
  _id: string;
  symbol: string;
  price?: string;
  change?: string;
  alertType?: string;
  isPositive?: boolean;
};

export default function AdminScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<"idle" | "allowed" | "forbidden" | "error">("idle");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonModule, setLessonModule] = useState("beginner");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonOrder, setLessonOrder] = useState("1");
  const [lessonDuration, setLessonDuration] = useState("5");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonColor, setLessonColor] = useState("#10B981");
  const [lessonIcon, setLessonIcon] = useState("BookOpen");

  const [quizPrompt, setQuizPrompt] = useState("");
  const [quizOptions, setQuizOptions] = useState("");
  const [quizCorrectIndex, setQuizCorrectIndex] = useState("0");
  const [quizExplanation, setQuizExplanation] = useState("");

  const [alertSymbol, setAlertSymbol] = useState("");
  const [alertType, setAlertType] = useState("greater than");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertUnits, setAlertUnits] = useState("");

  const [watchSymbol, setWatchSymbol] = useState("");
  const [watchPrice, setWatchPrice] = useState("");
  const [watchChange, setWatchChange] = useState("");
  const [watchAlertType, setWatchAlertType] = useState("");

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson._id === selectedLessonId) || null,
    [lessons, selectedLessonId],
  );

  const loadAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [lessonData, alertData, watchData] = await Promise.all([
        apiFetch<Lesson[]>("/lessons", {}, accessToken),
        apiFetch<AlertItem[]>("/alerts", {}, accessToken),
        apiFetch<WatchlistItem[]>("/watchlist", {}, accessToken),
      ]);
      setLessons(lessonData || []);
      setAlerts(alertData || []);
      setWatchlist(watchData || []);
      setAccessState("allowed");
    } catch (err: any) {
      if (err?.status === 403) {
        setAccessState("forbidden");
        setError("You are logged in, but this account does not have admin access.");
      } else {
        setAccessState("error");
        setError(err?.message || "Unable to load admin data.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setAccessState("idle");
      setError(null);
      return;
    }
    loadAll();
  }, [accessToken, loadAll]);

  useEffect(() => {
    if (!selectedLesson) return;
    setLessonTitle(selectedLesson.title);
    setLessonModule(selectedLesson.module);
    setLessonContent(selectedLesson.content);
    setLessonOrder(String(selectedLesson.order ?? 1));
    setLessonDuration(String(selectedLesson.duration ?? 5));
    setLessonVideoUrl(selectedLesson.videoUrl || "");
    setLessonColor(selectedLesson.color || "#10B981");
    setLessonIcon(selectedLesson.icon || "BookOpen");
  }, [selectedLesson]);

  const resetLessonForm = () => {
    setSelectedLessonId(null);
    setLessonTitle("");
    setLessonModule("beginner");
    setLessonContent("");
    setLessonOrder("1");
    setLessonDuration("5");
    setLessonVideoUrl("");
    setLessonColor("#10B981");
    setLessonIcon("BookOpen");
  };

  const handleLessonSave = async () => {
    if (!accessToken) return;
    const trimmedTitle = lessonTitle.trim();
    const trimmedModule = lessonModule.trim();
    const trimmedContent = lessonContent.trim();
    const parsedOrder = Number(lessonOrder);
    const parsedDuration = Number(lessonDuration);

    if (!trimmedTitle || !trimmedModule || !trimmedContent) {
      setError("Lesson title, module, and content are required.");
      return;
    }
    if (Number.isNaN(parsedOrder) || parsedOrder < 0) {
      setError("Lesson order must be a valid non-negative number.");
      return;
    }
    if (Number.isNaN(parsedDuration) || parsedDuration < 0) {
      setError("Lesson duration must be a valid non-negative number.");
      return;
    }

    const payload = {
      title: trimmedTitle,
      module: trimmedModule,
      content: trimmedContent,
      order: parsedOrder,
      duration: parsedDuration,
      videoUrl: lessonVideoUrl,
      color: lessonColor,
      icon: lessonIcon,
    };

    try {
      setError(null);
      if (selectedLessonId) {
        await apiFetch(`/lessons/${selectedLessonId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }, accessToken);
      } else {
        await apiFetch("/lessons", {
          method: "POST",
          body: JSON.stringify(payload),
        }, accessToken);
      }
      resetLessonForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to save lesson.");
    }
  };

  const handleLessonDelete = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/lessons/${id}`, { method: "DELETE" }, accessToken);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to delete lesson.");
    }
  };

  const handleQuizAdd = async () => {
    if (!accessToken || !selectedLessonId) return;
    if (!quizPrompt.trim()) {
      setError("Quiz prompt is required.");
      return;
    }
    const options = quizOptions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const correctIndex = Number(quizCorrectIndex);
    if (options.length < 2) {
      setError("Please provide at least two quiz options.");
      return;
    }
    if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      setError("Correct option index must match one of the options.");
      return;
    }
    try {
      setError(null);
      await apiFetch(`/lessons/${selectedLessonId}/quiz`, {
        method: "POST",
        body: JSON.stringify({
          prompt: quizPrompt,
          options,
          correctOptionIndex: correctIndex,
          explanation: quizExplanation || undefined,
        }),
      }, accessToken);
      setQuizPrompt("");
      setQuizOptions("");
      setQuizCorrectIndex("0");
      setQuizExplanation("");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to add quiz question.");
    }
  };

  const handleAlertCreate = async () => {
    if (!accessToken) return;
    if (!alertSymbol.trim() || !alertPrice.trim() || !alertUnits.trim()) {
      setError("Alert symbol, price, and units are required.");
      return;
    }
    try {
      setError(null);
      await apiFetch("/alerts", {
        method: "POST",
        body: JSON.stringify({
          symbol: alertSymbol,
          type: alertType,
          price: alertPrice,
          units: alertUnits,
          status: "active",
        }),
      }, accessToken);
      setAlertSymbol("");
      setAlertPrice("");
      setAlertUnits("");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to create alert.");
    }
  };

  const handleAlertDelete = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/alerts/${id}`, { method: "DELETE" }, accessToken);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to delete alert.");
    }
  };

  const handleWatchCreate = async () => {
    if (!accessToken) return;
    if (!watchSymbol.trim()) {
      setError("Watchlist symbol is required.");
      return;
    }
    try {
      setError(null);
      await apiFetch("/watchlist", {
        method: "POST",
        body: JSON.stringify({
          symbol: watchSymbol,
          price: watchPrice || undefined,
          change: watchChange || undefined,
          alertType: watchAlertType || undefined,
          isPositive: watchChange?.includes("-") ? false : true,
        }),
      }, accessToken);
      setWatchSymbol("");
      setWatchPrice("");
      setWatchChange("");
      setWatchAlertType("");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to create watchlist item.");
    }
  };

  const handleWatchDelete = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/watchlist/${id}`, { method: "DELETE" }, accessToken);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to delete watchlist item.");
    }
  };

  if (!accessToken) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Admin Access</Text>
        <Text style={styles.centeredText}>Please log in as an admin to continue.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/profile")}>
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (accessState === "forbidden") {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Admin Access Required</Text>
        <Text style={styles.centeredText}>
          You are logged in, but this account is not marked as admin in the backend.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/")}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Console</Text>
        <TouchableOpacity onPress={loadAll} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={16} color="#0369A1" />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#70A288" />
          <Text style={styles.loadingText}>Loading admin data...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Admin Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lessons</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Lesson Title</Text>
          <TextInput value={lessonTitle} onChangeText={setLessonTitle} style={styles.input} placeholder="Lesson title" />
          <Text style={styles.label}>Module</Text>
          <TextInput value={lessonModule} onChangeText={setLessonModule} style={styles.input} placeholder="beginner" />
          <Text style={styles.label}>Content</Text>
          <TextInput value={lessonContent} onChangeText={setLessonContent} style={[styles.input, styles.multiline]} multiline />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Order</Text>
              <TextInput value={lessonOrder} onChangeText={setLessonOrder} style={styles.input} keyboardType="numeric" />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Duration (min)</Text>
              <TextInput value={lessonDuration} onChangeText={setLessonDuration} style={styles.input} keyboardType="numeric" />
            </View>
          </View>
          <Text style={styles.label}>Video URL</Text>
          <TextInput value={lessonVideoUrl} onChangeText={setLessonVideoUrl} style={styles.input} placeholder="https://..." />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Color</Text>
              <TextInput value={lessonColor} onChangeText={setLessonColor} style={styles.input} placeholder="#10B981" />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Icon</Text>
              <TextInput value={lessonIcon} onChangeText={setLessonIcon} style={styles.input} placeholder="BookOpen" />
            </View>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleLessonSave}>
              <Text style={styles.primaryButtonText}>{selectedLessonId ? "Update Lesson" : "Create Lesson"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetLessonForm}>
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.subTitle}>Add Quiz Question</Text>
          <Text style={styles.label}>Select Lesson</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {lessons.map((lesson) => (
              <TouchableOpacity
                key={lesson._id}
                style={[
                  styles.chip,
                  selectedLessonId === lesson._id && styles.chipActive,
                ]}
                onPress={() => setSelectedLessonId(lesson._id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedLessonId === lesson._id && styles.chipTextActive,
                  ]}
                >
                  {lesson.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Prompt</Text>
          <TextInput value={quizPrompt} onChangeText={setQuizPrompt} style={styles.input} />
          <Text style={styles.label}>Options (comma separated)</Text>
          <TextInput value={quizOptions} onChangeText={setQuizOptions} style={styles.input} />
          <Text style={styles.label}>Correct Option Index</Text>
          <TextInput value={quizCorrectIndex} onChangeText={setQuizCorrectIndex} style={styles.input} keyboardType="numeric" />
          <Text style={styles.label}>Explanation</Text>
          <TextInput value={quizExplanation} onChangeText={setQuizExplanation} style={styles.input} />
          <TouchableOpacity style={styles.primaryButton} onPress={handleQuizAdd}>
            <Text style={styles.primaryButtonText}>Add Quiz Question</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.subTitle}>Existing Lessons</Text>
          {lessons.map((lesson) => (
            <View key={lesson._id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{lesson.title}</Text>
                <Text style={styles.listMeta}>Module: {lesson.module} | Order: {lesson.order}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedLessonId(lesson._id)} style={styles.listButton}>
                <Text style={styles.listButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleLessonDelete(lesson._id)} style={styles.dangerButton}>
                <Text style={styles.dangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stock Alerts</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Symbol</Text>
          <TextInput value={alertSymbol} onChangeText={setAlertSymbol} style={styles.input} />
          <Text style={styles.label}>Type</Text>
          <TextInput value={alertType} onChangeText={setAlertType} style={styles.input} />
          <Text style={styles.label}>Price</Text>
          <TextInput value={alertPrice} onChangeText={setAlertPrice} style={styles.input} />
          <Text style={styles.label}>Units</Text>
          <TextInput value={alertUnits} onChangeText={setAlertUnits} style={styles.input} />
          <TouchableOpacity style={styles.primaryButton} onPress={handleAlertCreate}>
            <Text style={styles.primaryButtonText}>Create Alert</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {alerts.map((alert) => (
            <View key={alert._id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{alert.symbol}</Text>
                <Text style={styles.listMeta}>
                  {alert.type} {alert.price} | {alert.units}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleAlertDelete(alert._id)} style={styles.dangerButton}>
                <Text style={styles.dangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Watchlist</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Symbol</Text>
          <TextInput value={watchSymbol} onChangeText={setWatchSymbol} style={styles.input} />
          <Text style={styles.label}>Price</Text>
          <TextInput value={watchPrice} onChangeText={setWatchPrice} style={styles.input} />
          <Text style={styles.label}>Change</Text>
          <TextInput value={watchChange} onChangeText={setWatchChange} style={styles.input} />
          <Text style={styles.label}>Alert Type</Text>
          <TextInput value={watchAlertType} onChangeText={setWatchAlertType} style={styles.input} />
          <TouchableOpacity style={styles.primaryButton} onPress={handleWatchCreate}>
            <Text style={styles.primaryButtonText}>Add to Watchlist</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {watchlist.map((item) => (
            <View key={item._id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.symbol}</Text>
                <Text style={styles.listMeta}>
                  {item.price || "--"} | {item.change || "--"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleWatchDelete(item._id)} style={styles.dangerButton}>
                <Text style={styles.dangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    flex: 1,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E0F2FE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshBtnText: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: "#1E293B",
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  rowItem: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: "#04395E",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  listMeta: {
    fontSize: 12,
    color: "#64748B",
  },
  listButton: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listButtonText: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dangerButtonText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  centeredText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  loadingRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B91C1C",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#991B1B",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: "#04395E",
  },
  chipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
});

