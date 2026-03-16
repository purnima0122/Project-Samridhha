
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

/* -- Design Tokens (matches web app) ---------------------- */
const C = {
  bg: "#080C1A",
  surface: "#0F1527",
  card: "#131829",
  border: "#1E2540",
  text: "#F0F4FF",
  muted: "#4B5680",
  accent: "#818CF8",
  gold: "#F59E0B",
  green: "#10B981",
  red: "#EF4444",
  purple: "#7C3AED",
};

const COLOR_POOL = [
  { color: "#6366F1", dark: "#3730A3" },
  { color: "#10B981", dark: "#065F46" },
  { color: "#F59E0B", dark: "#92400E" },
  { color: "#8B5CF6", dark: "#4C1D95" },
  { color: "#3B82F6", dark: "#1E3A8A" },
  { color: "#EC4899", dark: "#831843" },
];

/* -- Types ------------------------------------------------- */
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface Flashcard {
  id: number;
  prompt: string;
  answer: string;
  tag: string;
}

interface QuizQuestion {
  q: string;
  opts: string[];
  ans: number;
  exp: string;
}

interface Fact {
  iconKey: string;
  title: string;
  body: string;
}

interface Quest {
  id: string;
  title: string;
  iconKey: string;
  type: "lesson" | "vault";
  order: number;
  xp: number;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  facts: Fact[];
}

interface Chapter {
  id: number;
  key: string;
  title: string;
  iconKey: string;
  color: string;
  darkColor: string;
  tagline: string;
  xpTotal: number;
  quests: Quest[];
}

interface GameState {
  xp: number;
  level: number;
  streak: number;
  freezes: number;
  hearts: number;
  maxHearts: number;
  completedQuests: Set<string>;
  questStars: Record<string, number>;
  perfectQuizzes: number;
  totalFlips: number;
  vaultsOpened: number;
  earnedBadges: Set<string>;
  badges: string[];
  weeklyProgress: Array<{ label: string; completed: boolean }>;
}

type BadgeDef = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  condition?: (s: GameState) => boolean;
};

/* -- Badge & Icon config ---------------------------------- */
const BADGES: BadgeDef[] = [
  {
    id: "first_lesson",
    icon: "mdi:sprout",
    title: "First Steps",
    desc: "Complete your first lesson",
    condition: (s) => s.completedQuests.size >= 1,
  },
  {
    id: "lessons_5",
    icon: "mdi:run-fast",
    title: "Momentum",
    desc: "Complete 5 lessons",
    condition: (s) => s.completedQuests.size >= 5,
  },
  {
    id: "streak_3",
    icon: "mdi:fire",
    title: "On Fire",
    desc: "3-day streak",
    condition: (s) => s.streak >= 3,
  },
  {
    id: "streak_7",
    icon: "mdi:lightning-bolt",
    title: "Lightning",
    desc: "7-day streak",
    condition: (s) => s.streak >= 7,
  },
  {
    id: "xp_100",
    icon: "mdi:star-circle",
    title: "Rising Star",
    desc: "Earn 100 XP",
    condition: (s) => s.xp >= 100,
  },
  {
    id: "xp_300",
    icon: "mdi:school",
    title: "Scholar",
    desc: "Earn 300 XP",
    condition: (s) => s.xp >= 300,
  },
  {
    id: "quiz_perfect",
    icon: "mdi:target",
    title: "Sharpshooter",
    desc: "100% on a quiz",
    condition: (s) => s.perfectQuizzes >= 1,
  },
  {
    id: "flashcard_flip",
    icon: "mdi:cards",
    title: "Card Shark",
    desc: "Flip 20 flashcards",
    condition: (s) => s.totalFlips >= 20,
  },
  {
    id: "vault_open",
    icon: "mdi:safe",
    title: "Vault Hunter",
    desc: "Open your first vault",
    condition: (s) => s.vaultsOpened >= 1,
  },
];

const KEYWORD_ICON_MAP = [
  { kw: ["bank", "banking"], icon: "mdi:bank" },
  { kw: ["loan", "emi", "debt", "interest"], icon: "mdi:bank-transfer" },
  { kw: ["budget", "expense", "saving", "wallet"], icon: "mdi:wallet" },
  { kw: ["money", "cash", "income", "salary", "finance"], icon: "mdi:cash-multiple" },
  { kw: ["stock", "market", "nepse", "share", "invest", "trading"], icon: "mdi:chart-line" },
  { kw: ["insurance", "risk", "protect", "shield"], icon: "mdi:shield-check" },
  { kw: ["vault", "secret", "facts"], icon: "mdi:safe" },
  { kw: ["intro", "basic", "guide", "learn"], icon: "mdi:book-open-page-variant" },
];

const MODULE_ICONS = [
  "mdi:cash-multiple",
  "mdi:bank",
  "mdi:chart-line",
  "mdi:brain",
  "mdi:rocket-launch",
  "mdi:book-open-page-variant",
];

/* -- Helpers ---------------------------------------------- */
const pn = (v: any, f: number) => (typeof v === "number" && !isNaN(v) ? v : f);
const ps = (v: any, f: string) => (typeof v === "string" && v.trim() ? v : f);
const pa = (v: any, f: any[]) => (Array.isArray(v) ? v : f);

function resolveIcon(title: string, fallback: string) {
  if (!title) return fallback;
  const low = title.toLowerCase();
  for (const e of KEYWORD_ICON_MAP) {
    if (e.kw.some((w) => low.includes(w))) return e.icon;
  }
  return fallback;
}

