
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
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
  duration: number;
  videoUrl?: string;
  color?: string;
  icon?: string;
  quiz?: ApiQuizQuestion[];
};

type ApiProgress = {
  lessonId: { _id: string } | string;
  completed: boolean;
  flashcardsViewed?: number;
};

type GamificationSummary = {
  xp: number;
  level: number;
  streakDays: number;
  badges: string[];
  lessonsCompletedCount: number;
  correctQuizAnswers: number;
  xpToNextLevel: number;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  totalLessons: number;
  completedLessons: number;
  coursePercent: number;
};

type BadgeDef = {
  id: string;
  icon: string;
  title: string;
  module: string;
  order: number;
  icon: any;
  iconName: string;
  color: string;
  duration: string;
  content: string;
  videoUrl: string;
  mcqs: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }[];
};

const iconMap: Record<string, any> = {
  TrendingUp,
  BookOpen,
  Shield,
  PieChart,
  HelpCircle,
};

const externalResources = [
  { title: 'NEPSE Official', url: 'https://www.nepalstock.com', description: 'Live market data and announcements' },
  { title: 'SEBON Website', url: 'https://www.sebon.gov.np', description: 'Regulatory info for Nepali investors' },
  { title: 'Investopedia', url: 'https://www.investopedia.com', description: 'Global stock market encyclopedia' },
];

type LearningSection = 'lessons' | 'tax';

const TAX_REFERENCE_RATES = {
  capitalGainsPercent: 7.5,
  dividendPercent: 5,
  vatPercent: 13,
  corporatePercent: 25,
};

const TAX_BASICS = [
  {
    title: 'Income Tax',
    subtitle: 'Progressive slab system on yearly earnings.',
    value: 'Approx 1% - 30%',
  },
  {
    title: 'Capital Gains Tax',
    subtitle: 'Applies to profit from selling investments.',
    value: `${TAX_REFERENCE_RATES.capitalGainsPercent}%`,
  },
  {
    title: 'Dividend Tax',
    subtitle: 'Withholding tax on received dividends.',
    value: `${TAX_REFERENCE_RATES.dividendPercent}%`,
  },
  {
    title: 'VAT',
    subtitle: 'Consumption tax charged on goods/services.',
    value: `${TAX_REFERENCE_RATES.vatPercent}%`,
  },
  {
    title: 'Corporate Tax',
    subtitle: 'Tax on business profits (entity level).',
    value: `${TAX_REFERENCE_RATES.corporatePercent}%`,
  },
];

const DEFAULT_COLOR = '#5B8DEF';
const DEFAULT_ICON = 'BookOpen';
const PASSING_SCORE_PERCENT = 70;

