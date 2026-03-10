import { useState, useEffect, useRef } from "react";

// ============================================================
// DATA
// ============================================================
const FALLBACK_CHAPTERS = [];

const COLOR_POOL = [
  { color: "#F59E0B", darkColor: "#B45309" },
  { color: "#3B82F6", darkColor: "#1D4ED8" },
  { color: "#10B981", darkColor: "#065F46" },
  { color: "#8B5CF6", darkColor: "#6D28D9" },
  { color: "#F97316", darkColor: "#C2410C" },
];

const MODULE_EMOJI = ["💰", "🏦", "📊", "🧠", "🚀", "📚"]; 

const ICON_EMOJI = {
  BookOpen: "📘",
  TrendingUp: "📈",
  Shield: "🛡️",
  PieChart: "🥧",
  HelpCircle: "❓",
};

const APP_CONFIG = typeof window !== "undefined" ? window.__APP_CONFIG__ || {} : {};
const API_BASE_URL = APP_CONFIG.apiBaseUrl || "";
const ACCESS_TOKEN = APP_CONFIG.accessToken || "";

async function apiFetch(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("API base URL not configured");
  }

  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(options.headers || {}),
  };

  if (ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${ACCESS_TOKEN}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Request failed.";
    throw new Error(message);
  }

  return payload;
}

function splitLessonIntoCards(content) {
  if (!content) return [];

  const rawSegments = content
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((item) => item.trim())
    .filter((item) => item.length > 15);

  const normalized = rawSegments
    .map((item) =>
      item
        .replace(/^[\u2022\-]\s*/, "")
        .replace(/^Concept Card \d+:\s*/i, "")
        .replace(/^Module \d+:\s*/i, "")
        .trim(),
    )
    .map((item) => {
      if (!item.includes("?")) {
        return item;
      }
      const questionSplit = item.split(/\?\s*/, 2);
      if (questionSplit.length > 1 && questionSplit[1].trim().length > 10) {
        return questionSplit[1].trim();
      }
      return "";
    })
    .filter((item) => item.length > 15 && !item.endsWith("?"))
    .filter((item) => !/^(what|why|how|when|where|who)\b/i.test(item));

  return Array.from(new Set(normalized)).slice(0, 4);
}

function buildFlashcards(content) {
  const cards = splitLessonIntoCards(content);
  return cards.map((text, index) => ({
    id: index + 1,
    prompt: text,
    answer: text,
    tag: `Concept ${index + 1}`,
  }));
}

function buildQuiz(quiz = []) {
  return (quiz || []).map((item) => ({
    q: item.prompt,
    opts: item.options,
    ans: item.correctOptionIndex,
    exp: item.explanation || "Keep learning!",
  }));
}

function buildVaultFacts(lessons) {
  const statements = lessons
    .flatMap((lesson) => splitLessonIntoCards(lesson.content || ""));
  const unique = Array.from(new Set(statements)).slice(0, 3);
  const icons = ["🗂️", "✨", "🧠"];

  return unique.map((body, index) => ({
    icon: icons[index % icons.length],
    title: `Key Insight ${index + 1}`,
    body,
  }));
}

function getModuleTagline(lesson) {
  if (!lesson?.content) {
    return "Level up your money skills.";
  }
  const firstSentence = lesson.content.split(/(?<=[.!?])\s+/)[0];
  return firstSentence?.slice(0, 60) || "Level up your money skills.";
}

function buildChapters(lessons = []) {
  if (!Array.isArray(lessons)) return FALLBACK_CHAPTERS;

  const grouped = lessons.reduce((acc, lesson) => {
    const module = lesson.module || "General";
    if (!acc[module]) acc[module] = [];
    acc[module].push(lesson);
    return acc;
  }, {});

  const modules = Object.keys(grouped).sort((a, b) => {
    const aOrder = Math.min(...grouped[a].map((l) => l.order ? 0));
    const bOrder = Math.min(...grouped[b].map((l) => l.order ? 0));
    return aOrder - bOrder;
  });

  return modules.map((module, index) => {
    const theme = COLOR_POOL[index % COLOR_POOL.length];
    const ordered = grouped[module]
      .slice()
      .sort((a, b) => (a.order ? 0) - (b.order ? 0));

    const quests = ordered.map((lesson, lessonIndex) => ({
      id: String(lesson._id || lesson.id || `${module}-${lessonIndex + 1}`),
      title: lesson.title || `Lesson ${lessonIndex + 1}`,
      emoji: ICON_EMOJI[lesson.icon] || "📘",
      type: "lesson",
      flashcards: buildFlashcards(lesson.content || ""),
      quiz: buildQuiz(lesson.quiz || []),
      xp: 50,
    }));

    quests.push({
      id: `vault:${module}`,
      title: "💡 Mind Vault",
      emoji: "🔮",
      type: "vault",
      xp: 20,
      facts: buildVaultFacts(ordered),
    });

    return {
      id: index + 1,
      title: module,
      emoji: MODULE_EMOJI[index % MODULE_EMOJI.length] || "📚",
      color: theme.color,
      darkColor: theme.darkColor,
      tagline: getModuleTagline(ordered[0]),
      xpTotal: quests.reduce((sum, quest) => sum + (quest.xp || 0), 0),
      quests,
    };
  });
}

function normalizeProgress(progress = []) {
  if (!Array.isArray(progress)) return [];
  return progress.map((item) => ({
    ...item,
    lessonId: typeof item.lessonId === "string" ? item.lessonId : item.lessonId?._id,
  }));
}