function calcStars(score: number) {
  if (!score || score <= 0) return 0;
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function normalizeQuest(quest: any, index: number, chapterKey: string): Quest {
  const s = quest || {};
  const type: "vault" | "lesson" = s.type === "vault" ? "vault" : "lesson";
  const id = String(s.id || s._id || `${chapterKey}-${index + 1}`);
  const title = ps(s.title, type === "vault" ? "Mind Vault" : `Lesson ${index + 1}`);
  const iconKey =
    type === "vault"
      ? "mdi:safe"
      : resolveIcon(title, MODULE_ICONS[index % MODULE_ICONS.length]);
  const xp = pn(s.xp, type === "vault" ? 20 : 50);
  const flashcards = pa(s.flashcards, [])
    .map((c, i) => ({
      id: i + 1,
      prompt: ps(c?.prompt, ""),
      answer: ps(c?.answer, ""),
      tag: ps(c?.tag, "Concept"),
    }))
    .filter((c) => c.prompt);
  const quiz = pa(s.quiz, [])
    .map((q) => {
      const opts = pa(q?.opts, pa(q?.options, []));
      const ans =
        typeof q?.ans === "number"
          ? q.ans
          : typeof q?.correctOptionIndex === "number"
            ? q.correctOptionIndex
            : 0;
      return {
        q: ps(q?.q, ps(q?.prompt, "")),
        opts,
        ans,
        exp: ps(q?.exp, ps(q?.explanation, "Keep learning!")),
      };
    })
    .filter((q) => q.q && q.opts.length);
  const facts = pa(s.facts, [])
    .map((f, i) => ({
      iconKey: ps(f?.icon, ["mdi:lightbulb-on", "mdi:star-four-points", "mdi:brain"][i % 3]),
      title: ps(f?.title, "Key Insight"),
      body: ps(f?.body, ""),
    }))
    .filter((f) => f.body);
  return { id, title, iconKey, type, order: pn(s.order, index), xp, flashcards, quiz, facts };
}

function normalizeChapter(ch: any, index: number): Chapter {
  const s = ch || {};
  const theme = COLOR_POOL[index % COLOR_POOL.length];
  const title = ps(s.title, `Chapter ${index + 1}`);
  const key = ps(s.id, title);
  const quests = pa(s.quests, [])
    .map((q: any, i: number) => normalizeQuest(q, i, key))
    .sort((a: Quest, b: Quest) => a.order - b.order);
  return {
    id: pn(s.id, index + 1),
    key,
    title,
    iconKey: resolveIcon(title, MODULE_ICONS[index % MODULE_ICONS.length]),
    color: ps(s.color, theme.color),
    darkColor: ps(s.darkColor, theme.dark),
    tagline: ps(s.tagline, "Level up your skills"),
    xpTotal: quests.reduce((a: number, q: Quest) => a + q.xp, 0),
    quests,
  };
}

function normalizeFlow(payload: any) {
  const s = payload || {};
  const chapters = pa(s.chapters, []).map(normalizeChapter);
  const progress = pa(s.progress, []).map((item: any) => {
    let lid = item?.lessonId;
    if (lid && typeof lid === "object") lid = lid._id || lid.id;
    return { ...item, lessonId: lid ? String(lid) : null };
  });
  return { chapters, progress, gamification: s.gamification || {} };
}

/* -- Icon Component --------------------------------------- */
function Ico({
  name,
  size = 20,
  color = C.text,
  style,
}: {
  name?: string;
  size?: number;
  color?: string;
  style?: any;
}) {
  if (!name) return null;
  const safeName = name.replace(/^mdi:/, "") as IconName;
  return <MaterialCommunityIcons name={safeName} size={size} color={color} style={style} />;
}

/* -- Stat Pill -------------------------------------------- */
function StatPill({
  icon,
  value,
  tint,
  bg,
  border,
}: {
  icon: string;
  value: number | string;
  tint: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={[s.statPill, { backgroundColor: bg, borderColor: border }]}>
      <Ico name={icon} size={15} color={tint} />
      <Text style={[s.statValue, { color: tint }]}>{value}</Text>
    </View>
  );
}
/* -- Top Navbar ------------------------------------------- */
function TopNav({
  gs,
  completedCount,
  totalQuests,
  totalStars,
  activeTab,
  onTabChange,
}: {
  gs: GameState;
  completedCount: number;
  totalQuests: number;
  totalStars: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const progressPct = totalQuests > 0 ? (completedCount / totalQuests) * 100 : 0;
  const tabs = [
    { id: "learn", icon: "mdi:book-open-page-variant", label: "Learn" },
    { id: "badges", icon: "mdi:medal", label: "Badges" },
    { id: "profile", icon: "mdi:account-circle", label: "Profile" },
  ];

  return (
    <LinearGradient
      colors={["#0A2D5C", "#0B3B78"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.topNav}
    >
      <View style={s.navBrand}>
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
      </View>

      <View style={s.statsRow}>
        <StatPill icon="mdi:fire" value={gs.streak} tint="#FB923C" bg="rgba(251,146,60,0.18)" border="rgba(251,146,60,0.35)" />
        <StatPill icon="mdi:heart" value={gs.hearts} tint="#FB7185" bg="rgba(251,113,133,0.18)" border="rgba(251,113,133,0.35)" />
        <StatPill icon="mdi:star" value={totalStars} tint="#FACC15" bg="rgba(250,204,21,0.18)" border="rgba(250,204,21,0.35)" />
        <StatPill icon="mdi:lightning-bolt" value={gs.xp} tint="#A5B4FC" bg="rgba(129,140,248,0.22)" border="rgba(129,140,248,0.4)" />
      </View>

      <View style={s.progressRow}>
        <Text style={s.progressLabel}>Overall Progress</Text>
        <Text style={s.progressCount}>
          {completedCount}/{totalQuests} quests
        </Text>
      </View>
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
      </View>

      <View style={s.tabBar}>
        {tabs.map((tab) => (
          <Pressable key={tab.id} style={s.tabBtn} onPress={() => onTabChange(tab.id)}>
            {activeTab === tab.id && <View style={s.tabIndicator} />}
            <Ico name={tab.icon} size={22} color={activeTab === tab.id ? "#F8FAFC" : "#CBD5E1"} />
            <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );
}

/* -- Chapter Header --------------------------------------- */
function ChapterHeader({
  chapter,
  completedCount,
  totalCount,
}: {
  chapter: Chapter;
  completedCount: number;
  totalCount: number;
}) {
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  return (
    <View style={[s.chapterHeader, { borderColor: chapter.color + "33", backgroundColor: chapter.color + "12" }]}> 
      <View style={s.chapterTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.chapterLabel, { color: chapter.color }]}>CHAPTER {chapter.id}</Text>
          <Text style={s.chapterTitle}>
            <Ico name={chapter.iconKey} size={16} color={chapter.color} /> {chapter.title}
          </Text>
          <Text style={s.chapterTagline}>{chapter.tagline}</Text>
        </View>
        <View style={[s.chapterBadge, { backgroundColor: chapter.color + "22" }]}> 
          <Text style={[s.chapterBadgeNum, { color: chapter.color }]}>
            {completedCount}/{totalCount}
          </Text>
          <Text style={s.chapterBadgeSub}>done</Text>
        </View>
      </View>
      <View style={[s.chapterProgressBg, { backgroundColor: chapter.color + "22" }]}> 
        <View style={[s.chapterProgressFill, { width: `${pct}%` as any, backgroundColor: chapter.color }]} />
      </View>
    </View>
  );
}

/* -- Quest Bubble ----------------------------------------- */
function QuestBubble({
  quest,
  chapter,
  isLocked,
  isDone,
  stars,
  offset,
  onOpen,
}: {
  quest: Quest;
  chapter: Chapter;
  isLocked: boolean;
  isDone: boolean;
  stars: number;
  offset: number;
  onOpen: (q: Quest) => void;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const isVault = quest.type === "vault";
  const nodeColor = isVault ? C.purple : chapter.color;
  const showCrown = !isLocked && !isDone && !isVault;

  const handlePress = () => {
    if (isLocked) return;
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onOpen(quest);
  };

  return (
    <View style={[s.bubbleWrap, { transform: [{ translateX: offset }] }]}> 
      {showCrown && (
        <View style={s.crown}>
          <Ico name="mdi:crown" size={18} color={C.gold} />
        </View>
      )}
      <Pressable onPress={handlePress} disabled={isLocked}>
        <Animated.View
          style={[
            s.bubble,
            {
              backgroundColor: nodeColor,
              borderColor: isLocked ? C.border : nodeColor,
              opacity: isLocked ? 0.35 : 1,
              shadowColor: nodeColor,
              transform: [{ scale: anim }],
            },
          ]}
        >
          <Ico name={isLocked ? "mdi:lock" : quest.iconKey} size={28} color={isLocked ? "#94A3B8" : "#fff"} />
        </Animated.View>
      </Pressable>
      <View style={s.starRow}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              s.starDot,
              {
                backgroundColor: i <= stars ? C.gold : C.border,
                opacity: i <= stars ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[s.bubbleTitle, { color: isLocked ? C.muted : C.text, opacity: isLocked ? 0.45 : 1 }]}> 
        {isVault ? "Mind Vault" : quest.title}
      </Text>
      {!isLocked && (
        <View style={s.bubbleMeta}>
          <View style={[s.xpTag, { backgroundColor: nodeColor + "22" }]}> 
            <Text style={[s.xpText, { color: nodeColor }]}>{isDone ? "Done " : "+"}{quest.xp} XP</Text>
          </View>
          <Text style={s.bubbleSubtitle}>
            {quest.type === "lesson"
              ? `${quest.flashcards.length} cards - ${quest.quiz.length} Qs`
              : "Secrets inside"}
          </Text>
        </View>
      )}
    </View>
  );
}

/* -- Quest Path ------------------------------------------- */
function QuestPath({
  chapter,
  completedQuests,
  questStars,
  onOpenQuest,
}: {
  chapter: Chapter;
  completedQuests: Set<string>;
  questStars: Record<string, number>;
  onOpenQuest: (q: Quest) => void;
}) {
  const quests = chapter.quests;
  const offsets = [0, 44, -44, 20, -20];
  const completedCount = quests.filter((q) => completedQuests.has(q.id)).length;

  return (
    <View style={{ marginBottom: 28 }}>
      <ChapterHeader chapter={chapter} completedCount={completedCount} totalCount={quests.length} />
      <View style={{ alignItems: "center" }}>
        {quests.map((quest, index) => {
          const done = completedQuests.has(quest.id);
          const locked = index > 0 && !completedQuests.has(quests[index - 1].id);
          const stars = questStars[quest.id] || 0;
          const offset = offsets[index % offsets.length];
          const prevOffset = index > 0 ? offsets[(index - 1) % offsets.length] : offset;
          const dotOffset = Math.round((prevOffset + offset) / 2);
          const nodeColor = quest.type === "vault" ? C.purple : chapter.color;

          return (
            <View key={quest.id} style={{ alignItems: "center", width: "100%" }}>
              {index > 0 && (
                <View style={{ alignItems: "center", gap: 5, marginVertical: 4, transform: [{ translateX: dotOffset }] }}>
                  {[0, 1, 2, 3].map((d) => (
                    <View
                      key={d}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: !locked ? nodeColor + "50" : C.border + "60",
                      }}
                    />
                  ))}
                </View>
              )}
              <QuestBubble
                quest={quest}
                chapter={chapter}
                isLocked={locked}
                isDone={done}
                stars={stars}
                offset={offset}
                onOpen={onOpenQuest}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* -- Learn Tab -------------------------------------------- */
function LearnTab({
  chapters,
  gs,
  onOpenQuest,
  loadError,
}: {
  chapters: Chapter[];
  gs: GameState;
  onOpenQuest: (q: Quest) => void;
  loadError: string;
}) {
  if (chapters.length === 0) {
    return (
      <View style={s.placeholderTab}>
        <Ico name="mdi:book-education-outline" size={48} color={C.muted} />
        <Text style={s.placeholderTitle}>No Lessons Yet</Text>
        <Text style={s.placeholderSub}>Lessons will appear here once published</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {!!loadError && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{loadError}</Text>
        </View>
      )}
      {chapters.map((ch) => (
        <QuestPath
          key={ch.key}
          chapter={ch}
          completedQuests={gs.completedQuests}
          questStars={gs.questStars}
          onOpenQuest={onOpenQuest}
        />
      ))}
    </ScrollView>
  );
}

/* -- Profile Tab ------------------------------------------ */
function ProfileTab({ gs, totalStars }: { gs: GameState; totalStars: number }) {
  const stats = [
    { icon: "mdi:fire", label: "Streak", value: `${gs.streak} days`, color: "#FB923C" },
    { icon: "mdi:lightning-bolt", label: "Total XP", value: String(gs.xp), color: "#A5B4FC" },
    { icon: "mdi:star", label: "Stars", value: String(totalStars), color: "#FACC15" },
    { icon: "mdi:heart", label: "Hearts", value: String(gs.hearts), color: "#FB7185" },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <View style={[s.profileCard, { borderColor: C.border, backgroundColor: C.card }]}> 
        <View style={s.avatar}>
          <Ico name="mdi:account" size={36} color="#fff" />
        </View>
        <Text style={s.profileName}>Learner</Text>
        <Text style={s.profileSub}>Level {gs.level} - {gs.xp} XP</Text>
      </View>
      <View style={s.statGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[s.statCard, { borderColor: C.border, backgroundColor: C.card }]}> 
            <Ico name={stat.icon} size={28} color={stat.color} />
            <Text style={[s.statCardValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statCardLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* -- Badges Tab ------------------------------------------- */
function BadgesTab({ gs, badgeCatalog }: { gs: GameState; badgeCatalog: BadgeDef[] }) {
  const earnedCount = badgeCatalog.filter((b) => b.condition && b.condition(gs)).length;
  const weekly = gs.weeklyProgress.length === 7
    ? gs.weeklyProgress
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({ label, completed: i < gs.streak }));

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={s.streakBanner}>
        <View>
          <Text style={s.streakBannerLabel}>Current Streak</Text>
          <Text style={s.streakBannerNum}>{gs.streak}</Text>
          <Text style={s.streakBannerSub}>
            {gs.freezes} freeze{gs.freezes !== 1 ? "s" : ""} available
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.streakBannerLabel}>Total XP</Text>
          <Text style={[s.streakBannerNum, { fontSize: 32 }]}>{gs.xp}</Text>
          <Text style={s.streakBannerSub}>Level {gs.level}</Text>
        </View>
      </View>
      <View style={[s.activityCard, { borderColor: C.border, backgroundColor: C.card }]}> 
        <Text style={s.activityTitle}>Activity - last 7 days</Text>
        <View style={s.activityRow}>
          {weekly.map((day, i) => (
            <View key={i} style={{ alignItems: "center", gap: 4 }}>
              <View style={[s.activityDot, { backgroundColor: day.completed ? C.gold : C.border }]} />
              <Text style={s.activityDotLabel}>{day.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[s.placeholderSub, { marginBottom: 12 }]}>Badges - {earnedCount}/{badgeCatalog.length} earned</Text>
      <View style={s.badgeGrid}>
        {badgeCatalog.map((b) => {
          const isEarned = b.condition ? b.condition(gs) : false;
          return (
            <View
              key={b.id}
              style={[
                s.badgeCard,
                {
                  borderColor: isEarned ? C.purple + "55" : C.border,
                  backgroundColor: isEarned ? "#1F1535" : C.card,
                  opacity: isEarned ? 1 : 0.45,
                },
              ]}
            >
              <Ico name={b.icon} size={34} color={isEarned ? "#C4B5FD" : C.muted} />
              <Text style={[s.badgeTitle, { color: isEarned ? "#E2E8F0" : C.muted }]}>{b.title}</Text>
              <Text style={s.badgeDesc}>{b.desc}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
/* -- Flashcard Modal -------------------------------------- */
function FlashcardModal({
  visible,
  chapter,
  quest,
  fcIdx,
  fcFlipped,
  hearts,
  maxHearts,
  onExit,
  onFlip,
  onNext,
  onStartQuiz,
}: any) {
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: fcFlipped ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fcFlipped, flipAnim]);

  const handleFlip = () => {
    Animated.spring(flipAnim, { toValue: fcFlipped ? 0 : 1, useNativeDriver: true }).start();
    onFlip();
  };

  const cards = quest?.flashcards || [];
  const card = cards[fcIdx];
  const pct = cards.length > 0 ? (fcIdx / cards.length) * 100 : 0;
  const hasQuiz = quest?.quiz?.length > 0;

  const frontInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  if (!visible || !quest || !chapter) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[s.fullScreen, { backgroundColor: C.bg }]}>
        <View style={[s.modalHeader, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <Pressable onPress={onExit} style={s.closeBtn}>
            <Text style={s.closeText}>X</Text>
          </Pressable>
          <View style={s.progressBarWrap}>
            <View style={[s.progressBar2, { backgroundColor: C.border }]}> 
              <View
                style={[
                  s.progressFill2,
                  { width: `${pct}%` as any, backgroundColor: chapter.color, shadowColor: chapter.color },
                ]}
              />
            </View>
          </View>
          <View style={s.heartsRow}>
            {Array.from({ length: maxHearts }).map((_, i) => (
              <Ico key={i} name={i < hearts ? "mdi:heart" : "mdi:heart-outline"} size={14} color={i < hearts ? "#FB7185" : "#374151"} />
            ))}
          </View>
        </View>
        <View style={[s.subHeader, { borderBottomColor: C.border }]}> 
          <Text style={[s.questTitle, { color: C.text }]}> 
            <Ico name={quest.iconKey} size={14} color={chapter.color} /> {quest.title}
          </Text>
          <View style={[s.cardBadge, { backgroundColor: chapter.color + "22", borderColor: chapter.color + "44" }]}> 
            <Text style={[s.cardBadgeText, { color: chapter.color }]}> 
              {cards.length > 0 ? `${fcIdx + 1} / ${cards.length}` : "No cards"}
            </Text>
          </View>
        </View>

        <View style={s.cardArea}>
          {cards.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Ico name="mdi:cards-outline" size={40} color={C.muted} />
              <Text style={s.emptyCardTitle}>No Flashcards Yet</Text>
              <Text style={s.emptyCardSub}>Content coming soon</Text>
              {hasQuiz && (
                <Pressable onPress={onStartQuiz} style={[s.primaryBtn, { backgroundColor: chapter.color, marginTop: 16 }]}> 
                  <Text style={s.primaryBtnText}>Start Quiz {"->"}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ perspective: 1200 } as any}>
              <Animated.View
                style={[
                  s.flashcard,
                  {
                    backgroundColor: chapter.color + "18",
                    borderColor: chapter.color + "44",
                    shadowColor: chapter.color,
                    backfaceVisibility: "hidden",
                    transform: [{ rotateY: frontInterp }],
                    position: fcFlipped ? "absolute" : "relative",
                  },
                ]}
              >
                <Text style={[s.cardLabel, { color: chapter.color }]}>THINK ABOUT THIS...</Text>
                <Text style={s.cardPrompt}>{card.prompt}</Text>
                <Text style={s.cardHint}>Tap flip to reveal answer</Text>
              </Animated.View>
              <Animated.View
                style={[
                  s.flashcard,
                  {
                    backgroundColor: chapter.color + "22",
                    borderColor: chapter.color,
                    shadowColor: chapter.color,
                    backfaceVisibility: "hidden",
                    transform: [{ rotateY: backInterp }],
                    position: fcFlipped ? "relative" : "absolute",
                    top: 0,
                  },
                ]}
              >
                <Text style={[s.cardLabel, { color: chapter.color }]}>ANSWER</Text>
                <Text style={s.cardAnswer}>{card.answer}</Text>
              </Animated.View>
            </View>
          )}
        </View>

        <View style={s.cardActions}>
          <Pressable onPress={handleFlip} style={[s.flipBtn, { backgroundColor: chapter.color + "18", borderColor: chapter.color + "44" }]}> 
            <Text style={[s.flipBtnText, { color: chapter.color }]}>Flip</Text>
          </Pressable>
          <Pressable onPress={onNext} style={[s.nextBtn, { backgroundColor: chapter.color }]}> 
            <Text style={s.nextBtnText}>
              {cards.length > 0 && fcIdx < cards.length - 1 ? "Next Card ->" : hasQuiz ? "Start Quiz ->" : "Finish Lesson"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* -- Quiz Modal ------------------------------------------- */
function QuizModal({
  visible,
  chapter,
  quest,
  quizIdx,
  quizAns,
  quizScore,
  quizDone,
  quizStars,
  hearts,
  maxHearts,
  onExit,
  onAnswer,
  onNext,
}: any) {
  if (!visible || !quest || !chapter) return null;
  if (quizDone) {
    const total = quest.quiz.length;
    const pct = total > 0 ? Math.round((quizScore / total) * 100) : 0;
    const msgs =
      quizStars === 3
        ? ["Legendary!", "Perfect score!"]
        : quizStars >= 2
          ? ["Great Work!", "Almost perfect!"]
          : ["Keep Going!", "Every lesson counts!"];
    return (
      <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
        <View style={[s.fullScreen, s.resultScreen, { backgroundColor: C.bg }]}> 
          <Ico name={quizStars === 3 ? "mdi:trophy" : quizStars >= 2 ? "mdi:star-circle" : "mdi:thumb-up"} size={70} color={quizStars === 3 ? C.gold : C.accent} />
          <View style={s.starRow2}>
            {[1, 2, 3].map((i) => (
              <Ico key={i} name="mdi:star" size={26} color={i <= quizStars ? C.gold : C.border} />
            ))}
          </View>
          <Text style={s.resultTitle}>{msgs[0]}</Text>
          <Text style={s.resultSub}>{msgs[1]}</Text>
          <Text style={s.resultScore}>
            {quizScore}/{total} correct - {pct}%
          </Text>
          <View style={[s.xpBox, { borderColor: C.gold + "44" }]}> 
            <Text style={s.xpBoxLabel}>XP EARNED</Text>
            <Text style={s.xpBoxValue}>+{quest.xp}</Text>
          </View>
          <Pressable
            onPress={onExit}
            style={[s.primaryBtn, { backgroundColor: chapter.color, borderBottomWidth: 4, borderBottomColor: chapter.darkColor, width: "100%" }]}
          >
            <Text style={s.primaryBtnText}>Back to Path</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }
  const q = quest.quiz[quizIdx];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[s.fullScreen, { backgroundColor: C.bg }]}> 
        <View style={[s.modalHeader, { backgroundColor: C.surface, borderBottomColor: C.border }]}> 
          <Pressable onPress={onExit} style={s.closeBtn}>
            <Text style={s.closeText}>X</Text>
          </Pressable>
          <View style={s.progressBarWrap}>
            <View style={[s.progressBar2, { backgroundColor: C.border }]}> 
              <View
                style={[
                  s.progressFill2,
                  { width: `${(quizIdx / quest.quiz.length) * 100}%` as any, backgroundColor: chapter.color },
                ]}
              />
            </View>
          </View>
          <View style={s.heartsRow}>
            {Array.from({ length: maxHearts }).map((_, i) => (
              <Ico key={i} name={i < hearts ? "mdi:heart" : "mdi:heart-outline"} size={14} color={i < hearts ? "#FB7185" : "#374151"} />
            ))}
          </View>
        </View>
        <View style={[s.subHeader, { borderBottomColor: C.border }]}> 
          <Text style={[s.questTitle, { color: chapter.color }]}>Question {quizIdx + 1} of {quest.quiz.length}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <View style={[s.questionBox, { backgroundColor: C.card, borderColor: chapter.color + "30" }]}> 
            <Text style={[s.questionLabel, { color: chapter.color }]}>QUESTION</Text>
            <Text style={s.questionText}>{q.q}</Text>
          </View>
          {q.opts.map((opt: string, i: number) => {
            let bg = C.card,
              border = C.border,
              col = C.text;
            if (quizAns !== null) {
              if (i === q.ans) {
                bg = "#10B98118";
                border = C.green;
                col = C.green;
              } else if (i === quizAns) {
                bg = "#EF444418";
                border = C.red;
                col = C.red;
              }
            }
            return (
              <Pressable key={i} onPress={() => onAnswer(i)} disabled={quizAns !== null} style={[s.optionBtn, { backgroundColor: bg, borderColor: border }]}> 
                <View style={[s.optionLetter, { backgroundColor: chapter.color + "22" }]}> 
                  <Text style={[s.optionLetterText, { color: chapter.color }]}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text style={[s.optionText, { color: col }]}>{opt}</Text>
              </Pressable>
            );
          })}
          {quizAns !== null && (
            <View style={[s.explanationBox, { backgroundColor: quizAns === q.ans ? "#10B98118" : "#EF444418", borderColor: quizAns === q.ans ? C.green + "55" : C.red + "55" }]}> 
              <Text style={[s.explanationHead, { color: quizAns === q.ans ? C.green : C.red }]}>
                {quizAns === q.ans ? "Correct!" : "Not quite -"}
              </Text>
              <Text style={s.explanationText}>{q.exp}</Text>
            </View>
          )}
          {quizAns !== null && (
            <Pressable onPress={onNext} style={[s.primaryBtn, { backgroundColor: chapter.color, marginTop: 14 }]}> 
              <Text style={s.primaryBtnText}>{quizIdx < quest.quiz.length - 1 ? "Next Question ->" : "See Results"}</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* -- Vault Modal ------------------------------------------ */
function VaultModal({ visible, chapter, quest, onExit, onComplete }: any) {
  if (!visible || !quest || !chapter) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[s.fullScreen, { backgroundColor: "#080C1A" }]}> 
        <View style={[s.modalHeader, { backgroundColor: "#0A0520", borderBottomColor: "#7C3AED33" }]}> 
          <Pressable onPress={onExit} style={s.closeBtn}>
            <Text style={[s.closeText, { fontSize: 18 }]}>&lt;</Text>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[s.questTitle, { color: C.text }]}>Mind Vault</Text>
            <Text style={[s.cardHint, { marginTop: 0 }]}>Secret knowledge unlocked</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={s.vaultIntro}>
            <Text style={s.vaultTitle}> <Ico name="mdi:safe" size={20} color="#C4B5FD" /> {quest.title}</Text>
            <Text style={s.vaultSub}>Insights economists rarely put in textbooks -- but should.</Text>
          </View>
          {quest.facts.map((fact: Fact, i: number) => (
            <View key={i} style={s.factCard}>
              <Ico name={fact.iconKey} size={30} color="#C4B5FD" />
              <Text style={s.factTitle}>{fact.title}</Text>
              <Text style={s.factBody}>{fact.body}</Text>
            </View>
          ))}
          {quest.facts.length === 0 && <Text style={[s.cardHint, { textAlign: "center", marginTop: 40 }]}>No facts yet.</Text>}
          <Text style={s.vaultXp}>+{quest.xp} XP earned!</Text>
          <Pressable onPress={onComplete} style={[s.primaryBtn, { backgroundColor: C.purple, marginTop: 8 }]}> 
            <Text style={[s.primaryBtnText, { color: "#fff" }]}>Collect XP {"->"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* -- Badge Toast ------------------------------------------ */
function BadgeToast({ badge }: { badge: BadgeDef | null }) {
  if (!badge) return null;
  return (
    <View style={s.badgeToast}>
      <Ico name={badge.icon} size={32} color="#C4B5FD" />
      <View style={{ flex: 1 }}>
        <Text style={s.badgeToastLabel}>Badge Unlocked!</Text>
        <Text style={s.badgeToastTitle}>{badge.title}</Text>
        <Text style={s.badgeToastDesc}>{badge.desc}</Text>
      </View>
    </View>
  );
}
/* -- Main Screen ------------------------------------------ */
export default function LearnScreen() {
  const { accessToken } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("learn");

  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [questScreen, setQuestScreen] = useState<"none" | "flashcard" | "quiz" | "vault">("none");

  const [fcIdx, setFcIdx] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);

  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAns, setQuizAns] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizStars, setQuizStars] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const [badgeToast, setBadgeToast] = useState<BadgeDef | null>(null);
  const flashcardViewedRef = useRef(new Set<string>());

  const [gs, setGs] = useState<GameState>({
    xp: 0,
    level: 1,
    streak: 0,
    freezes: 0,
    hearts: 5,
    maxHearts: 5,
    completedQuests: new Set(),
    questStars: {},
    perfectQuizzes: 0,
    totalFlips: 0,
    vaultsOpened: 0,
    earnedBadges: new Set(),
    badges: [],
    weeklyProgress: [],
  });

  const badgeCatalog = useMemo(() => {
    const chapterBadges: BadgeDef[] = chapters.map((ch) => ({
      id: `unit_${ch.key}`,
      icon: "mdi:trophy",
      title: `${ch.title} Champ`,
      desc: `Complete ${ch.title}`,
      condition: (s) => ch.quests.every((q) => s.completedQuests.has(q.id)),
    }));
    return [...BADGES, ...chapterBadges];
  }, [chapters]);

  function applyGamification(snap: any) {
    if (!snap) return;
    setGs((prev) => ({
      ...prev,
      xp: pn(snap.xp, prev.xp),
      level: pn(snap.level, prev.level),
      streak: pn(snap.streakDays, prev.streak),
      freezes: pn(snap.streakFreezes, prev.freezes),
      hearts: pn(snap.hearts, prev.hearts),
      maxHearts: pn(snap.maxHearts, prev.maxHearts),
      badges: pa(snap.badges, prev.badges),
      weeklyProgress: pa(snap.weeklyProgress, prev.weeklyProgress),
    }));
  }

  function hydrateProgress(progress: any[], gamification: any) {
    const completed = progress.filter((p) => p.completed).map((p) => String(p.lessonId));
    const backendStars = progress.reduce((acc: Record<string, number>, p: any) => {
      if (p.bestScore > 0 && p.lessonId) acc[String(p.lessonId)] = calcStars(p.bestScore);
      return acc;
    }, {});
    setGs((prev) => ({
      ...prev,
      completedQuests: new Set([...prev.completedQuests, ...completed]),
      perfectQuizzes: Math.max(prev.perfectQuizzes, progress.filter((p) => p.bestScore >= 100).length),
      questStars: { ...prev.questStars, ...backendStars },
    }));
    applyGamification(gamification);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch("/learn/flow", {}, accessToken)
      .then((payload: any) => {
        if (!active) return;
        const { chapters: chs, progress, gamification } = normalizeFlow(payload);
        setChapters(chs);
        hydrateProgress(progress, gamification);
      })
      .catch((err: any) => {
        if (!active) return;
        setLoadError(err?.message || "Failed to load lessons");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    const newlyEarned = badgeCatalog.filter(
      (b) => !gs.earnedBadges.has(b.id) && b.condition && b.condition(gs),
    );
    if (newlyEarned.length) {
      newlyEarned.forEach((b, i) => {
        setTimeout(() => {
          setBadgeToast(b);
          setTimeout(() => setBadgeToast(null), 3000);
        }, i * 3200);
      });
      setGs((prev) => ({
        ...prev,
        earnedBadges: new Set([...prev.earnedBadges, ...newlyEarned.map((b) => b.id)]),
      }));
    }
  }, [badgeCatalog, gs.xp, gs.streak, gs.completedQuests.size, gs.perfectQuizzes, gs.totalFlips, gs.vaultsOpened]);

  useEffect(() => {
    if (questScreen !== "flashcard" || !activeQuest) return;
    const key = `${activeQuest.id}:${fcIdx}`;
    if (flashcardViewedRef.current.has(key)) return;
    flashcardViewedRef.current.add(key);
    apiFetch(`/progress/flashcard/${activeQuest.id}`, { method: "POST", body: JSON.stringify({ count: 1 }) }, accessToken)
      .then((p: any) => {
        if (p?.gamification) applyGamification(p.gamification);
      })
      .catch(() => {});
  }, [questScreen, activeQuest, fcIdx, accessToken]);

  const totalStars = Object.values(gs.questStars).reduce((a, s) => a + s, 0);
  const totalQuests = chapters.reduce((a, ch) => a + ch.quests.length, 0);
  const completedCount = chapters.reduce(
    (a, ch) => a + ch.quests.filter((q) => gs.completedQuests.has(q.id)).length,
    0,
  );

  function resetQuestState() {
    setFcIdx(0);
    setFcFlipped(false);
    setQuizIdx(0);
    setQuizAns(null);
    setQuizScore(0);
    setQuizDone(false);
    setQuizAnswers([]);
    setQuizStars(0);
  }

  function closeQuest() {
    resetQuestState();
    setQuestScreen("none");
  }

  async function openQuest(quest: Quest) {
    const ch = chapters.find((c) => c.quests.some((q) => q.id === quest.id)) || null;
    setActiveChapter(ch);
    setActiveQuest(quest);
    if (quest.type === "vault") {
      setQuestScreen("vault");
      return;
    }
    resetQuestState();
    try {
      await apiFetch(`/progress/start/${quest.id}`, { method: "POST" }, accessToken);
    } catch {}
    setQuestScreen("flashcard");
  }

  function flipCard() {
    setFcFlipped((f) => !f);
    setGs((prev) => ({ ...prev, totalFlips: prev.totalFlips + 1 }));
  }

  function startQuiz() {
    setQuizIdx(0);
    setQuizAns(null);
    setQuizScore(0);
    setQuizDone(false);
    if (activeQuest) setQuizAnswers(Array(activeQuest.quiz.length).fill(-1));
    setQuestScreen("quiz");
  }

  async function nextCard() {
    const cards = activeQuest?.flashcards || [];
    if (cards.length > 0 && fcIdx < cards.length - 1) {
      setFcIdx(fcIdx + 1);
      setFcFlipped(false);
      return;
    }
    if (activeQuest?.quiz?.length) {
      startQuiz();
      return;
    }
    try {
      await apiFetch(`/progress/complete/${activeQuest!.id}`, { method: "POST" }, accessToken);
    } catch {}
    setGs((prev) => ({ ...prev, completedQuests: new Set([...prev.completedQuests, activeQuest!.id]) }));
    closeQuest();
  }

  function answerQuiz(idx: number) {
    if (quizAns !== null || !activeQuest) return;
    setQuizAns(idx);
    const correct = idx === activeQuest.quiz[quizIdx].ans;
    if (correct) setQuizScore((s) => s + 1);
    else setGs((prev) => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }));
    setQuizAnswers((prev) => {
      const n = [...prev];
      n[quizIdx] = idx;
      return n;
    });
  }

  async function nextQuiz() {
    if (quizAns === null || !activeQuest) return;
    if (quizIdx < activeQuest.quiz.length - 1) {
      setQuizIdx(quizIdx + 1);
      setQuizAns(null);
      return;
    }
    const localScore = quizScore + (quizAns === activeQuest.quiz[quizIdx].ans ? 1 : 0);
    const answers = quizAnswers.map((a, i) => (i === quizIdx ? quizAns : a));
    try {
      const result: any = await apiFetch(
        `/progress/quiz/${activeQuest.id}`,
        { method: "POST", body: JSON.stringify({ answers }) },
        accessToken,
      );
      const pct =
        typeof result.scorePercent === "number"
          ? result.scorePercent
          : Math.round((localScore / activeQuest.quiz.length) * 100);
      const stars = calcStars(pct);
      setQuizStars(stars);
      setQuizScore(localScore);
      setQuizDone(true);
      setGs((prev) => ({
        ...prev,
        questStars: { ...prev.questStars, [activeQuest.id]: Math.max(stars, prev.questStars[activeQuest.id] || 0) },
        perfectQuizzes: prev.perfectQuizzes + (pct === 100 ? 1 : 0),
      }));
      applyGamification(result.gamification);
      if (result.passed) {
        try {
          await apiFetch(`/progress/complete/${activeQuest.id}`, { method: "POST" }, accessToken);
        } catch {}
        setGs((prev) => ({ ...prev, completedQuests: new Set([...prev.completedQuests, activeQuest.id]) }));
      }
    } catch {
      setQuizStars(1);
      setQuizDone(true);
    }
  }

  function handleVaultComplete() {
    if (!activeQuest) return;
    setGs((prev) => ({
      ...prev,
      completedQuests: new Set([...prev.completedQuests, activeQuest.id]),
      vaultsOpened: prev.vaultsOpened + 1,
      questStars: { ...prev.questStars, [activeQuest.id]: 3 },
      xp: prev.xp + activeQuest.xp,
    }));
    closeQuest();
  }

  if (loading && chapters.length === 0) {
    return (
      <View style={[s.fullScreen, s.center, { backgroundColor: C.bg }]}> 
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>Loading your learning path...</Text>
        <Text style={s.loadingSubText}>Fetching lessons and progress</Text>
      </View>
    );
  }

  if (loadError && chapters.length === 0) {
    return (
      <View style={[s.fullScreen, s.center, { backgroundColor: C.bg, padding: 24 }]}> 
        <Ico name="mdi:alert-circle-outline" size={44} color="#FCA5A5" />
        <Text style={s.errorTitle}>Unable to load lessons</Text>
        <Text style={s.errorText}>{loadError}</Text>
      </View>
    );
  }

  return (
    <View style={[s.fullScreen, { backgroundColor: C.bg }]}> 
      <TopNav gs={gs} completedCount={completedCount} totalQuests={totalQuests} totalStars={totalStars} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "learn" && (
        <LearnTab chapters={chapters} gs={gs} onOpenQuest={openQuest} loadError={loadError} />
      )}
      {activeTab === "badges" && <BadgesTab gs={gs} badgeCatalog={badgeCatalog} />}
      {activeTab === "profile" && <ProfileTab gs={gs} totalStars={totalStars} />}

      <FlashcardModal
        visible={questScreen === "flashcard"}
        chapter={activeChapter}
        quest={activeQuest}
        fcIdx={fcIdx}
        fcFlipped={fcFlipped}
        hearts={gs.hearts}
        maxHearts={gs.maxHearts}
        onExit={closeQuest}
        onFlip={flipCard}
        onNext={nextCard}
        onStartQuiz={startQuiz}
      />
      <QuizModal
        visible={questScreen === "quiz"}
        chapter={activeChapter}
        quest={activeQuest}
        quizIdx={quizIdx}
        quizAns={quizAns}
        quizScore={quizScore}
        quizDone={quizDone}
        quizStars={quizStars}
        hearts={gs.hearts}
        maxHearts={gs.maxHearts}
        onExit={closeQuest}
        onAnswer={answerQuiz}
        onNext={nextQuiz}
      />
      <VaultModal
        visible={questScreen === "vault"}
        chapter={activeChapter}
        quest={activeQuest}
        onExit={closeQuest}
        onComplete={handleVaultComplete}
      />

      {badgeToast && (
        <View style={s.badgeToastWrap} pointerEvents="none">
          <BadgeToast badge={badgeToast} />
        </View>
      )}
    </View>
  );
}

/* -- Styles ------------------------------------------------ */
const s = StyleSheet.create({
  fullScreen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },

  // Top Nav
  topNav: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 10,
    width: "100%",
    alignSelf: "stretch",
  },
  navBrand: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  statPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  statValue: { fontWeight: "800", fontSize: 15 },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: "#CBD5E1" },
  progressCount: { fontSize: 12, color: "#E2E8F0", fontWeight: "700" },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 99,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 14,
  },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#93C5FD" },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, paddingBottom: 12, position: "relative" },
  tabIndicator: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 3,
    backgroundColor: "#F8FAFC",
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabLabel: { fontSize: 10, fontWeight: "600", color: "#CBD5E1", marginTop: 4 },
  tabLabelActive: { color: "#F8FAFC", fontWeight: "800" },

  // Chapter
  chapterHeader: { borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1 },
  chapterTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  chapterLabel: { fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 3, fontWeight: "700" },
  chapterTitle: { fontSize: 18, fontWeight: "800", color: "#F0F4FF" },
  chapterTagline: { fontSize: 12, color: "#4B5680", marginTop: 3 },
  chapterBadge: { borderRadius: 12, padding: 10, alignItems: "center" },
  chapterBadgeNum: { fontSize: 18, fontWeight: "900" },
  chapterBadgeSub: { fontSize: 9, color: "#4B5680", marginTop: 1 },
  chapterProgressBg: { height: 4, borderRadius: 99, marginTop: 12, overflow: "hidden" },
  chapterProgressFill: { height: "100%", borderRadius: 99 },

  // Quest bubble
  bubbleWrap: { alignItems: "center", marginBottom: 4 },
  crown: { marginBottom: -4 },
  bubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  starRow: { flexDirection: "row", gap: 4, marginTop: 7, alignItems: "center" },
  starDot: { width: 8, height: 8, borderRadius: 4 },
  bubbleTitle: { fontSize: 12, fontWeight: "700", marginTop: 5, textAlign: "center", maxWidth: 90, lineHeight: 15 },
  bubbleMeta: { alignItems: "center", marginTop: 5, gap: 3 },
  xpTag: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2 },
  xpText: { fontSize: 10, fontWeight: "800" },
  bubbleSubtitle: { fontSize: 9, color: "#4B5680" },

  // Flashcard Modal
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingTop: Platform.OS === "ios" ? 56 : 16, borderBottomWidth: 1 },
  closeBtn: { padding: 4 },
  closeText: { color: "#4B5680", fontSize: 20, fontWeight: "600" },
  progressBarWrap: { flex: 1 },
  progressBar2: { height: 10, borderRadius: 99, overflow: "hidden" },
  progressFill2: { height: "100%", borderRadius: 99, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.7 },
  heartsRow: { flexDirection: "row", gap: 3 },
  subHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  questTitle: { fontSize: 13, fontWeight: "700", color: "#F0F4FF" },
  cardBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1 },
  cardBadgeText: { fontSize: 11, fontWeight: "700" },
  cardArea: { flex: 1, justifyContent: "center", padding: 24 },
  emptyCard: { borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1 },
  emptyCardTitle: { fontSize: 17, fontWeight: "800", color: "#F0F4FF", marginBottom: 6 },
  emptyCardSub: { fontSize: 12, color: "#4B5680" },
  flashcard: { borderRadius: 22, padding: 28, borderWidth: 2, shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12, minHeight: 220, justifyContent: "flex-start" },
  cardLabel: { fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: "700" },
  cardPrompt: { fontSize: 18, fontWeight: "800", lineHeight: 28, color: "#F0F4FF" },
  cardHint: { fontSize: 11, color: "#4B5680", marginTop: 20 },
  cardAnswer: { fontSize: 15, fontWeight: "600", lineHeight: 26, color: "#F0F4FF" },
  cardActions: { flexDirection: "row", gap: 12, padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 20 },
  flipBtn: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1 },
  flipBtnText: { fontWeight: "800", fontSize: 14 },
  nextBtn: { flex: 2, borderRadius: 16, padding: 16, alignItems: "center" },
  nextBtnText: { color: "#000", fontWeight: "900", fontSize: 14 },

  // Quiz
  questionBox: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 2 },
  questionLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, fontWeight: "700" },
  questionText: { fontSize: 17, fontWeight: "800", lineHeight: 26, color: "#F0F4FF" },
  optionBtn: { borderRadius: 14, padding: 14, borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  optionLetter: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontWeight: "900", fontSize: 12 },
  optionText: { flex: 1, fontSize: 14, fontWeight: "600" },
  explanationBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 2 },
  explanationHead: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  explanationText: { fontSize: 13, color: "#4B5680", lineHeight: 20 },

  // Result screen
  resultScreen: { alignItems: "center", justifyContent: "center", padding: 28 },
  starRow2: { flexDirection: "row", gap: 10, marginBottom: 14, marginTop: 10 },
  resultTitle: { fontSize: 26, fontWeight: "900", color: "#F0F4FF", marginBottom: 6 },
  resultSub: { fontSize: 13, color: "#4B5680", marginBottom: 6 },
  resultScore: { fontSize: 12, color: "#4B5680", marginBottom: 28 },
  xpBox: { backgroundColor: "#F59E0B18", borderRadius: 22, padding: 20, marginBottom: 16, alignItems: "center", width: "100%", borderWidth: 2 },
  xpBoxLabel: { fontSize: 11, color: "#4B5680", marginBottom: 4, letterSpacing: 2, textTransform: "uppercase" },
  xpBoxValue: { fontSize: 44, fontWeight: "900", color: "#F59E0B" },

  // Primary button
  primaryBtn: { borderRadius: 18, padding: 18, alignItems: "center", width: "100%" },
  primaryBtnText: { color: "#000", fontWeight: "900", fontSize: 16 },

  // Vault
  vaultIntro: { backgroundColor: "#1E1B4B", borderRadius: 20, padding: 20, marginBottom: 18, borderWidth: 1, borderColor: "#7C3AED55" },
  vaultTitle: { fontSize: 20, fontWeight: "900", color: "#F0F4FF", marginBottom: 6 },
  vaultSub: { fontSize: 14, fontWeight: "600", lineHeight: 22, color: "#E2E8F0" },
  factCard: { backgroundColor: "rgba(124,58,237,0.08)", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.2)", gap: 6 },
  factTitle: { fontSize: 16, fontWeight: "900", color: "#C4B5FD", marginBottom: 4 },
  factBody: { fontSize: 14, color: "#CBD5E1", lineHeight: 26 },
  vaultXp: { fontSize: 18, fontWeight: "900", color: "#F59E0B", textAlign: "center", marginTop: 20, marginBottom: 12 },

  // Badges
  streakBanner: { backgroundColor: "#F59E0B", borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  streakBannerLabel: { fontSize: 12, fontWeight: "700", color: "#00000099" },
  streakBannerNum: { fontSize: 44, fontWeight: "900", color: "#000", lineHeight: 52 },
  streakBannerSub: { fontSize: 11, color: "#00000066" },
  activityCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  activityTitle: { fontSize: 12, color: "#4B5680", marginBottom: 10 },
  activityRow: { flexDirection: "row", justifyContent: "space-between" },
  activityDot: { width: 28, height: 28, borderRadius: 7 },
  activityDotLabel: { fontSize: 8, color: "#4B5680" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: { width: "47%", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, gap: 6 },
  badgeTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  badgeDesc: { fontSize: 10, color: "#4B5680", lineHeight: 14, textAlign: "center" },

  // Profile
  profileCard: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 16, borderWidth: 1 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  profileName: { fontSize: 18, fontWeight: "800", color: "#F0F4FF", marginBottom: 4 },
  profileSub: { fontSize: 12, color: "#4B5680" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, gap: 6 },
  statCardValue: { fontSize: 22, fontWeight: "800" },
  statCardLabel: { fontSize: 11, color: "#4B5680" },

  // Misc
  placeholderTab: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 8 },
  placeholderTitle: { fontSize: 18, fontWeight: "800", color: "#F0F4FF", marginBottom: 8, textAlign: "center" },
  placeholderSub: { fontSize: 13, color: "#4B5680", textAlign: "center", lineHeight: 20 },
  errorBanner: { backgroundColor: "#EF444418", borderWidth: 1, borderColor: "#EF444440", borderRadius: 12, padding: 10, marginBottom: 14 },
  errorText: { fontSize: 12, color: "#FCA5A5", textAlign: "center" },
  errorTitle: { fontSize: 16, fontWeight: "800", color: "#F0F4FF", marginTop: 12, marginBottom: 6 },
  loadingText: { marginTop: 14, fontSize: 15, color: "#F0F4FF", fontWeight: "700" },
  loadingSubText: { marginTop: 6, fontSize: 12, color: "#4B5680" },
  badgeToastWrap: { position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 999 },
  badgeToast: { backgroundColor: "#1F1535", borderWidth: 1, borderColor: "#7C3AED", borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#7C3AED", shadowOpacity: 0.4, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, elevation: 16, minWidth: 260 },
  badgeToastLabel: { fontSize: 10, color: "#A78BFA", letterSpacing: 2, textTransform: "uppercase" },
  badgeToastTitle: { fontSize: 15, fontWeight: "900", color: "#E2E8F0" },
  badgeToastDesc: { fontSize: 11, color: "#4B5680" },
});