function parseNumericInput(value: string): number {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return `NPR ${Math.max(0, value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

function calculateIncomeTaxFromSlab(income: number): number {
  if (income <= 0) return 0;

  const slabs = [
    { limit: 500000, rate: 0.01 },
    { limit: 200000, rate: 0.1 },
    { limit: 300000, rate: 0.2 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.3 },
  ];

  let remaining = income;
  let totalTax = 0;

  for (const slab of slabs) {
    if (remaining <= 0) {
      break;
    }
    const taxableAmount = Math.min(remaining, slab.limit);
    totalTax += taxableAmount * slab.rate;
    remaining -= taxableAmount;
  }

  return totalTax;
}

function formatDuration(minutes?: number) {
  if (!minutes || Number.isNaN(minutes)) {
    return '5 min';
  }
  return `${minutes} min`;
}

function mapLesson(apiLesson: ApiLesson): Lesson {
  const iconName = apiLesson.icon && iconMap[apiLesson.icon] ? apiLesson.icon : DEFAULT_ICON;
  const icon = iconMap[iconName] || BookOpen;

  return {
    id: apiLesson._id,
    title: apiLesson.title,
    module: apiLesson.module,
    order: apiLesson.order ?? 0,
    icon,
    iconName,
    color: apiLesson.color || DEFAULT_COLOR,
    duration: formatDuration(apiLesson.duration),
    content: apiLesson.content,
    videoUrl: apiLesson.videoUrl || '',
    mcqs: (apiLesson.quiz || []).slice(0, 3).map((question) => ({
      question: question.prompt,
      options: question.options,
      correctAnswer: question.correctOptionIndex,
      explanation: question.explanation,
    })),
  };
}

type QuizQuestion = Lesson['mcqs'][number];

function splitLessonIntoCards(content: string): string[] {
  const rawSegments = content
    .split('\n')
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((item) => item.trim())
    .filter((item) => item.length > 15);

  const normalized = rawSegments
    .map((item) =>
      item
        .replace(/^[\u2022\-]\s*/, '')
        .replace(/^Concept Card \d+:\s*/i, '')
        .replace(/^Module \d+:\s*/i, '')
        .trim(),
    )
    .map((item) => {
      if (!item.includes('?')) {
        return item;
      }
      const questionSplit = item.split(/\?\s*/, 2);
      if (questionSplit.length > 1 && questionSplit[1].trim().length > 10) {
        return questionSplit[1].trim();
      }
      return '';
    })
    .filter((item) => item.length > 15 && !item.endsWith('?'))
    .filter((item) => !/^(what|why|how|when|where|who)\b/i.test(item));

  return Array.from(new Set(normalized)).slice(0, 4);
}

function isMiniAssessmentQuestion(question: QuizQuestion): boolean {
  if (question.options.length !== 2) {
    return false;
  }

  const options = question.options.map((option) => option.trim().toLowerCase());
  const hasTrue = options.includes('true');
  const hasFalse = options.includes('false');

  return hasTrue && hasFalse;
}

const FLASHCARD_GAP = 12;
const FLASHCARD_FLIP_DURATION = 420;

const FLASHCARD_THEMES = [
  {
    front: ['#1D4ED8', '#0B2A7C'],
    back: ['#1E3A8A', '#172554'],
    accent: '#93C5FD',
  },
  {
    front: ['#0F766E', '#134E4A'],
    back: ['#115E59', '#042F2E'],
    accent: '#5EEAD4',
  },
  {
    front: ['#7C3AED', '#4C1D95'],
    back: ['#1E40AF', '#3B0764'],
    accent: '#C4B5FD',
  },
  {
    front: ['#B45309', '#7C2D12'],
    back: ['#92400E', '#431407'],
    accent: '#FDBA74',
  },
] as const;

function Flashcard({
  text,
  index,
  cardWidth,
  scrollX,
}: {
  text: string;
  index: number;
  cardWidth: number;
  scrollX: Animated.Value;
}) {
  const theme = FLASHCARD_THEMES[index % FLASHCARD_THEMES.length];
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const inputRange = [
    (index - 1) * (cardWidth + FLASHCARD_GAP),
    index * (cardWidth + FLASHCARD_GAP),
    (index + 1) * (cardWidth + FLASHCARD_GAP),
  ];
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.65, 1, 0.65],
    extrapolate: 'clamp',
  });
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.95, 1, 0.95],
    extrapolate: 'clamp',
  });
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [8, 0, 8],
    extrapolate: 'clamp',
  });

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 88, 92, 180],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 88, 92, 180],
    outputRange: [0, 0, 1, 1],
  });

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
  const cardWidth = Math.max(300, Dimensions.get('window').width - 40);
  const scrollX = useRef(new Animated.Value(0)).current;
  const seenCardsRef = useRef<Set<number>>(new Set());

  const markCardSeen = useCallback(
    (index: number) => {
      if (index < 0 || index >= cards.length) {
        return;
      }
      if (seenCardsRef.current.has(index)) {
        return;
      }
      seenCardsRef.current.add(index);
      onCardViewed?.(1);
    },
    [cards.length, onCardViewed],
  );

  useEffect(() => {
    seenCardsRef.current.clear();
    if (cards.length > 0) {
      markCardSeen(0);
    }
  }, [cards, markCardSeen]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <View style={styles.flashcardsSection}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.flashcardsTitle}>Concept Flashcards</Text>
        <Text style={styles.swipeHint}>Swipe and tap</Text>
      </View>
      <Animated.FlatList
        data={cards}
        horizontal
        keyExtractor={(_, index) => `flashcard-${index}`}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToInterval={cardWidth + FLASHCARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={styles.flashcardList}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={(event) => {
          const x = event.nativeEvent.contentOffset.x;
          const index = Math.round(x / (cardWidth + FLASHCARD_GAP));
          markCardSeen(index);
        }}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          return <Flashcard text={item} index={index} cardWidth={cardWidth} scrollX={scrollX} />;
        }}
      />
      <View style={styles.flashDotRow}>
        {cards.map((_, index) => {
          const dotOpacity = scrollX.interpolate({
            inputRange: [
              (index - 1) * (cardWidth + FLASHCARD_GAP),
              index * (cardWidth + FLASHCARD_GAP),
              (index + 1) * (cardWidth + FLASHCARD_GAP),
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const dotScale = scrollX.interpolate({
            inputRange: [
              (index - 1) * (cardWidth + FLASHCARD_GAP),
              index * (cardWidth + FLASHCARD_GAP),
              (index + 1) * (cardWidth + FLASHCARD_GAP),
            ],
            outputRange: [1, 1.25, 1],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={`flash-dot-${index}`}
              style={[
                styles.flashDot,
                {
                  opacity: dotOpacity,
                  transform: [{ scale: dotScale }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

// MCQ Quiz Component
function MCQQuiz({
  questions,
  onComplete,
}: {
  questions: QuizQuestion[];
  onComplete: (score: number, answers: number[]) => void;
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));

  const scoreRef = useRef(0);

  const handleAnswer = (index: number) => {
    if (answered) return;

    setSelectedAnswer(index);
    setAnswered(true);
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQuestion] = index;
      return next;
    });

    if (index === questions[currentQuestion].correctAnswer) {
      scoreRef.current += 1;
      setScore((prevScore) => prevScore + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prevIndex) => prevIndex + 1);
      setSelectedAnswer(null);
      setAnswered(false);
      return;
    }

    onComplete(scoreRef.current, answers);
  };

  if (currentQuestion >= questions.length) {
    return null;
  }

  const question = questions[currentQuestion];
  const completionPercent = Math.round((currentQuestion / questions.length) * 100);

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
        <View style={styles.quizTopProgressBadge}>
          <Text style={styles.quizTopProgressBadgeText}>{completionPercent}%</Text>
        </View>
      </View>

      <View style={styles.quizPanel}>
        <Text style={styles.questionCount}>
          Question {currentQuestion + 1} of {questions.length} | Score: {score}/{questions.length}
        </Text>
        <Text style={styles.questionText}>{question.question}</Text>

        {question.options.map((option: string, index: number) => {
          const isSelected = selectedAnswer === index;
          const isCorrectOption = index === question.correctAnswer;
          const showCorrect = answered && isCorrectOption;
          const showIncorrect = answered && isSelected && !isCorrectOption;

          return (
            <TouchableOpacity
              key={`quiz-option-${currentQuestion}-${index}`}
              style={[
                styles.option,
                showCorrect && styles.optionCorrect,
                showIncorrect && styles.optionIncorrect,
              ]}
              onPress={() => handleAnswer(index)}
              disabled={answered}
            >
              <Text
                style={[
                  styles.optionText,
                  showCorrect && styles.optionTextCorrect,
                  showIncorrect && styles.optionTextIncorrect,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
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

export default function LearnScreen() {
  const { accessToken, isAuthenticated } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [lessonsError, setLessonsError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<LearningSection>('lessons');
  const [annualIncomeInput, setAnnualIncomeInput] = useState('');
  const [investmentProfitInput, setInvestmentProfitInput] = useState('');

  const loadLessons = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoadingLessons(true);
      setLessonsError(null);
      const data = await apiFetch<ApiLesson[]>('/lessons', {}, accessToken);
      setLessons(data.map(mapLesson));
    } catch (error: any) {
      setLessonsError(error?.message || 'Unable to load lessons.');
    } finally {
      setLoadingLessons(false);
    }
  }, [accessToken]);

  const loadProgress = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<ApiProgress[]>('/progress/me', {}, accessToken);
      const completed = data
        .filter((item) => item.completed)
        .map((item) => (typeof item.lessonId === 'string' ? item.lessonId : item.lessonId._id));
      setCompletedLessons(completed);
    } catch (error) {
      console.warn('Unable to load progress', error);
    }
  }, [accessToken]);

  const loadGamification = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<GamificationSummary>('/progress/gamification', {}, accessToken);
      setGamification(data);
    } catch (error) {
      console.warn('Unable to load gamification summary', error);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    loadLessons();
    loadProgress();
    loadGamification();
  }, [accessToken, loadLessons, loadProgress, loadGamification]);

  const toggleLesson = async (lesson: Lesson) => {
    setSelectedLesson(lesson);
    if (!accessToken) return;
    try {
      await apiFetch(`/progress/start/${lesson.id}`, { method: 'POST' }, accessToken);
    } catch (error) {
      console.warn('Unable to start lesson', error);
    }
  };

  const handleLessonComplete = async (lessonId: string): Promise<LessonCompletionResult> => {
    let completionResult: LessonCompletionResult = {
      xpAwarded: 20,
      newBadges: [],
    };

    if (accessToken) {
      try {
        const result = await apiFetch<LessonCompletionResult>(`/progress/complete/${lessonId}`, { method: 'POST' }, accessToken);
        completionResult = result;
        if (result.gamification) {
          setGamification(result.gamification);
        }
      } catch (error) {
        console.warn('Unable to complete lesson', error);
      }
    }

    setCompletedLessons((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]));
    return completionResult;
  };

  const progress = lessons.length > 0 ? (completedLessons.length / lessons.length) * 100 : 0;
  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => a.order - b.order),
    [lessons],
  );
  const completedLessonCards = useMemo(
    () => sortedLessons.filter((lesson) => completedLessons.includes(lesson.id)),
    [sortedLessons, completedLessons],
  );
  const pendingLessonCards = useMemo(
    () => sortedLessons.filter((lesson) => !completedLessons.includes(lesson.id)),
    [sortedLessons, completedLessons],
  );
  const unlockedPendingLessonId = pendingLessonCards[0]?.id ?? null;
  const continueLesson = useMemo(() => {
    if (!sortedLessons.length) {
      return null;
    }

    if (gamification?.nextLessonId) {
      return sortedLessons.find((item) => item.id === gamification.nextLessonId) ?? null;
    }

    if (unlockedPendingLessonId) {
      return sortedLessons.find((item) => item.id === unlockedPendingLessonId) ?? null;
    }

    return sortedLessons[0] ?? null;
  }, [gamification?.nextLessonId, sortedLessons, unlockedPendingLessonId]);

  const nextLessonTitle = useMemo(() => {
    if (!selectedLesson) {
      return null;
    }
    const lessonIndex = sortedLessons.findIndex((item) => item.id === selectedLesson.id);
    if (lessonIndex < 0) {
      return null;
    }
    return sortedLessons[lessonIndex + 1]?.title ?? null;
  }, [selectedLesson, sortedLessons]);

  const taxSummary = useMemo(() => {
    const annualIncome = parseNumericInput(annualIncomeInput);
    const investmentProfit = parseNumericInput(investmentProfitInput);

    const incomeTax = calculateIncomeTaxFromSlab(annualIncome);
    const capitalGainsTax = investmentProfit * (TAX_REFERENCE_RATES.capitalGainsPercent / 100);
    const dividendTax = investmentProfit * (TAX_REFERENCE_RATES.dividendPercent / 100);
    const estimatedTax = incomeTax + capitalGainsTax + dividendTax;
    const taxableBase = annualIncome + investmentProfit;
    const effectiveRate = taxableBase > 0 ? (estimatedTax / taxableBase) * 100 : 0;

    return {
      annualIncome,
      investmentProfit,
      incomeTax,
      capitalGainsTax,
      dividendTax,
      estimatedTax,
      effectiveRate,
    };
  }, [annualIncomeInput, investmentProfitInput]);

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch((err: any) => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.container}>
      <View style={styles.sparkleBg}>
        <View style={[styles.sparkleDot, { top: 90, left: 28 }]} />
        <View style={[styles.sparkleDotSmall, { top: 170, left: 240 }]} />
        <View style={[styles.sparkleDotSmall, { top: 320, left: 90 }]} />
        <View style={[styles.sparkleDot, { top: 520, left: 278 }]} />
      </View>
      {/* Dark Blue Header */}
      <LinearGradient
        colors={["#041B38", "#0A3269"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.blueHeader}
      >
        <View style={styles.blueHeaderTop}>
          <HeaderBar
            tint="dark"
            rightSlot={isAuthenticated ? <TopRightMenu theme="dark" /> : <GuestAuthActions />}
          />
        </View>
        <Text style={styles.headerTitle}>Beginners Guide</Text>
        <Text style={styles.headerSubtitle}>Micro lessons, instant feedback, rewards, and streaks</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {!isAuthenticated && (
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Login Required</Text>
            <Text style={styles.tipText}>
              Please log in to load lessons, track progress, and save quiz scores.
            </Text>
          </View>
        )}
        <View style={styles.sectionTabsWrap}>
          <TouchableOpacity
            onPress={() => setActiveSection('lessons')}
            style={[
              styles.sectionTab,
              activeSection === 'lessons' && styles.sectionTabActive,
            ]}
          >
            <BookOpen size={14} color={activeSection === 'lessons' ? '#fff' : '#475569'} />
            <Text
              style={[
                styles.sectionTabText,
                activeSection === 'lessons' && styles.sectionTabTextActive,
              ]}
            >
              Lessons
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveSection('tax')}
            style={[
              styles.sectionTab,
              activeSection === 'tax' && styles.sectionTabActive,
            ]}
          >
            <PieChart size={14} color={activeSection === 'tax' ? '#fff' : '#475569'} />
            <Text
              style={[
                styles.sectionTabText,
                activeSection === 'tax' && styles.sectionTabTextActive,
              ]}
            >
              Tax Hub
            </Text>
          </TouchableOpacity>
        </View>

        {activeSection === 'lessons' ? (
          <>
            <View style={styles.learningDashboardCard}>
              <View style={styles.learningDashboardRow}>
                <Text style={styles.dashboardChip}>🔥 {gamification?.streakDays ?? 0} Day Streak</Text>
                <Text style={styles.dashboardChip}>XP: {gamification?.xp ?? 0}</Text>
                <Text style={styles.dashboardChip}>Level: {gamification?.level ?? 1}</Text>
              </View>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => continueLesson && toggleLesson(continueLesson)}
                disabled={!continueLesson}
              >
                <Text style={styles.continueButtonText}>
                  Continue Learning {continueLesson ? `- ${continueLesson.title}` : ''}
                </Text>
                <ChevronRight size={16} color="#DBEAFE" />
              </TouchableOpacity>
            </View>

            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressTextContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={styles.cardTitle}>Your Progress</Text>
                  <Text style={styles.progressStat}>{completedLessonCards.length}/{sortedLessons.length}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
                {progress >= 100 && sortedLessons.length > 0 && (
                  <Text style={styles.levelCompleteText}>Financial Literacy Level 1 Completed</Text>
                )}
              </View>
            </View>

            {sortedLessons.length > 0 && (
              <View style={styles.pathCard}>
                <Text style={styles.pathTitle}>Lesson Path</Text>
                {sortedLessons.map((lesson, index) => {
                  const isComplete = completedLessons.includes(lesson.id);
                  const isPendingUnlocked = unlockedPendingLessonId === lesson.id;
                  const isLocked = !isComplete && !isPendingUnlocked;
                  return (
                    <View key={`path-${lesson.id}`} style={styles.pathRow}>
                      <View
                        style={[
                          styles.pathBubble,
                          isComplete && styles.pathBubbleComplete,
                          isPendingUnlocked && styles.pathBubbleActive,
                          isLocked && styles.pathBubbleLocked,
                        ]}
                      >
                        {isComplete ? <CheckCircle size={14} color="#E2E8F0" /> : isLocked ? <Lock size={14} color="#94A3B8" /> : <Play size={14} color="#DBEAFE" />}
                      </View>
                      <Text style={[styles.pathLessonText, isLocked && styles.pathLessonTextLocked]}>
                        Lesson {index + 1}: {lesson.title}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {loadingLessons && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color="#5B8DEF" />
                <Text style={{ marginTop: 8, color: '#64748B' }}>Loading lessons...</Text>
              </View>
            )}

            {lessonsError && (
              <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>Lesson Load Error</Text>
                <Text style={styles.tipText}>{lessonsError}</Text>
                <TouchableOpacity style={[styles.retakeButton, { marginTop: 12 }]} onPress={loadLessons}>
                  <Text style={styles.retakeButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Completed Lessons Section */}
            {completedLessonCards.length > 0 && sortedLessons.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Completed Lessons</Text>
                {completedLessonCards
                  .map((lesson) => {
                    const Icon = lesson.icon;
                    return (
                      <TouchableOpacity
                        key={lesson.id}
                        onPress={() => toggleLesson(lesson)}
                        style={styles.completedLessonCard}
                      >
                        <View style={styles.lessonHeader}>
                          <View style={[styles.iconBox, { backgroundColor: lesson.color + '20' }]}>
                            <Icon color={lesson.color} size={20} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={styles.titleRow}>
                              <Text style={styles.lessonTitle}>{lesson.title}</Text>
                              <CheckCircle size={18} color="#5B8DEF" />
                            </View>
                            <Text style={styles.lessonContent} numberOfLines={1}>{lesson.content}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </>
            )}

            {/* Lessons Section */}
            <Text style={styles.sectionTitle}>Interactive Lessons</Text>
            {pendingLessonCards
              .map((lesson) => {
                const Icon = lesson.icon;
                const isLocked = unlockedPendingLessonId !== null && lesson.id !== unlockedPendingLessonId;
                return (
                  <View key={lesson.id} style={styles.lessonCard}>
                    <View style={styles.lessonHeader}>
                      <View style={[styles.iconBox, { backgroundColor: lesson.color + '20' }]}>
                        <Icon color={lesson.color} size={20} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.titleRow}>
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                          <Text style={styles.durationText}>{lesson.duration}</Text>
                        </View>
                        <Text style={styles.lessonContent} numberOfLines={2}>{lesson.content}</Text>
                        <View style={styles.lessonFeatures}>
                          <View style={styles.featureBadge}>
                            <Play size={12} color={lesson.color} />
                            <Text style={[styles.featureText, { color: lesson.color }]}>Video</Text>
                          </View>
                          <View style={styles.featureBadge}>
                            <HelpCircle size={12} color={lesson.color} />
                            <Text style={[styles.featureText, { color: lesson.color }]}>
                              Quiz
                            </Text>
                          </View>
                          {isLocked && (
                            <View style={styles.lockPill}>
                              <Lock size={12} color="#334155" />
                              <Text style={styles.lockPillText}>Locked</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => toggleLesson(lesson)}
                      disabled={isLocked}
                      style={[styles.buttonIncomplete, isLocked && styles.buttonLocked]}
                    >
                      <Text style={styles.buttonTextIncomplete}>
                        {isLocked ? 'Complete Previous Lesson to Unlock' : 'Start Learning'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

            {/* Verified Resources Section */}
            <Text style={styles.sectionTitle}>Verified Resources</Text>
            {externalResources.map((resource, index) => (
              <TouchableOpacity
                key={index}
                style={styles.resourceCard}
                onPress={() => handleOpenURL(resource.url)}
              >
                <View style={styles.resourceIconBox}>
                  <ExternalLink size={18} color="#5B8DEF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.resourceTitle}>{resource.title}</Text>
                  <Text style={styles.resourceDesc}>{resource.description}</Text>
                </View>
                <ChevronRight size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))}

            {/* Study Tip Section */}
            <View style={styles.tipCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Info size={16} color="#1E40AF" />
                <Text style={styles.tipTitle}>Study Tip</Text>
              </View>
              <Text style={styles.tipText}>
                Watch the video first, read the content, then take the quiz to test your knowledge. Complete all lessons to master stock market basics!
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Tax Hub</Text>
            <View style={styles.taxHubCard}>
              <Text style={styles.taxHubTitle}>Tax Basics</Text>
              <Text style={styles.taxHubSubtitle}>
                Quick overview of key tax types and common rates.
              </Text>
              {TAX_BASICS.map((item) => (
                <View key={item.title} style={styles.taxBasicRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taxBasicTitle}>{item.title}</Text>
                    <Text style={styles.taxBasicSubtitle}>{item.subtitle}</Text>
                  </View>
                  <View style={styles.taxRatePill}>
                    <Text style={styles.taxRateText}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.taxHubCard}>
              <Text style={styles.taxHubTitle}>Tax Slab Calculator</Text>
              <Text style={styles.taxHubSubtitle}>
                Enter yearly income and investment profit to estimate tax impact.
              </Text>
              <Text style={styles.taxInputLabel}>Annual Income (NPR)</Text>
              <TextInput
                value={annualIncomeInput}
                onChangeText={setAnnualIncomeInput}
                style={styles.taxInput}
                placeholder="e.g. 850000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
              <Text style={styles.taxInputLabel}>Investment Profit (NPR)</Text>
              <TextInput
                value={investmentProfitInput}
                onChangeText={setInvestmentProfitInput}
                style={styles.taxInput}
                placeholder="e.g. 120000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />

              <View style={styles.taxResultCard}>
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxResultLabel}>Estimated Tax</Text>
                  <Text style={styles.taxResultValue}>{formatCurrency(taxSummary.estimatedTax)}</Text>
                </View>
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxResultLabel}>Effective Tax Rate</Text>
                  <Text style={styles.taxResultValue}>{taxSummary.effectiveRate.toFixed(2)}%</Text>
                </View>
                <View style={styles.taxDivider} />
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxBreakdownLabel}>Income Tax</Text>
                  <Text style={styles.taxBreakdownValue}>{formatCurrency(taxSummary.incomeTax)}</Text>
                </View>
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxBreakdownLabel}>Capital Gains Tax</Text>
                  <Text style={styles.taxBreakdownValue}>{formatCurrency(taxSummary.capitalGainsTax)}</Text>
                </View>
                <View style={styles.taxResultRow}>
                  <Text style={styles.taxBreakdownLabel}>Dividend Tax</Text>
                  <Text style={styles.taxBreakdownValue}>{formatCurrency(taxSummary.dividendTax)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.taxDisclaimerCard}>
              <Info size={14} color="#1E40AF" />
              <Text style={styles.taxDisclaimerText}>
                Tax Hub values are for educational estimation only. Always verify with current official tax notices and a licensed tax advisor.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Lesson Detail Modal */}
      {selectedLesson && (
        <LessonDetailView
          lesson={selectedLesson}
          onClose={() => setSelectedLesson(null)}
          onComplete={handleLessonComplete}
          isCompleted={completedLessons.includes(selectedLesson.id)}
          nextLessonTitle={nextLessonTitle}
          onGamificationUpdate={setGamification}
        />
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
  progressTextContainer: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#E2E8F0' },
  progressStat: { fontSize: 14, fontWeight: '700', color: '#60A5FA' },
  progressBarBg: { backgroundColor: '#0B264A', height: 10, borderRadius: 5 },
  progressBarFill: { backgroundColor: '#3B82F6', height: 10, borderRadius: 5 },
  levelCompleteText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#93C5FD',
  },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#DBEAFE', marginBottom: 16, marginTop: 8 },
  pathCard: {
    backgroundColor: '#07172C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    padding: 14,
    marginBottom: 16,
  },
  pathTitle: {
    color: '#DBEAFE',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  pathBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B264A',
  },
  pathBubbleComplete: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  pathBubbleActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#93C5FD',
  },
  pathBubbleLocked: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  pathLessonText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '600',
  },
  pathLessonTextLocked: {
    color: '#94A3B8',
  },

  lessonCard: {
    backgroundColor: '#FAFAF5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E3'
  },
  lessonCardCompleted: { borderColor: '#5B8DEF', backgroundColor: '#E8F1FF' },
  completedLessonCard: {
    backgroundColor: '#E8F1FF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#5B8DEF',
  },
  lessonHeader: { flexDirection: 'row', marginBottom: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  lessonTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  durationText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  lessonContent: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 8 },
  lessonFeatures: { flexDirection: 'row', gap: 8, marginTop: 4 },
  featureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  featureText: { fontSize: 11, fontWeight: '600' },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  button: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  buttonIncomplete: {
    backgroundColor: '#0B3B78',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLocked: {
    opacity: 0.55,
  },
  buttonCompleted: { backgroundColor: '#E0EDD8' },
  buttonText: { fontWeight: '700', fontSize: 15 },
  buttonTextIncomplete: { color: '#fff', fontSize: 15 },
  buttonTextCompleted: { color: '#3F6DD8' },

  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  resourceIconBox: { backgroundColor: '#E8F1FF', padding: 8, borderRadius: 10 },
  resourceTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  resourceDesc: { fontSize: 12, color: '#64748B' },

  tipCard: { backgroundColor: '#E0ECFF', padding: 16, borderRadius: 16, marginTop: 10, borderWidth: 1, borderColor: '#93C5FD' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginLeft: 8 },
  tipText: { fontSize: 13, color: '#1E40AF', lineHeight: 18, marginTop: 4 },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#082349' },
  modalContent: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  modalHeader: { marginTop: 40, marginBottom: 20, alignItems: 'center' },
  modalHeaderCompact: {
    backgroundColor: '#031D44',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  modalHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 22, color: '#fff', fontWeight: '600' },
  modalIconBox: { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalIconBoxCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  modalTitleCompact: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  completedBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5B8DEF',
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3F6DD8',
  },

  topicCard: {
    backgroundColor: '#DCE9FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B5C8E6',
    padding: 14,
    marginBottom: 12,
  },
  topicLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  topicTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    color: '#123B77',
    lineHeight: 24,
  },
  topicMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#415A80',
    fontWeight: '600',
  },

  // Video Section
  videoSection: { marginTop: 16, marginBottom: 20 },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  videoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    marginBottom: 12
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000'
  },
  closeVideoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  watchVideoButton: {
    backgroundColor: '#5B8DEF',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  watchVideoText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Content Section
  contentSection: {
    marginBottom: 12,
    backgroundColor: '#E9F2FF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B5C8E6',
  },
  contentTitle: { fontSize: 16, fontWeight: '700', color: '#1E3660', marginBottom: 10 },
  contentText: { fontSize: 14, color: '#23395D', lineHeight: 22 },
  flashcardsSection: {
    marginBottom: 12,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  swipeHint: {
    fontSize: 12,
    color: '#C4B5FD',
    fontWeight: '700',
  },
  flashcardList: {
    paddingRight: 12,
    paddingBottom: 4,
  },
  flashcardItemShell: {
    marginRight: FLASHCARD_GAP,
    minHeight: 228,
  },
  flashcardTouch: {
    flex: 1,
  },
  flashcardPerspective: {
    flex: 1,
    position: 'relative',
  },
  flashcardFaceWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  flashcardFace: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    justifyContent: 'space-between',
  },
  flashcardAccentBar: {
    width: 60,
    height: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  flashcardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E2E8F0',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  flashcardText: {
    fontSize: 17,
    color: '#F8FAFC',
    lineHeight: 26,
    fontWeight: '600',
    flex: 1,
  },
  flashcardBackTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  flashcardBackText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#DBEAFE',
    fontWeight: '600',
    flex: 1,
  },
  flashcardHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#BFDBFE',
  },
  flashcardShine: {
    position: 'absolute',
    top: 0,
    right: -20,
    width: 120,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomLeftRadius: 90,
  },
  flashDotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  flashDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  flashcardsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#123B77',
    marginBottom: 8,
  },
  recapBlock: {
    marginTop: 2,
    backgroundColor: '#E9F2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B5C8E6',
    padding: 14,
    marginBottom: 14,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 7,
  },
  recapDot: {
    marginTop: 6,
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#1E3A8A',
  },
  recapText: {
    flex: 1,
    color: '#23395D',
    fontSize: 13,
    lineHeight: 19,
  },

  // Quiz Section
  quizSection: {
    backgroundColor: '#E9F2FF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#B5C8E6'
  },
  quizSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  quizSectionTitle: { fontSize: 16, fontWeight: '800', color: '#123B77' },
  quizSectionDesc: { fontSize: 13, color: '#415A80', marginBottom: 8, lineHeight: 18 },
  quizSectionSubText: { fontSize: 12, color: '#1E3A8A', marginBottom: 10, fontWeight: '600' },
  noQuizHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noQuizHintText: {
    flex: 1,
    color: '#1E3A8A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  startQuizButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
  },
  startQuizButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // MCQ Quiz Styles
  quizContainer: {
    marginBottom: 24,
  },
  quizTopProgress: {
    backgroundColor: '#DCE9FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B5C8E6',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quizTopProgressTextWrap: {
    flex: 1,
  },
  quizTopProgressLabel: {
    color: '#23395D',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  quizTopProgressBarBg: {
    width: '100%',
    height: 10,
    backgroundColor: '#B8C4D9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quizTopProgressBarFill: {
    height: '100%',
    backgroundColor: '#6EE7D6',
    borderRadius: 8,
  },
  quizTopProgressBadge: {
    width: 62,
    height: 62,
    borderRadius: 32,
    backgroundColor: '#7C2DDB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTopProgressBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  quizPanel: {
    backgroundColor: '#E9F2FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B5C8E6',
    padding: 18,
    marginBottom: 24,
  },
  questionCount: {
    fontSize: 12,
    color: '#415A80',
    fontWeight: '700',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 29,
    fontWeight: '800',
    color: '#0F2549',
    marginBottom: 16,
    lineHeight: 36,
  },
  option: {
    backgroundColor: '#F4F8FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  optionCorrect: { backgroundColor: '#D1FAE5', borderColor: '#10B981' },
  optionIncorrect: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  optionText: { fontSize: 17, color: '#111827', fontWeight: '600' },
  optionTextCorrect: { color: '#065F46', fontWeight: '700' },
  optionTextIncorrect: { color: '#991B1B', fontWeight: '700' },
  answerBox: {
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  answerText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  answerSubtext: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginTop: 6,
  },
  nextButton: {
    alignSelf: 'center',
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  nextButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Quiz Results
  quizResults: {
    backgroundColor: '#FAFAF5',
    padding: 32,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E3'
  },
  resultsTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginTop: 16, marginBottom: 8 },
  resultsScore: { fontSize: 16, color: '#64748B', marginBottom: 8 },
  resultsPercentage: { fontSize: 48, fontWeight: '800', color: '#5B8DEF', marginBottom: 8 },
  congratsText: { fontSize: 14, color: '#3F6DD8', fontWeight: '600', marginTop: 8, textAlign: 'center' },
  badgeUnlockRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#166534',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeUnlockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  unlockHintText: {
    marginTop: 10,
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  retakeButton: {
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 24
  },
  retakeButtonText: { color: '#64748B', fontWeight: '700', fontSize: 14 },

  // Complete Section
  completeSection: {
    marginTop: 20,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#04395E',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  completeNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
  rewardCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    backgroundColor: '#0B264A',
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    gap: 4,
  },
  rewardTitle: {
    color: '#DBEAFE',
    fontWeight: '800',
    fontSize: 19,
  },
  rewardXp: {
    color: '#7DD3FC',
    fontWeight: '800',
    fontSize: 24,
  },
  rewardMeta: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '600',
  },
});