function calculateStars(score) {
  if (!score || score <= 0) return 0;
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

const BADGES = [
  {
    id: "first_lesson",
    icon: "🌱",
    title: "First Steps",
    desc: "Complete your first lesson",
    backendMatch: ["First Lesson Completed"],
    condition: (s) => s.completedQuests.size >= 1,
  },
  {
    id: "lessons_5",
    icon: "🏅",
    title: "Momentum",
    desc: "Complete 5 lessons",
    backendMatch: ["5 Lessons Completed"],
    condition: (s) => s.completedQuests.size >= 5,
  },
  {
    id: "streak_3",
    icon: "🔥",
    title: "On Fire",
    desc: "Maintain a 3-day streak",
    condition: (s) => s.streak >= 3,
  },
  {
    id: "streak_7",
    icon: "⚡",
    title: "Lightning",
    desc: "7-day streak",
    backendMatch: ["7 Day Streak"],
    condition: (s) => s.streak >= 7,
  },
  {
    id: "streak_30",
    icon: "🏆",
    title: "Unbreakable",
    desc: "30-day streak",
    backendMatch: ["30 Day Streak"],
    condition: (s) => s.streak >= 30,
  },
  {
    id: "xp_100",
    icon: "💫",
    title: "Rising Star",
    desc: "Earn 100 XP",
    condition: (s) => s.xp >= 100,
  },
  {
    id: "xp_300",
    icon: "🌟",
    title: "Scholar",
    desc: "Earn 300 XP",
    condition: (s) => s.xp >= 300,
  },
  {
    id: "quiz_perfect",
    icon: "🎯",
    title: "Sharpshooter",
    desc: "Get 100% on a quiz",
    condition: (s) => s.perfectQuizzes >= 1,
  },
  {
    id: "flashcard_flip",
    icon: "🃏",
    title: "Card Shark",
    desc: "Flip 20 flashcards",
    condition: (s) => s.totalFlips >= 20,
  },
  {
    id: "vault_open",
    icon: "🔐",
    title: "Vault Hunter",
    desc: "Open your first vault",
    condition: (s) => s.vaultsOpened >= 1,
  },
  {
    id: "course_complete",
    icon: "🏁",
    title: "Course Complete",
    desc: "Finish every lesson",
    backendMatch: ["Course Completed"],
  },
];

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [chapters, setChapters] = useState(FALLBACK_CHAPTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const flashcardViewedRef = useRef(new Set());
  const [screen, setScreen] = useState("home"); // home | chapter | lesson | flashcard | quiz | vault | badges | result
  const [activeChapter, setActiveChapter] = useState(null);
  const [activeQuest, setActiveQuest] = useState(null);
  const [fcIdx, setFcIdx] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcAnimating, setFcAnimating] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAns, setQuizAns] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [showExp, setShowExp] = useState(false);
  const [particles, setParticles] = useState([]);
  const [heartAnim, setHeartAnim] = useState(false);
  const [wrongShake, setWrongShake] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const [showBadgeToast, setShowBadgeToast] = useState(null);
  const [quizStars, setQuizStars] = useState(0);

  const [gs, setGs] = useState({
    xp: 0,
    streak: 0,
    freezes: 0,
    hearts: 5,
    maxHearts: 5,
    completedQuests: new Set(),
    perfectQuizzes: 0,
    totalFlips: 0,
    vaultsOpened: 0,
    earnedBadges: new Set(),
    badges: [],
    questStars: {},
    lastActive: new Date().toDateString(),
  });

  const badgeCatalog = [
    ...BADGES,
    ...chapters.map((chapter) => ({
      id: `unit_${chapter.title}`,
      icon: "🏆",
      title: `${chapter.title} Champ`,
      desc: `Complete ${chapter.title}`,
      backendMatch: [
        `Unit Completed: ${chapter.title}`,
        `Chapter Badge: ${chapter.title}`,
      ],
      condition: (s) =>
        chapter.quests.every((quest) => s.completedQuests.has(quest.id)),
    })),
  ];

  const isBadgeEarned = (badge, state = gs) => {
    if (badge.backendMatch?.length) {
      const backendEarned = (state.badges || []).some((item) =>
        badge.backendMatch.includes(item),
      );
      if (backendEarned) {
        return true;
      }
    }

    return badge.condition ? badge.condition(state) : false;
  };

  const applyGamification = (snapshot) => {
    if (!snapshot) return;
    setGs((prev) => ({
      ...prev,
      xp: snapshot.xp ? prev.xp,
      streak: snapshot.streakDays ? prev.streak,
      freezes: snapshot.streakFreezes ? prev.freezes,
      badges: snapshot.badges ? prev.badges,
      hearts: snapshot.hearts ? prev.hearts,
      maxHearts: snapshot.maxHearts ? prev.maxHearts,
    }));
  };

  const showXpGain = (amount) => {
    if (!amount || amount <= 0) return;
    setShowExp(amount);
    setTimeout(() => setShowExp(false), 1500);
  };

  const refreshProgress = async () => {
    const [progressPayload, gamificationPayload] = await Promise.all([
      apiFetch("/progress/me"),
      apiFetch("/progress/gamification"),
    ]);

    const progress = normalizeProgress(progressPayload);
    const completedLessonIds = progress
      .filter((item) => item.completed)
      .map((item) => String(item.lessonId));

    const backendStars = progress.reduce((acc, item) => {
      if (item.bestScore > 0 && item.lessonId) {
        acc[String(item.lessonId)] = calculateStars(item.bestScore);
      }
      return acc;
    }, {});

    const perfectQuizzes = progress.filter((item) => item.bestScore >= 100).length;

    setGs((prev) => ({
      ...prev,
      completedQuests: new Set([...prev.completedQuests, ...completedLessonIds]),
      perfectQuizzes,
      questStars: { ...(prev.questStars || {}), ...backendStars },
    }));

    applyGamification(gamificationPayload);
  };

  // Check badges
  useEffect(() => {
    const newlyEarned = badgeCatalog.filter(
      (b) => !gs.earnedBadges.has(b.id) && isBadgeEarned(b, gs),
    );
    if (newlyEarned.length > 0) {
      newlyEarned.forEach((b, i) => {
        setTimeout(() => {
          setShowBadgeToast(b);
          setTimeout(() => setShowBadgeToast(null), 3000);
        }, i * 3200);
      });
      setGs((prev) => ({
        ...prev,
        earnedBadges: new Set([
          ...prev.earnedBadges,
          ...newlyEarned.map((b) => b.id),
        ]),
      }));
    }
  }, [
    gs.xp,
    gs.streak,
    gs.completedQuests.size,
    gs.perfectQuizzes,
    gs.totalFlips,
    gs.vaultsOpened,
    gs.badges.length,
  ]);

  useEffect(() => {
    if (!newBadges.length) return;
    newBadges.forEach((badgeName, index) => {
      const mapped =
        badgeCatalog.find((badge) => badge.backendMatch?.includes(badgeName)) || {
          icon: "🏅",
          title: badgeName,
          desc: "New achievement unlocked",
        };
      setTimeout(() => {
        setShowBadgeToast(mapped);
        setTimeout(() => setShowBadgeToast(null), 3000);
      }, index * 3200);
    });
    setNewBadges([]);
  }, [newBadges]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const lessons = await apiFetch("/lessons");
        if (!active) return;
        setChapters(buildChapters(lessons));
        await refreshProgress();
      } catch (err) {
        if (!active) return;
        setLoadError(err?.message || "Failed to load lessons.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const spawnParticles = () => {
    const ps = Array.from({length: 12}, (_, i) => ({
      id: Date.now() + i,
      x: 40 + Math.random() * 20,
      y: 40 + Math.random() * 20,
      angle: (i / 12) * 360,
      color: ["#F59E0B","#10B981","#3B82F6","#EF4444","#8B5CF6","#F97316"][i % 6],
    }));
    setParticles(ps);
    setTimeout(() => setParticles([]), 1200);
  };

  const awardXP = (amount) => {
    showXpGain(amount);
  };

  const recordFlashcardView = async (lessonId, count = 1) => {
    if (!lessonId) return;
    try {
      const payload = await apiFetch(`/progress/flashcard/${lessonId}`, {
        method: "POST",
        body: JSON.stringify({ count }),
      });
      showXpGain(payload?.xpAwarded || 0);
      applyGamification(payload?.gamification);
      if (payload?.newBadges?.length) {
        setNewBadges(payload.newBadges);
      }
    } catch {
      // Silent fail to keep UX smooth
    }
  };

  const startLesson = async (lessonId) => {
    if (!lessonId) return true;
    try {
      await apiFetch(`/progress/start/${lessonId}`, { method: "POST" });
      return true;
    } catch (err) {
      setLoadError(err?.message || "Unable to start lesson.");
      return false;
    }
  };

  const completeLesson = async (lessonId) => {
    if (!lessonId) return;
    try {
      const payload = await apiFetch(`/progress/complete/${lessonId}`, {
        method: "POST",
      });
      showXpGain(payload?.xpAwarded || 0);
      applyGamification(payload?.gamification);
      if (payload?.newBadges?.length) {
        setNewBadges(payload.newBadges);
      }
      if (payload?.progress?.lessonId) {
        setGs((prev) => ({
          ...prev,
          completedQuests: new Set([
            ...prev.completedQuests,
            String(payload.progress.lessonId),
          ]),
        }));
      }
    } catch {
      // ignore
    }
  };

  const submitQuiz = async (lessonId, answers) => {
    const payload = await apiFetch(`/progress/quiz/${lessonId}`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
    return payload;
  };

  const loseHeart = () => {
    setWrongShake(true);
    setHeartAnim(true);
    setGs(prev => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }));
    setTimeout(() => setWrongShake(false), 500);
    setTimeout(() => setHeartAnim(false), 400);
  };

  const flipCard = () => {
    if (fcAnimating) return;
    setFcAnimating(true);
    setTimeout(() => { setFcFlipped(f => !f); setFcAnimating(false); }, 150);
    if (!fcFlipped) {
      setGs(prev => ({ ...prev, totalFlips: prev.totalFlips + 1 }));
    }
  };

  const nextCard = () => {
    setFcAnimating(true);
    setFcFlipped(false);
    setTimeout(() => {
      if (fcIdx < activeQuest.flashcards.length - 1) {
        setFcIdx(fcIdx + 1);
      } else {
        setScreen("quiz");
        setQuizIdx(0);
        setQuizAns(null);
        setQuizScore(0);
        setQuizDone(false);
        setQuizAnswers(Array(activeQuest.quiz.length).fill(-1));
      }
      setFcAnimating(false);
    }, 200);
  };

  useEffect(() => {
    if (screen !== "flashcard" || !activeQuest || activeQuest.type !== "lesson") {
      return;
    }
    const key = `${activeQuest.id}:${fcIdx}`;
    if (flashcardViewedRef.current.has(key)) {
      return;
    }
    flashcardViewedRef.current.add(key);
    recordFlashcardView(activeQuest.id, 1);
  }, [screen, activeQuest, fcIdx]);

  const answerQuiz = (idx) => {
    if (quizAns !== null) return;
    setQuizAns(idx);
    setQuizAnswers((prev) => {
      const next = [...prev];
      next[quizIdx] = idx;
      return next;
    });
    const correct = idx === activeQuest.quiz[quizIdx].ans;
    if (correct) {
      spawnParticles();
      setQuizScore(s => s + 1);
    } else {
      loseHeart();
    }
  };

  const nextQuiz = async () => {
    if (quizIdx < activeQuest.quiz.length - 1) {
      setQuizIdx(quizIdx + 1);
      setQuizAns(null);
    } else {
      const total = activeQuest.quiz.length;
      const localScore = quizScore + (quizAns === activeQuest.quiz[quizIdx].ans ? 1 : 0);
      const answers = quizAnswers.map((item, index) =>
        index === quizIdx ? quizAns ? item : item,
      );

      try {
        const result = await submitQuiz(activeQuest.id, answers);
        const scorePercent = result?.scorePercent ? Math.round((localScore / total) * 100);
        const stars = calculateStars(scorePercent);
        setQuizStars(stars);
        setQuizScore(result?.correctAnswers ? localScore);
        setGs((prev) => ({
          ...prev,
          completedQuests: new Set([...prev.completedQuests, activeQuest.id]),
          perfectQuizzes: prev.perfectQuizzes + (scorePercent === 100 ? 1 : 0),
          questStars: {
            ...(prev.questStars || {}),
            [activeQuest.id]: Math.max(stars, (prev.questStars || {})[activeQuest.id] || 0),
          },
        }));
        showXpGain(result?.xpAwarded || 0);
        applyGamification(result?.gamification);
        if (result?.newBadges?.length) {
          setNewBadges(result.newBadges);
        }

        if (result?.passed) {
          await completeLesson(activeQuest.id);
        }
      } catch (err) {
        setLoadError(err?.message || "Quiz submission failed.");
      } finally {
        setQuizDone(true);
      }
    }
  };

  const startQuest = async (chapter, quest) => {
    setActiveChapter(chapter);
    setActiveQuest(quest);
    if (quest.type === "vault") {
      setGs((prev) => ({
        ...prev,
        completedQuests: new Set([...prev.completedQuests, quest.id]),
        vaultsOpened: prev.vaultsOpened + 1,
        questStars: { ...(prev.questStars || {}), [quest.id]: 3 },
      }));
      awardXP(quest.xp);
      setScreen("vault");
      return;
    }

    const started = await startLesson(quest.id);
    if (!started) return;

    setFcIdx(0);
    setFcFlipped(false);
    setFcAnimating(false);
    setScreen("flashcard");
  };

  const C = { // Colors
    bg: "#0B0C1E",
    surface: "#13142B",
    card: "#1A1D3A",
    border: "#252847",
    text: "#F0F2FF",
    muted: "#6B7280",
    accent: "#6366F1",
    gold: "#F59E0B",
    green: "#10B981",
    red: "#EF4444",
  };

  // â”€â”€ HOME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (screen === "home") {
    if (loading && chapters.length === 0) {
      return (
        <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Loading your learning path...</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Fetching lessons and progress</div>
          </div>
        </div>
      );
    }

    if (loadError && chapters.length === 0) {
      return (
        <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Unable to load lessons</div>
            <div style={{ fontSize: 12, color: C.muted }}>{loadError}</div>
          </div>
        </div>
      );
    }

    const totalQuests = chapters.reduce((a, ch) => a + ch.quests.length, 0);
    const completedCount = chapters.reduce((a, ch) => a + ch.quests.filter(q => gs.completedQuests.has(q.id)).length, 0);
    const totalStars = Object.values(gs.questStars || {}).reduce((a, s) => a + s, 0);
    const maxStars = chapters.reduce((a, ch) => a + ch.quests.length * 3, 0);

    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 430, margin: "0 auto", paddingBottom: 100, position: "relative", overflow: "hidden" }}>

        {/* Ambient bg */}
        <div style={{ position: "fixed", top: -100, left: -100, width: 400, height: 400, background: "radial-gradient(circle, #6366F133 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: -100, right: -100, width: 300, height: 300, background: "radial-gradient(circle, #F59E0B22 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        {/* header */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: `${C.bg}EE`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "14px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 17 9 11 13 15 21 7"></polyline>
                  <polyline points="14 7 21 7 21 14"></polyline>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#F8FAFC", letterSpacing: 0.2 }}>StockLearn</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {/* streak */}
              <div style={{ background: gs.streak > 0 ? "#F59E0B22" : C.surface, border: `1px solid ${gs.streak > 0 ? "#F59E0B66" : C.border}`, borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 15 }}>🔥</span>
                <span style={{ fontWeight: 900, fontSize: 14, color: C.gold }}>{gs.streak}</span>
              </div>
              {/* hearts */}
              <div style={{ background: "#EF444422", border: "1px solid #EF444466", borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>❤️</span>
                <span style={{ fontWeight: 900, fontSize: 14, color: C.red }}>{gs.hearts}</span>
              </div>
              {/* stars */}
              <div style={{ background: "#F59E0B22", border: "1px solid #F59E0B55", borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, filter: "drop-shadow(0 0 4px #F59E0B)" }}>⭐</span>
                <span style={{ fontWeight: 900, fontSize: 14, color: C.gold }}>{totalStars}</span>
              </div>
              {/* xp */}
              <div style={{ background: "#6366F122", border: "1px solid #6366F166", borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>⚡</span>
                <span style={{ fontWeight: 900, fontSize: 14, color: "#818CF8" }}>{gs.xp}</span>
              </div>
            </div>
          </div>

          {/* overall progress */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Overall Progress</span>
              <span style={{ fontSize: 11, color: C.accent }}>{completedCount}/{totalQuests} quests</span>
            </div>
            <div style={{ background: C.border, borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(90deg, #6366F1, #F59E0B)", height: "100%", width: `${(completedCount / totalQuests) * 100}%`, borderRadius: 99, transition: "width 0.6s cubic-bezier(.4,0,.2,1)" }} />
            </div>
          </div>
        </div>

        {/* freeze banner */}
        {gs.freezes > 0 && (
          <div style={{ margin: "14px 16px 0", background: "#1E3A5F", border: "1px solid #3B82F666", borderRadius: 14, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧊</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#93C5FD" }}>Streak Freeze Available ({gs.freezes})</div>
              <div style={{ fontSize: 11, color: C.muted }}>Miss a day? Your streak is protected.</div>
            </div>
          </div>
        )}

        {/* Chapters */}
        <div style={{ padding: "20px 16px 0" }}>
          {chapters.map((chapter, ci) => {
            const chCompleted = chapter.quests.filter(q => gs.completedQuests.has(q.id)).length;
            const chDone = chCompleted === chapter.quests.length;
            return (
              <div key={chapter.id} style={{ marginBottom: 28 }}>
                {/* Chapter header bar */}
                <div style={{ background: `linear-gradient(135deg, ${chapter.color}33, ${chapter.color}11)`, border: `1px solid ${chapter.color}44`, borderRadius: 18, padding: "16px 20px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", right: -10, top: -10, fontSize: 70, opacity: 0.08 }}>{chapter.emoji}</div>
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${(chCompleted / chapter.quests.length) * 100}%`, background: `${chapter.color}11`, borderRadius: 18, transition: "width 0.5s ease" }} />
                  <div style={{ position: "relative" }}>
                    <div style={{ fontSize: 10, color: chapter.color, letterSpacing: 3, textTransform: "uppercase", marginBottom: 3 }}>Chapter {chapter.id}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>{chapter.emoji} {chapter.title}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{chapter.tagline}</div>
                      </div>
                      <div style={{ textAlign: "center", background: `${chapter.color}22`, borderRadius: 12, padding: "6px 12px" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: chapter.color }}>{chCompleted}/{chapter.quests.length}</div>
                        <div style={{ fontSize: 9, color: C.muted }}>done</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, background: `${chapter.color}22`, borderRadius: 99, height: 4, overflow: "hidden" }}>
                      <div style={{ background: chapter.color, height: "100%", width: `${(chCompleted / chapter.quests.length) * 100}%`, borderRadius: 99, transition: "width 0.5s" }} />
                    </div>
                  </div>
                </div>

        {/* quest path - duolingo style */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 16px", position: "relative" }}>
                  {chapter.quests.map((quest, qi) => {
                    const done = gs.completedQuests.has(quest.id);
                    const prev = qi === 0 || gs.completedQuests.has(chapter.quests[qi - 1].id);
                    const isVault = quest.type === "vault";
                    const locked = !prev && !done;
                    const stars = (gs.questStars || {})[quest.id] || 0;
                    const isNext = prev && !done;

                    // Wave path: alternating left/right offsets
                    const xOffsets = [-55, 55, -55, 55, -55, 55];
                    const xOff = xOffsets[qi % xOffsets.length];
                    const prevXOff = qi > 0 ? xOffsets[(qi - 1) % xOffsets.length] : xOff;
                    const midXOff = Math.round((prevXOff + xOff) / 2);

                    const nodeColor = isVault ? "#7C3AED" : chapter.color;
                    const nodeDark = isVault ? "#4C1D95" : chapter.darkColor;

                    return (
                      <div key={quest.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                        {/* Connector dots between nodes */}
                        {qi > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, margin: "6px 0", transform: `translateX(${midXOff}px)` }}>
                            {[0, 1, 2, 3].map(d => (
                              <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: done || prev ? `${nodeColor}60` : `${C.border}88` }} />
                            ))}
                          </div>
                        )}

                        {/* Node container */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateX(${xOff}px)`, transition: "transform 0.3s" }}>

                          {/* Crown for the current active node */}
                          {isNext && (
                            <div style={{ fontSize: 20, marginBottom: -2, display: "inline-block", animation: "duoCrown 1.2s ease-in-out infinite" }}>ðŸ‘‘</div>
                          )}

                          {/* The node button */}
                          <div
                            onClick={() => !locked && startQuest(chapter, quest)}
                            style={{
                              width: 76, height: 76,
                              borderRadius: "50%",
                              background: locked
                                ? "linear-gradient(145deg, #16192E, #0F1220)"
                                : done
                                  ? `linear-gradient(145deg, ${nodeColor}, ${nodeColor}CC)`
                                  : `linear-gradient(145deg, ${nodeColor}EE, ${nodeColor}AA)`,
                              border: `4px solid ${locked ? C.border + "44" : nodeColor + "EE"}`,
                              borderBottom: `8px solid ${locked ? "#080912" : nodeDark}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 30,
                              cursor: locked ? "not-allowed" : "pointer",
                              opacity: locked ? 0.38 : 1,
                              transition: "transform 0.15s, box-shadow 0.15s",
                              boxShadow: done
                                ? `0 0 28px ${nodeColor}55, 0 6px 0 ${nodeDark}`
                                : locked ? "none"
                                : `0 6px 0 ${nodeDark}, 0 0 18px ${nodeColor}33`,
                              position: "relative",
                              overflow: "hidden",
                              userSelect: "none",
                            }}
                            onMouseEnter={e => {
                              if (!locked) {
                                e.currentTarget.style.transform = "scale(1.1) translateY(-3px)";
                                e.currentTarget.style.boxShadow = `0 10px 0 ${nodeDark}, 0 0 36px ${nodeColor}66`;
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = "scale(1) translateY(0)";
                              e.currentTarget.style.boxShadow = done
                                ? `0 0 28px ${nodeColor}55, 0 6px 0 ${nodeDark}`
                                : locked ? "none"
                                : `0 6px 0 ${nodeDark}, 0 0 18px ${nodeColor}33`;
                            }}
                          >
                            {locked ? "ðŸ”’" : quest.emoji}
                            {/* Top shine for done nodes */}
                            {done && (
                              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "42%", background: "rgba(255,255,255,0.18)", borderRadius: "50% 50% 0 0", pointerEvents: "none" }} />
                            )}
                            {/* Checkmark badge */}
                            {done && (
                              <div style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, background: "#10B981", borderRadius: "50%", border: "2px solid #0B0C1E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff" }}>âœ“</div>
                            )}
                          </div>

                          {/* Stars row */}
                          <div style={{ display: "flex", gap: 2, marginTop: 9, height: 20, alignItems: "center" }}>
                            {[1, 2, 3].map(s => (
                              <span key={s} style={{
                                fontSize: 15,
                                display: "inline-block",
                                filter: s <= stars
                                  ? `drop-shadow(0 0 5px #F59E0B) drop-shadow(0 0 2px #F59E0BAA)`
                                  : "grayscale(1) opacity(0.22)",
                                transform: s <= stars ? "scale(1.1)" : "scale(0.9)",
                                transition: "all 0.3s",
                              }}>â­</span>
                            ))}
                          </div>

                          {/* Quest title */}
                          <div style={{
                            fontSize: 11, fontWeight: 700,
                            color: locked ? C.muted : C.text,
                            textAlign: "center", maxWidth: 92,
                            marginTop: 5, lineHeight: 1.3,
                            opacity: locked ? 0.45 : 1,
                          }}>
                            {isVault ? "Mind Vault" : quest.title}
                          </div>

                          {/* XP badge */}
                          {!locked && (
                            <div style={{
                              marginTop: 5,
                              background: done ? `${nodeColor}33` : `${nodeColor}18`,
                              border: `1px solid ${nodeColor}${done ? "66" : "33"}`,
                              borderRadius: 99, padding: "2px 9px",
                              fontSize: 10, color: nodeColor, fontWeight: 800,
                            }}>
                              {done ? "âœ“ " : "+"}{quest.xp} XP
                            </div>
                          )}

                          {/* Quest type tag */}
                          {!locked && (
                            <div style={{ marginTop: 3, fontSize: 9, color: C.muted }}>
                              {quest.type === "lesson" ? `${quest.flashcards.length} cards Â· ${quest.quiz.length} Qs` : isVault ? "ðŸ” Secret Facts" : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <style>{`
                  @keyframes duoCrown { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-7px) rotate(5deg)} }
                `}</style>
              </div>
            );
          })}
        </div>

        {/* Bottom nav */}
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: `${C.surface}EE`, backdropFilter: "blur(12px)", borderTop: `1px solid ${C.border}`, padding: "12px 0 16px", display: "flex", justifyContent: "space-around", zIndex: 100 }}>
          {[
            { label: "Learn", icon: "ðŸ“š", screen: "home" },
            { label: "Badges", icon: "ðŸ…", screen: "badges" },
          ].map(item => (
            <button key={item.screen} onClick={() => setScreen(item.screen)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 10, color: screen === item.screen ? C.accent : C.muted, fontWeight: screen === item.screen ? 800 : 400 }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Badge toast */}
        {showBadgeToast && (
          <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #1F1535, #0D1128)", border: "1px solid #7C3AED", borderRadius: 18, padding: "14px 22px", zIndex: 999, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 40px #7C3AED66", animation: "slideDown 0.4s ease", minWidth: 260 }}>
            <span style={{ fontSize: 32 }}>{showBadgeToast.icon}</span>
            <div>
              <div style={{ fontSize: 10, color: "#A78BFA", letterSpacing: 2, textTransform: "uppercase" }}>Badge Unlocked!</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#E2E8F0" }}>{showBadgeToast.title}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{showBadgeToast.desc}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // â”€â”€ BADGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (screen === "badges") {
    const earnedCount = badgeCatalog.filter((badge) => isBadgeEarned(badge, gs)).length;
    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 430, margin: "0 auto", paddingBottom: 80 }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>â†</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>ðŸ… Badges</div>
            <div style={{ fontSize: 12, color: C.muted }}>{earnedCount}/{badgeCatalog.length} earned</div>
          </div>
        </div>

        {/* Streak showcase */}
        <div style={{ margin: "16px", background: "linear-gradient(135deg, #B45309, #F59E0B)", borderRadius: 20, padding: "20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 52 }}>ðŸ”¥</div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#000" }}>{gs.streak}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#00000099" }}>Day Streak</div>
            <div style={{ fontSize: 11, color: "#00000077" }}>ðŸ§Š {gs.freezes} freeze{gs.freezes !== 1 ? "s" : ""} available</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#000" }}>{gs.xp}</div>
            <div style={{ fontSize: 11, color: "#00000077" }}>Total XP</div>
          </div>
        </div>

        {/* GitHub-style calendar placeholder */}
        <div style={{ margin: "0 16px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Activity â€” last 7 days</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
              <div key={d} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ width: "100%", paddingBottom: "100%", background: i < gs.streak ? `${C.gold}` : C.border, borderRadius: 6, marginBottom: 4 }} />
                <div style={{ fontSize: 8, color: C.muted }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Badge grid */}
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {badgeCatalog.map(badge => {
              const earned = isBadgeEarned(badge, gs);
              return (
                <div key={badge.id} style={{ background: earned ? "linear-gradient(135deg, #1F1535, #0D1128)" : C.card, border: `1px solid ${earned ? "#7C3AED66" : C.border}`, borderRadius: 16, padding: "16px", textAlign: "center", opacity: earned ? 1 : 0.5 }}>
                  <div style={{ fontSize: 36, marginBottom: 8, filter: earned ? "none" : "grayscale(100%)" }}>{badge.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, color: earned ? "#E2E8F0" : C.muted }}>{badge.title}</div>
                  <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{badge.desc}</div>
                  {earned && <div style={{ fontSize: 10, color: "#A78BFA", marginTop: 6, fontWeight: 700 }}>âœ“ Earned!</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ FLASHCARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (screen === "flashcard" && activeQuest) {
    const card = activeQuest.flashcards[fcIdx];
    const progress = (fcIdx / activeQuest.flashcards.length) * 100;

    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 0 }}>âœ•</button>
            <div style={{ flex: 1, background: C.border, borderRadius: 99, height: 10, overflow: "hidden" }}>
              <div style={{ background: `linear-gradient(90deg, ${activeChapter.color}, ${activeChapter.color}BB)`, height: "100%", width: `${progress}%`, borderRadius: 99, transition: "width 0.4s cubic-bezier(.4,0,.2,1)", boxShadow: `0 0 8px ${activeChapter.color}88` }} />
            </div>
            <div style={{ background: "#EF444422", border: "1px solid #EF444433", borderRadius: 10, padding: "4px 10px", display: "flex", gap: 3 }}>
              {Array.from({length: gs.maxHearts}).map((_, i) => <span key={i} style={{ fontSize: 12 }}>{i < gs.hearts ? "â¤ï¸" : "ðŸ–¤"}</span>)}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{activeQuest.emoji} {activeQuest.title}</div>
            <div style={{ background: `${activeChapter.color}22`, border: `1px solid ${activeChapter.color}44`, borderRadius: 99, padding: "2px 10px", fontSize: 11, color: activeChapter.color, fontWeight: 700 }}>Card {fcIdx + 1} / {activeQuest.flashcards.length}</div>
          </div>
        </div>

        {/* Tag */}
        <div style={{ padding: "14px 20px 0", display: "flex", justifyContent: "center" }}>
          <div style={{ background: `${activeChapter.color}22`, border: `1px solid ${activeChapter.color}44`, borderRadius: 99, padding: "4px 14px", fontSize: 11, color: activeChapter.color, fontWeight: 700, letterSpacing: 1 }}>
            {card.tag}
          </div>
        </div>

        {/* Card */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px" }}>
          <div
            onClick={flipCard}
            style={{
              width: "100%",
              minHeight: 280,
              perspective: 1000,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div style={{
              width: "100%",
              minHeight: 280,
              position: "relative",
              transformStyle: "preserve-3d",
              transform: fcFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              transition: fcAnimating ? "none" : "transform 0.5s cubic-bezier(.4,0,.2,1)",
            }}>
              {/* Front */}
              <div style={{
                position: "absolute", width: "100%", minHeight: 280,
                backfaceVisibility: "hidden",
                background: "linear-gradient(145deg, #1E2240, #151830)",
                border: `2px solid ${activeChapter.color}55`,
                borderRadius: 24,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: 28, textAlign: "center",
                boxShadow: `0 20px 60px #00000088, 0 0 40px ${activeChapter.color}11`,
              }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>ðŸ¤”</div>
                <div style={{ fontSize: 11, color: activeChapter.color, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Think about this...</div>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.5, color: C.text }}>{card.prompt}</div>
                <div style={{ marginTop: 24, fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>ðŸ‘†</span> Tap to reveal answer
                </div>
              </div>
              {/* Back */}
              <div style={{
                position: "absolute", width: "100%", minHeight: 280,
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: `linear-gradient(145deg, ${activeChapter.color}22, ${activeChapter.color}08)`,
                border: `2px solid ${activeChapter.color}`,
                borderRadius: 24,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: 28, textAlign: "center",
                boxShadow: `0 20px 60px #00000088, 0 0 60px ${activeChapter.color}33`,
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>ðŸ’¡</div>
                <div style={{ fontSize: 11, color: activeChapter.color, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Answer</div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.7, color: C.text, whiteSpace: "pre-line" }}>{card.answer}</div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 20 }}>
            {!fcFlipped ? (
              <button onClick={flipCard} style={{ flex: 1, background: `${activeChapter.color}22`, border: `1px solid ${activeChapter.color}55`, borderRadius: 16, padding: "16px", color: activeChapter.color, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                Reveal Answer ðŸ‘†
              </button>
            ) : (
              <>
                <button onClick={() => { setFcFlipped(false); }} style={{ flex: 1, background: "#EF444422", border: "1px solid #EF444466", borderRadius: 16, padding: "16px", color: "#EF4444", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  ðŸ” Review Again
                </button>
                <button onClick={nextCard} style={{ flex: 2, background: `linear-gradient(135deg, ${activeChapter.color}, ${activeChapter.color}BB)`, border: "none", borderRadius: 16, padding: "16px", color: "#000", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
                  {fcIdx < activeQuest.flashcards.length - 1 ? "Next Card â†’" : "Start Quiz! ðŸ§ "}
                </button>
              </>
            )}
          </div>
        </div>

        <style>{`@keyframes slideDown { from { transform: translateX(-50%) translateY(-20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }`}</style>
      </div>
    );
  }

  // â”€â”€ QUIZ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (screen === "quiz" && activeQuest) {
    if (quizDone) {
      const total = activeQuest.quiz.length;
      const pct = Math.round((quizScore / total) * 100);
      const resultMsg = quizStars === 3 ? ["Legendary! ðŸŽ‰", "Perfect score! You're unstoppable!"] : quizStars === 2 ? ["Great Work! ðŸŽŠ", "Solid performance! Almost perfect!"] : ["Keep It Up! ðŸ’ª", "Every lesson makes you smarter!"];
      return (
        <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center", position: "relative", overflow: "hidden" }}>
          {/* Background glow */}
          <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, background: `radial-gradient(circle, ${activeChapter.color}22 0%, transparent 70%)`, pointerEvents: "none" }} />

          {/* Trophy */}
          <div style={{ fontSize: 90, marginBottom: 12, animation: "resultPop 0.6s cubic-bezier(.34,1.56,.64,1) both" }}>
            {quizStars === 3 ? "ðŸ†" : quizStars === 2 ? "ðŸŒŸ" : "ðŸ’ª"}
          </div>

          {/* Stars â€” animated pop in sequence */}
          <div style={{ display: "flex", gap: 10, marginBottom: 22, justifyContent: "center", alignItems: "flex-end" }}>
            {[1, 2, 3].map(s => (
              <span key={s} style={{
                fontSize: s === 2 ? 56 : 44,
                display: "inline-block",
                filter: s <= quizStars ? `drop-shadow(0 0 14px #F59E0B) drop-shadow(0 0 6px #F59E0BAA)` : "grayscale(1) opacity(0.18)",
                animation: s <= quizStars ? `starReveal ${0.4 + s * 0.18}s cubic-bezier(.34,1.56,.64,1) both` : "none",
              }}>â­</span>
            ))}
          </div>

          {/* Title */}
          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, animation: "resultPop 0.6s 0.3s both" }}>{resultMsg[0]}</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 8, animation: "resultPop 0.6s 0.4s both" }}>{resultMsg[1]}</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>{quizScore}/{total} correct Â· {pct}%</div>

          {/* XP reward card */}
          <div style={{ background: "linear-gradient(135deg, #F59E0B22, #F59E0B08)", border: "2px solid #F59E0B55", borderRadius: 22, padding: "20px 40px", marginBottom: 14, animation: "resultPop 0.6s 0.5s both", width: "100%" }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, letterSpacing: 2, textTransform: "uppercase" }}>XP Earned</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: C.gold }}>+{activeQuest.xp} âš¡</div>
          </div>

          {/* Stars count */}
          <div style={{ background: `${activeChapter.color}18`, border: `1px solid ${activeChapter.color}44`, borderRadius: 14, padding: "10px 24px", marginBottom: 30, display: "flex", alignItems: "center", gap: 8, animation: "resultPop 0.6s 0.6s both" }}>
            <span style={{ fontSize: 16 }}>â­</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: activeChapter.color }}>{quizStars} / 3 Stars Earned</span>
          </div>

          {/* Continue button */}
          <button onClick={() => setScreen("home")} style={{ width: "100%", background: `linear-gradient(135deg, ${activeChapter.color}, ${activeChapter.color}BB)`, border: "none", borderBottom: `5px solid ${activeChapter.darkColor}`, borderRadius: 18, padding: "18px", color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer", animation: "resultPop 0.6s 0.7s both", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: `0 6px 24px ${activeChapter.color}44` }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Continue â†’
          </button>

          <style>{`
            @keyframes resultPop { 0%{transform:scale(0.6);opacity:0} 100%{transform:scale(1);opacity:1} }
            @keyframes starReveal { 0%{transform:scale(0) rotate(-30deg);opacity:0} 70%{transform:scale(1.25) rotate(8deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
          `}</style>
        </div>
      );
    }

    const q = activeQuest.quiz[quizIdx];
    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>
        {/* Particles */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200 }}>
          {particles.map(p => (
            <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: 8, height: 8, background: p.color, borderRadius: "50%", animation: `burst 1s ease-out forwards`, transform: `rotate(${p.angle}deg)` }} />
          ))}
        </div>

        {/* Top */}
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>âœ•</button>
            <div style={{ flex: 1, background: C.border, borderRadius: 99, height: 10, overflow: "hidden" }}>
              <div style={{ background: `linear-gradient(90deg, ${activeChapter.color}, #F59E0B)`, height: "100%", width: `${((quizIdx) / activeQuest.quiz.length) * 100}%`, borderRadius: 99, transition: "width 0.4s", boxShadow: `0 0 8px ${activeChapter.color}88` }} />
            </div>
            <div style={{ background: "#EF444422", border: "1px solid #EF444433", borderRadius: 10, padding: "4px 10px", display: "flex", gap: 3, animation: heartAnim ? "shake 0.4s" : "none" }}>
              {Array.from({length: gs.maxHearts}).map((_, i) => <span key={i} style={{ fontSize: 12 }}>{i < gs.hearts ? "â¤ï¸" : "ðŸ–¤"}</span>)}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{activeQuest.emoji} Question {quizIdx + 1} of {activeQuest.quiz.length}</div>
            {/* Live score */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {Array.from({ length: activeQuest.quiz.length }).map((_, i) => (
                <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: i < quizIdx ? (i < quizScore ? "#10B98188" : "#EF444488") : i === quizIdx ? `${activeChapter.color}66` : C.border, border: `2px solid ${i < quizIdx ? (i < quizScore ? "#10B981" : "#EF4444") : i === quizIdx ? activeChapter.color : "transparent"}`, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, transition: "all 0.3s" }}>
                  {i < quizIdx ? (i < quizScore ? "âœ“" : "âœ—") : ""}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "20px 20px 0", display: "flex", flexDirection: "column" }}>
          {/* Question */}
          <div style={{
            background: "linear-gradient(145deg, #1E2240, #151830)",
            border: `2px solid ${activeChapter.color}33`,
            borderRadius: 20, padding: "22px", marginBottom: 20,
            animation: wrongShake ? "shake 0.4s" : "none",
          }}>
            <div style={{ fontSize: 11, color: activeChapter.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Question</div>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>{q.q}</div>
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {q.opts.map((opt, i) => {
              let bg = C.card, border_ = C.border, color_ = C.text, icon = null;
              if (quizAns !== null) {
                if (i === q.ans) { bg = "#10B98118"; border_ = "#10B981"; color_ = "#10B981"; icon = "âœ“"; }
                else if (i === quizAns && i !== q.ans) { bg = "#EF444418"; border_ = "#EF4444"; color_ = "#EF4444"; icon = "âœ—"; }
              }
              return (
                <div key={i} onClick={() => answerQuiz(i)} style={{ background: bg, border: `2px solid ${border_}`, borderRadius: 16, padding: "15px 18px", cursor: quizAns !== null ? "default" : "pointer", color: color_, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}
                  onMouseEnter={e => { if (quizAns === null) e.currentTarget.style.border = `2px solid ${activeChapter.color}88`; }}
                  onMouseLeave={e => { if (quizAns === null) e.currentTarget.style.border = `2px solid ${C.border}`; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${border_}33`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                    {icon || ["A","B","C","D"][i]}
                  </div>
                  {opt}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {quizAns !== null && (
            <div style={{ marginTop: 16, background: quizAns === q.ans ? "#10B98118" : "#EF444418", border: `1px solid ${quizAns === q.ans ? "#10B98166" : "#EF444466"}`, borderRadius: 16, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: quizAns === q.ans ? "#10B981" : "#EF4444", marginBottom: 4 }}>
                {quizAns === q.ans ? "âœ“ Correct! Great thinking!" : "âœ— Not quite â€” here's why:"}
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{q.exp}</div>
            </div>
          )}
        </div>

        {quizAns !== null && (
          <div style={{ padding: "16px 20px 32px" }}>
            <button onClick={nextQuiz} style={{ width: "100%", background: `linear-gradient(135deg, ${activeChapter.color}, ${activeChapter.color}BB)`, border: "none", borderRadius: 18, padding: "18px", color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              {quizIdx < activeQuest.quiz.length - 1 ? "Next Question â†’" : "See Results! ðŸŽ‰"}
            </button>
          </div>
        )}

        <style>{`
          @keyframes burst { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(calc(cos(var(--a))*80px),calc(sin(var(--a))*80px)) scale(0);opacity:0} }
          @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 60%{transform:translateX(6px)} }
          @keyframes slideDown { from{transform:translateX(-50%) translateY(-20px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
        `}</style>
      </div>
    );
  }

  // â”€â”€ VAULT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (screen === "vault" && activeQuest && activeChapter) {
    return (
      <div style={{ background: "linear-gradient(180deg, #0A0520 0%, #0B0C1E 100%)", minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #2D1F5E", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>â†</button>
          <div>
            <div style={{ fontSize: 10, color: "#A78BFA", letterSpacing: 3, textTransform: "uppercase" }}>Chapter Vault</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>ðŸ” Mind-Blowing Facts</div>
          </div>
        </div>

        <div style={{ padding: "20px 16px" }}>
          <div style={{ background: "linear-gradient(135deg, #1F1535, #0F1335)", border: "1px solid #7C3AED44", borderRadius: 18, padding: "18px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#A78BFA", marginBottom: 4 }}>Did you know?</div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: "#E2E8F0" }}>These are the stories economists don't usually put in textbooks â€” but should.</div>
          </div>

          {activeQuest.facts.map((fact, i) => (
            <div key={i} style={{ background: "linear-gradient(135deg, #1A1035, #0F1525)", border: "1px solid #2D1F5E", borderRadius: 20, padding: "22px", marginBottom: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{fact.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#C4B5FD", marginBottom: 10 }}>{fact.title}</div>
              <div style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.8 }}>{fact.body}</div>
            </div>
          ))}

          <div style={{ background: "#F59E0B22", border: "1px solid #F59E0B66", borderRadius: 16, padding: "14px 20px", textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.gold }}>+{activeQuest.xp} XP earned! âš¡</div>
          </div>

          <button onClick={() => setScreen("home")} style={{ width: "100%", marginTop: 16, background: "linear-gradient(135deg, #7C3AED, #6D28D9)", border: "none", borderRadius: 18, padding: "18px", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
            Back to Learning â†’
          </button>
        </div>
      </div>
    );
  }

  return null;
}



