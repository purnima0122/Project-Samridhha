import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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
  quiz?: QuizQuestion[];
};

type QuizQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
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

type NewsItem = {
  _id: string;
  title: string;
  summary: string;
  source?: string;
  url?: string;
  category?: string;
  imageUrl?: string;
  isPublished?: boolean;
  publishedAt?: string;
};

type AdminPanel = "learning" | "alerts" | "watchlist" | "news";

export default function AdminScreen() {
  const router = useRouter();
  const { accessToken, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<"idle" | "allowed" | "forbidden" | "error">("idle");
  const [activePanel, setActivePanel] = useState<AdminPanel>("learning");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonSearch, setLessonSearch] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonModule, setLessonModule] = useState("beginner");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonOrder, setLessonOrder] = useState("1");
  const [lessonDuration, setLessonDuration] = useState("5");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonColor, setLessonColor] = useState("#10B981");
  const [lessonIcon, setLessonIcon] = useState("BookOpen");
  const [lessonPublished, setLessonPublished] = useState(true);

  const [quizPrompt, setQuizPrompt] = useState("");
  const [quizOptions, setQuizOptions] = useState("");
  const [quizCorrectIndex, setQuizCorrectIndex] = useState("0");
  const [quizExplanation, setQuizExplanation] = useState("");
  const [quizEditIndex, setQuizEditIndex] = useState<number | null>(null);

  const [alertSymbol, setAlertSymbol] = useState("");
  const [alertType, setAlertType] = useState("greater than");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertUnits, setAlertUnits] = useState("");

  const [watchSymbol, setWatchSymbol] = useState("");
  const [watchPrice, setWatchPrice] = useState("");
  const [watchChange, setWatchChange] = useState("");
  const [watchAlertType, setWatchAlertType] = useState("");

  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [newsSearch, setNewsSearch] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsSummary, setNewsSummary] = useState("");
  const [newsSource, setNewsSource] = useState("");
  const [newsUrl, setNewsUrl] = useState("");
  const [newsCategory, setNewsCategory] = useState("");
  const [newsImageUrl, setNewsImageUrl] = useState("");
  const [newsPublished, setNewsPublished] = useState(true);
  const [newsPublishedAt, setNewsPublishedAt] = useState("");

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson._id === selectedLessonId) || null,
    [lessons, selectedLessonId],
  );

  const filteredLessons = useMemo(() => {
    const query = lessonSearch.trim().toLowerCase();
    if (!query) {
      return lessons;
    }
    return lessons.filter((lesson) => {
      return (
        lesson.title.toLowerCase().includes(query) ||
        lesson.module.toLowerCase().includes(query)
      );
    });
  }, [lessonSearch, lessons]);

  const selectedNews = useMemo(
    () => news.find((item) => item._id === selectedNewsId) || null,
    [news, selectedNewsId],
  );

  const filteredNews = useMemo(() => {
    const query = newsSearch.trim().toLowerCase();
    if (!query) return news;
    return news.filter((item) => {
      const title = item.title?.toLowerCase() || "";
      const summary = item.summary?.toLowerCase() || "";
      const source = item.source?.toLowerCase() || "";
      const category = item.category?.toLowerCase() || "";
      return (
        title.includes(query) ||
        summary.includes(query) ||
        source.includes(query) ||
        category.includes(query)
      );
    });
  }, [news, newsSearch]);

  const loadAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [lessonData, alertData, watchData, newsData] = await Promise.all([
        apiFetch<Lesson[]>("/lessons/admin/all", {}, accessToken),
        apiFetch<AlertItem[]>("/alerts", {}, accessToken),
        apiFetch<WatchlistItem[]>("/watchlist", {}, accessToken),
        apiFetch<NewsItem[]>("/news/admin/all", {}, accessToken),
      ]);
      setLessons(lessonData || []);
      setAlerts(alertData || []);
      setWatchlist(watchData || []);
      setNews(newsData || []);
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
    setLessonPublished(Boolean(selectedLesson.isPublished));
  }, [selectedLesson]);

  useEffect(() => {
    if (!selectedNews) return;
    setNewsTitle(selectedNews.title || "");
    setNewsSummary(selectedNews.summary || "");
    setNewsSource(selectedNews.source || "");
    setNewsUrl(selectedNews.url || "");
    setNewsCategory(selectedNews.category || "");
    setNewsImageUrl(selectedNews.imageUrl || "");
    setNewsPublished(Boolean(selectedNews.isPublished));
    setNewsPublishedAt(
      selectedNews.publishedAt
        ? new Date(selectedNews.publishedAt).toISOString().slice(0, 16)
        : "",
    );
  }, [selectedNews]);

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
    setLessonPublished(true);
  };

  const resetQuizForm = () => {
    setQuizPrompt("");
    setQuizOptions("");
    setQuizCorrectIndex("0");
    setQuizExplanation("");
    setQuizEditIndex(null);
  };

  const resetNewsForm = () => {
    setSelectedNewsId(null);
    setNewsTitle("");
    setNewsSummary("");
    setNewsSource("");
    setNewsUrl("");
    setNewsCategory("");
    setNewsImageUrl("");
    setNewsPublished(true);
    setNewsPublishedAt("");
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
      videoUrl: lessonVideoUrl.trim(),
      color: lessonColor.trim() || "#10B981",
      icon: lessonIcon.trim() || "BookOpen",
      isPublished: lessonPublished,
    };

    try {
      setError(null);
      if (selectedLessonId) {
        await apiFetch(
          `/lessons/${selectedLessonId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          accessToken,
        );
      } else {
        await apiFetch(
          "/lessons",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          accessToken,
        );
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
      if (selectedLessonId === id) {
        resetLessonForm();
      }
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to delete lesson.");
    }
  };

  const handleQuizSave = async () => {
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
      const payload = {
        prompt: quizPrompt,
        options,
        correctOptionIndex: correctIndex,
        explanation: quizExplanation || undefined,
      };
      if (quizEditIndex === null) {
        await apiFetch(
          `/lessons/${selectedLessonId}/quiz`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          accessToken,
        );
      } else {
        await apiFetch(
          `/lessons/${selectedLessonId}/quiz/${quizEditIndex}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          accessToken,
        );
      }
      resetQuizForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to save quiz question.");
    }
  };

  const handleQuizEdit = (question: QuizQuestion, index: number) => {
    setQuizPrompt(question.prompt || "");
    setQuizOptions((question.options || []).join(", "));
    setQuizCorrectIndex(String(question.correctOptionIndex ?? 0));
    setQuizExplanation(question.explanation || "");
    setQuizEditIndex(index);
  };

  const handleQuizDelete = async (index: number) => {
    if (!accessToken || !selectedLessonId) return;
    try {
      setError(null);
      await apiFetch(
        `/lessons/${selectedLessonId}/quiz/${index}`,
        { method: "DELETE" },
        accessToken,
      );
      resetQuizForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to delete quiz question.");
    }
  };

  const handleNewsSave = async () => {
    if (!accessToken) return;
    if (!newsTitle.trim() || !newsSummary.trim()) {
      setError("News title and summary are required.");
      return;
    }
    let publishedDate: string | undefined;
    if (newsPublishedAt?.trim()) {
      const parsed = new Date(newsPublishedAt);
      if (Number.isNaN(parsed.getTime())) {
        setError("Published date format is invalid. Use YYYY-MM-DDTHH:mm.");
        return;
      }
      publishedDate = parsed.toISOString();
    }
    const payload = {
      title: newsTitle.trim(),
      summary: newsSummary.trim(),
      source: newsSource.trim(),
      url: newsUrl.trim(),
      category: newsCategory.trim(),
      imageUrl: newsImageUrl.trim(),
      isPublished: newsPublished,
      publishedAt: publishedDate,
    };
    try {
      setError(null);
      if (selectedNewsId) {
        await apiFetch(
          `/news/${selectedNewsId}`,
          { method: "PATCH", body: JSON.stringify(payload) },
          accessToken,
        );
      } else {
        await apiFetch(
          "/news",
          { method: "POST", body: JSON.stringify(payload) },
          accessToken,
        );
      }
      resetNewsForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to save news item.");
    }
  };

  const handleNewsDelete = async (id: string) => {
    if (!accessToken) return;
    try {
      setError(null);
      await apiFetch(`/news/${id}`, { method: "DELETE" }, accessToken);
      if (selectedNewsId === id) {
        resetNewsForm();
      }
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to delete news item.");
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
      await apiFetch(
        "/alerts",
        {
          method: "POST",
          body: JSON.stringify({
            symbol: alertSymbol,
            type: alertType,
            price: alertPrice,
            units: alertUnits,
            status: "active",
          }),
        },
        accessToken,
      );
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
      await apiFetch(
        "/watchlist",
        {
          method: "POST",
          body: JSON.stringify({
            symbol: watchSymbol,
            price: watchPrice || undefined,
            change: watchChange || undefined,
            alertType: watchAlertType || undefined,
            isPositive: watchChange?.includes("-") ? false : true,
          }),
        },
        accessToken,
      );
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

  if (accessState === "forbidden" || !isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Admin Access Required</Text>
        <Text style={styles.centeredText}>
          This account is not marked as admin in the backend.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/")}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <View style={styles.hero}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Admin Portal</Text>
          <Text style={styles.heroSubtitle}>Manage lessons, quizzes, alerts, watchlist, and news</Text>
        </View>
        <TouchableOpacity onPress={loadAll} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={16} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{lessons.length}</Text>
          <Text style={styles.statLabel}>Lessons</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{alerts.length}</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{watchlist.length}</Text>
          <Text style={styles.statLabel}>Watchlist</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{news.length}</Text>
          <Text style={styles.statLabel}>News</Text>
        </View>
      </View>

      <View style={styles.panelTabs}>
        <PanelTab
          label="Learning"
          icon="book-open"
          active={activePanel === "learning"}
          onPress={() => setActivePanel("learning")}
        />
        <PanelTab
          label="Alerts"
          icon="alert-triangle"
          active={activePanel === "alerts"}
          onPress={() => setActivePanel("alerts")}
        />
        <PanelTab
          label="Watchlist"
          icon="list"
          active={activePanel === "watchlist"}
          onPress={() => setActivePanel("watchlist")}
        />
        <PanelTab
          label="News"
          icon="file-text"
          active={activePanel === "news"}
          onPress={() => setActivePanel("news")}
        />
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#0369A1" />
          <Text style={styles.loadingText}>Loading admin data...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Admin Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {activePanel === "learning" && (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedLessonId ? "Edit Lesson" : "Create Lesson"}</Text>
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
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Published</Text>
              <Switch value={lessonPublished} onValueChange={setLessonPublished} trackColor={{ true: "#86EFAC", false: "#CBD5E1" }} />
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
            <Text style={styles.cardTitle}>
              {quizEditIndex === null ? "Add Quiz Question" : "Edit Quiz Question"}
            </Text>
            <Text style={styles.label}>Select Lesson</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {lessons.map((lesson) => (
                <TouchableOpacity
                  key={lesson._id}
                  style={[styles.chip, selectedLessonId === lesson._id && styles.chipActive]}
                  onPress={() => setSelectedLessonId(lesson._id)}
                >
                  <Text style={[styles.chipText, selectedLessonId === lesson._id && styles.chipTextActive]}>{lesson.title}</Text>
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
            <View style={styles.row}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleQuizSave}>
                <Text style={styles.primaryButtonText}>
                  {quizEditIndex === null ? "Add Quiz Question" : "Update Quiz Question"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetQuizForm}>
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {selectedLesson?.quiz && selectedLesson.quiz.length > 0 && (
              <View>
                <Text style={styles.label}>Existing Questions</Text>
                {selectedLesson.quiz.map((question, index) => (
                  <View key={`${selectedLesson._id}-quiz-${index}`} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>Q{index + 1}. {question.prompt}</Text>
                      <Text style={styles.listMeta}>
                        Correct: Option {question.correctOptionIndex}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleQuizEdit(question, index)}
                      style={styles.listButton}
                    >
                      <Text style={styles.listButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleQuizDelete(index)}
                      style={styles.dangerButton}
                    >
                      <Text style={styles.dangerButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Existing Lessons</Text>
            <TextInput
              value={lessonSearch}
              onChangeText={setLessonSearch}
              style={styles.input}
              placeholder="Search by title or module"
            />
            {filteredLessons.map((lesson) => (
              <View key={lesson._id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{lesson.title}</Text>
                  <Text style={styles.listMeta}>
                    Module: {lesson.module} | Order: {lesson.order} | {lesson.isPublished ? "Published" : "Draft"}
                  </Text>
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
      )}

      {activePanel === "alerts" && (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Alert</Text>
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
            <Text style={styles.cardTitle}>Existing Alerts</Text>
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
      )}

      {activePanel === "watchlist" && (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Watchlist Entry</Text>
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
            <Text style={styles.cardTitle}>Existing Watchlist</Text>
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
      )}

      {activePanel === "news" && (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedNewsId ? "Edit News" : "Create News"}</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput value={newsTitle} onChangeText={setNewsTitle} style={styles.input} />
            <Text style={styles.label}>Summary</Text>
            <TextInput
              value={newsSummary}
              onChangeText={setNewsSummary}
              style={[styles.input, styles.multiline]}
              multiline
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Source</Text>
                <TextInput value={newsSource} onChangeText={setNewsSource} style={styles.input} />
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Category</Text>
                <TextInput value={newsCategory} onChangeText={setNewsCategory} style={styles.input} />
              </View>
            </View>
            <Text style={styles.label}>URL</Text>
            <TextInput
              value={newsUrl}
              onChangeText={setNewsUrl}
              style={styles.input}
              placeholder="https://..."
            />
            <Text style={styles.label}>Image URL</Text>
            <TextInput
              value={newsImageUrl}
              onChangeText={setNewsImageUrl}
              style={styles.input}
              placeholder="https://..."
            />
            <Text style={styles.label}>Published At (optional: YYYY-MM-DDTHH:mm)</Text>
            <TextInput
              value={newsPublishedAt}
              onChangeText={setNewsPublishedAt}
              style={styles.input}
              placeholder="2026-03-08T16:30"
            />
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Published</Text>
              <Switch value={newsPublished} onValueChange={setNewsPublished} trackColor={{ true: "#86EFAC", false: "#CBD5E1" }} />
            </View>
            <View style={styles.row}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleNewsSave}>
                <Text style={styles.primaryButtonText}>
                  {selectedNewsId ? "Update News" : "Create News"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetNewsForm}>
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Existing News</Text>
            <TextInput
              value={newsSearch}
              onChangeText={setNewsSearch}
              style={styles.input}
              placeholder="Search by title, summary, source, or category"
            />
            {filteredNews.map((item) => (
              <View key={item._id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listMeta}>
                    {(item.source || "Unknown source")} | {item.category || "General"} | {item.isPublished ? "Published" : "Draft"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedNewsId(item._id)} style={styles.listButton}>
                  <Text style={styles.listButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleNewsDelete(item._id)} style={styles.dangerButton}>
                  <Text style={styles.dangerButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function PanelTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.panelTab, active && styles.panelTabActive]}
    >
      <Feather name={icon} size={14} color={active ? "#fff" : "#0F172A"} />
      <Text style={[styles.panelTabText, active && styles.panelTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  hero: {
    marginTop: 56,
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 2,
  },
  panelTabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  panelTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  panelTabActive: {
    backgroundColor: "#0F172A",
  },
  panelTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  panelTabTextActive: {
    color: "#fff",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
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
    color: "#0F172A",
    backgroundColor: "#fff",
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  rowItem: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  primaryButton: {
    backgroundColor: "#0F172A",
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
    color: "#334155",
    fontWeight: "700",
    fontSize: 13,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: "#0F172A",
  },
  chipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#fff",
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
    marginHorizontal: 16,
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
});
