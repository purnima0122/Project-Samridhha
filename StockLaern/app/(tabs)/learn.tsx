import {
  Award,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Flame,
  HelpCircle,
  Info,
  Lock,
  PieChart,
  Play,
  Shield,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import GuestAuthActions from "../components/GuestAuthActions";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (e) {
  console.warn('WebView not available', e);
}
function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';

  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${id}?controls=1&playsinline=1`;
  }
  if (url.includes('watch?v=')) {
    const id = url.split('watch?v=')[1].split('&')[0];
    return `https://www.youtube.com/embed/${id}?controls=1&playsinline=1`;
  }

  return url;
}

type ApiQuizQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

type ApiLesson = {
  _id: string;
  title: string;
  module: string;
  content: string;
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

type WeeklyProgressDay = {
  label: string;
  date: string;
  completed: boolean;
  isToday: boolean;
  status: 'done' | 'today' | 'missed' | 'locked';
};

type GamificationSummary = {
  xp: number;
  level: number;
  streakDays: number;
  streakFreezes: number;
  maxStreakFreezes: number;
  badges: string[];
  lessonsCompletedCount: number;
  correctQuizAnswers: number;
  xpToNextLevel: number;
  weeklyProgress: WeeklyProgressDay[];
  streakMessage?: string;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  totalLessons: number;
  completedLessons: number;
  coursePercent: number;
};

type LessonCompletionResult = {
  xpAwarded: number;
  newBadges: string[];
  gamification?: GamificationSummary;
};

type Lesson = {
  id: string;
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

type ChapterNode = {
  id: string;
  module: string;
  chapterNumber: number;
  lessons: Lesson[];
  total: number;
  completedCount: number;
  isCompleted: boolean;
  isLocked: boolean;
  openLesson: Lesson | null;
  icon: any;
  color: string;
};

const iconMap: Record<string, any> = {
  TrendingUp,
  BookOpen,
  Shield,
  PieChart,
  HelpCircle,
};

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

  const toggleFlip = () => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      duration: FLASHCARD_FLIP_DURATION,
      useNativeDriver: true,
    }).start();
    setIsFlipped((prev) => !prev);
  };

  return (
    <Animated.View
      style={[
        styles.flashcardItemShell,
        {
          width: cardWidth,
          opacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      <TouchableOpacity style={styles.flashcardTouch} activeOpacity={1} onPress={toggleFlip}>
        <View style={styles.flashcardPerspective}>
          <Animated.View
            style={[
              styles.flashcardFaceWrap,
              {
                opacity: frontOpacity,
                transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
              },
            ]}
          >
            <LinearGradient colors={theme.front} style={styles.flashcardFace}>
              <View style={[styles.flashcardAccentBar, { backgroundColor: theme.accent }]} />
              <Text style={styles.flashcardLabel}>Concept Card</Text>
              <Text style={styles.flashcardText}>{text}</Text>
              <Text style={styles.flashcardHint}>Tap to flip</Text>
              <View style={styles.flashcardShine} />
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={[
              styles.flashcardFaceWrap,
              {
                opacity: backOpacity,
                transform: [{ perspective: 1200 }, { rotateY: backRotate }],
              },
            ]}
          >
            <LinearGradient colors={theme.back} style={styles.flashcardFace}>
              <View style={[styles.flashcardAccentBar, { backgroundColor: theme.accent }]} />
              <Text style={styles.flashcardBackTitle}>Quick Recall</Text>
              <Text style={styles.flashcardBackText}>
                Explain this point in your own words before moving to the next card.
              </Text>
              <Text style={styles.flashcardHint}>Tap to return</Text>
            </LinearGradient>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function FlashcardCarousel({
  cards,
  onCardViewed,
}: {
  cards: string[];
  onCardViewed?: (count: number) => void;
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
    <View style={styles.quizContainer}>
      <View style={styles.quizTopProgress}>
        <View style={styles.quizTopProgressTextWrap}>
          <Text style={styles.quizTopProgressLabel}>Easy practice quiz for beginners</Text>
          <View style={styles.quizTopProgressBarBg}>
            <View style={[styles.quizTopProgressBarFill, { width: `${completionPercent}%` }]} />
          </View>
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

        {answered && (
          <View style={styles.answerBox}>
            <Text style={styles.answerText}>
              Correct answer: {question.options[question.correctAnswer]}
            </Text>
            {question.explanation ? (
              <Text style={styles.answerSubtext}>{question.explanation}</Text>
            ) : null}
          </View>
        )}

        {answered && (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentQuestion === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Detailed Lesson View Component
function LessonDetailView({
  lesson,
  onClose,
  onComplete,
  isCompleted,
  nextLessonTitle,
  onGamificationUpdate,
}: {
  lesson: Lesson;
  onClose: () => void;
  onComplete: (lessonId: string) => Promise<LessonCompletionResult | void> | LessonCompletionResult | void;
  isCompleted: boolean;
  nextLessonTitle?: string | null;
  onGamificationUpdate?: (summary: GamificationSummary) => void;
}) {
  const { accessToken } = useAuth();
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [startedWorld, setStartedWorld] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizXpAwarded, setQuizXpAwarded] = useState(0);
  const [bonusXpAwarded, setBonusXpAwarded] = useState(0);
  const [reward, setReward] = useState<LessonCompletionResult | null>(null);
  const [showXpCelebration, setShowXpCelebration] = useState(false);
  const [celebrationXp, setCelebrationXp] = useState(0);
  const celebrationAnim = useRef(new Animated.Value(0)).current;

  const conceptCards = useMemo(() => splitLessonIntoCards(lesson.content), [lesson.content]);
  const recapPoints = useMemo(() => conceptCards.slice(0, 5), [conceptCards]);
  const miniAssessmentCount = useMemo(
    () => lesson.mcqs.filter(isMiniAssessmentQuestion).length,
    [lesson.mcqs],
  );
  const lessonIntro = useMemo(() => {
    if (conceptCards.length > 0) {
      return conceptCards.slice(0, 2).join(' ');
    }
    return lesson.content;
  }, [conceptCards, lesson.content]);

  const handleWatchVideo = () => {
    setShowVideo(true);
  };

  const handleCloseVideo = () => {
    setShowVideo(false);
  };

  const embedUrl = getYouTubeEmbedUrl(lesson.videoUrl);

  const playXpCelebration = useCallback((xp: number) => {
    setCelebrationXp(xp);
    setShowXpCelebration(true);
    celebrationAnim.setValue(0);
    Animated.sequence([
      Animated.timing(celebrationAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.timing(celebrationAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => setShowXpCelebration(false));
  }, [celebrationAnim]);

  const handleQuizComplete = async (score: number, answers: number[]) => {
    setQuizScore(score);
    setQuizCompleted(true);
    if (!accessToken) {
      if (score === lesson.mcqs.length) {
        await onComplete(lesson.id);
      }
      return;
    }

    try {
      setSubmittingQuiz(true);
      const result = await apiFetch<{
        passed: boolean;
        scorePercent: number;
        bestScore: number;
        xpAwarded?: number;
        bonusXpAwarded?: number;
        gamification?: GamificationSummary;
      }>(`/progress/quiz/${lesson.id}`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }, accessToken);

      setQuizXpAwarded(result.xpAwarded ?? 0);
      setBonusXpAwarded(result.bonusXpAwarded ?? 0);
      if (result.gamification) {
        onGamificationUpdate?.(result.gamification);
      }

      if (result.passed) {
        const completionResult = await onComplete(lesson.id);
        if (completionResult) {
          setReward(completionResult);
          playXpCelebration((result.xpAwarded ?? 0) + (completionResult.xpAwarded ?? 0));
          if (completionResult.gamification) {
            onGamificationUpdate?.(completionResult.gamification);
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Quiz Error', error?.message || 'Unable to submit quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleStartQuiz = () => {
    if (lesson.mcqs.length === 0) {
      Alert.alert('Quiz Not Available', 'This lesson does not have quiz questions yet.');
      return;
    }
    setShowQuiz(true);
    setQuizScore(null);
    setQuizCompleted(false);
    setQuizXpAwarded(0);
    setBonusXpAwarded(0);
  };

  const inFlashcardsWorld = startedWorld && !showQuiz && !quizCompleted;
  const inQuizWorld = showQuiz && !quizCompleted;

  if (inQuizWorld) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderCompact}>
            <View style={styles.modalHeaderTop}>
              <TouchableOpacity onPress={() => setShowQuiz(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleCompact}>Quiz World</Text>
              </View>
            </View>
          </View>
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.quizWorldContainer}
          >
            {lesson.mcqs.length > 0 ? (
              <MCQQuiz questions={lesson.mcqs} onComplete={handleQuizComplete} />
            ) : (
              <View style={styles.noQuizHint}>
                <Info size={14} color="#1D4ED8" />
                <Text style={styles.noQuizHintText}>Quiz questions are not added for this lesson yet.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  if (inFlashcardsWorld) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderCompact}>
            <View style={styles.modalHeaderTop}>
              <TouchableOpacity onPress={() => setStartedWorld(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleCompact}>Flashcards World</Text>
              </View>
            </View>
          </View>
          <View style={styles.flashcardsWorldContainer}>
            <FlashcardCarousel
              cards={conceptCards}
              onCardViewed={async (count) => {
                if (!accessToken) {
                  return;
                }

                try {
                  const result = await apiFetch<{ gamification?: GamificationSummary }>(
                    `/progress/flashcard/${lesson.id}`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ count }),
                    },
                    accessToken,
                  );
                  if (result.gamification) {
                    onGamificationUpdate?.(result.gamification);
                  }
                } catch (error) {
                  console.warn('Unable to record flashcard view', error);
                }
              }}
            />
            <TouchableOpacity style={styles.worldActionButton} onPress={handleStartQuiz}>
              <Text style={styles.worldActionText}>Go To Quiz World</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={true} animationType="slide" presentationStyle="formSheet">
      <View style={styles.modalContainer}>
        {/* Compact Header */}
        <View style={styles.modalHeaderCompact}>
          <View style={styles.modalHeaderTop}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            <View style={[styles.modalIconBoxCompact, { backgroundColor: lesson.color + '20' }]}>
              {React.createElement(lesson.icon, { color: '#fff', size: 20 })}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.modalTitleCompact}>{lesson.title}</Text>
              {isCompleted && (
                <View style={styles.completedBadgeHeader}>
                  <CheckCircle size={16} color="#5B8DEF" />
                  <Text style={styles.completedBadgeText}>Completed</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Video Section */}
          <View style={styles.videoSection}>
            {!showVideo ? (
              <>
                <TouchableOpacity 
                  style={styles.videoPlaceholder}
                  onPress={handleWatchVideo}
                  activeOpacity={0.8}
                >
                  <Play size={32} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.watchVideoButton} onPress={handleWatchVideo}>
                  <Play size={16} color="#fff" />
                  <Text style={styles.watchVideoText}>Watch Video</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.videoContainer}>
                <TouchableOpacity 
                  style={styles.closeVideoButton}
                  onPress={handleCloseVideo}
                >
                  <X size={20} color="#fff" />
                </TouchableOpacity>
            {Platform.OS !== 'web' && embedUrl && (
                  <WebView
                    source={{ uri: embedUrl }}
                    style={styles.videoPlayer}
                    allowsFullscreenVideo
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled
                    domStorageEnabled
                  />
                )}
                {Platform.OS === 'web' && (
                  <Text style={{ color: '#fff', textAlign: 'center', marginTop: 80 }}>
                    Video player not available on web
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.topicCard}>
            <Text style={styles.topicLabel}>Lesson Topic</Text>
            <Text style={styles.topicTitle}>{lesson.title}</Text>
            <Text style={styles.topicMeta}>
              {lesson.module} • {lesson.duration}
            </Text>
          </View>

          {!startedWorld && (
            <View style={styles.worldCard}>
              <Text style={styles.worldTitle}>Start Learning</Text>
              <Text style={styles.worldText}>{lessonIntro}</Text>
              <Text style={styles.worldMeta}>Step 1: Flashcards World • Step 2: Quiz World • Step 3: Rewards</Text>
              <TouchableOpacity style={styles.worldActionButton} onPress={() => setStartedWorld(true)}>
                <Text style={styles.worldActionText}>Enter Flashcards World</Text>
              </TouchableOpacity>
            </View>
          )}

          {startedWorld && !showQuiz && !quizCompleted && (
            <>
              {/* Content Section */}
              <View style={styles.contentSection}>
                <Text style={styles.contentTitle}>Flashcards World</Text>
                <Text style={styles.contentText}>{lessonIntro}</Text>
              </View>

              <FlashcardCarousel
                cards={conceptCards}
                onCardViewed={async (count) => {
                  if (!accessToken) {
                    return;
                  }

                  try {
                    const result = await apiFetch<{ gamification?: GamificationSummary }>(
                      `/progress/flashcard/${lesson.id}`,
                      {
                        method: 'POST',
                        body: JSON.stringify({ count }),
                      },
                      accessToken,
                    );
                    if (result.gamification) {
                      onGamificationUpdate?.(result.gamification);
                    }
                  } catch (error) {
                    console.warn('Unable to record flashcard view', error);
                  }
                }}
              />

              {recapPoints.length > 0 && (
                <View style={styles.recapBlock}>
                  <Text style={styles.blockTitle}>Quick Recap</Text>
                  {recapPoints.map((point, index) => (
                    <View key={`${lesson.id}-recap-${index}`} style={styles.recapRow}>
                      <View style={styles.recapDot} />
                      <Text style={styles.recapText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Quiz Section */}
          {startedWorld && !showQuiz && !quizCompleted && (
            <View style={styles.quizSection}>
              <View style={styles.quizSectionHeader}>
                <HelpCircle size={18} color={lesson.color} />
                <Text style={styles.quizSectionTitle}>Test Your Knowledge</Text>
              </View>
              <Text style={styles.quizSectionDesc}>
                Finish this lesson with {lesson.mcqs.length} MCQs.
              </Text>
              {miniAssessmentCount > 0 && (
                <Text style={styles.quizSectionSubText}>
                  Includes {miniAssessmentCount} mini assessment checks.
                </Text>
              )}
              {lesson.mcqs.length === 0 ? (
                <View style={styles.noQuizHint}>
                  <Info size={14} color="#1D4ED8" />
                  <Text style={styles.noQuizHintText}>
                    Quiz questions are not added for this lesson yet.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.startQuizButton} onPress={handleStartQuiz}>
                  <HelpCircle size={14} color="#fff" />
                  <Text style={styles.startQuizButtonText}>Go To Quiz World</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quiz Component */}
          {showQuiz && !quizCompleted && lesson.mcqs.length > 0 && (
            <MCQQuiz questions={lesson.mcqs} onComplete={handleQuizComplete} />
          )}

          {/* Quiz Results */}
          {quizCompleted && quizScore !== null && (
            <View style={styles.quizResults}>
              <Award size={48} color={quizScore === lesson.mcqs.length ? "#5B8DEF" : "#D4A574"} />
              <Text style={styles.resultsTitle}>
                {quizScore === lesson.mcqs.length ? "Perfect Score!" : "Quiz Completed!"}
              </Text>
              <Text style={styles.resultsScore}>
                You scored {quizScore} out of {lesson.mcqs.length}
              </Text>
              <Text style={styles.resultsPercentage}>
                {Math.round((quizScore / lesson.mcqs.length) * 100)}%
              </Text>
              {quizScore === lesson.mcqs.length && (
                <Text style={styles.congratsText}>Great job! You have mastered this lesson.</Text>
              )}
              {Math.round((quizScore / lesson.mcqs.length) * 100) >= PASSING_SCORE_PERCENT && (
                <View style={styles.badgeUnlockRow}>
                  <Award size={14} color="#fff" />
                  <Text style={styles.badgeUnlockText}>Beginner Investor Badge Unlocked</Text>
                </View>
              )}
              {Math.round((quizScore / lesson.mcqs.length) * 100) >= PASSING_SCORE_PERCENT && nextLessonTitle && (
                <Text style={styles.unlockHintText}>
                  Next lesson unlocked: {nextLessonTitle}
                </Text>
              )}
              {submittingQuiz && (
                <Text style={styles.resultsScore}>Saving quiz results...</Text>
              )}
              {quizXpAwarded > 0 && (
                <Text style={styles.congratsText}>+{quizXpAwarded} XP from quiz performance</Text>
              )}
              {bonusXpAwarded > 0 && (
                <Text style={styles.congratsText}>+{bonusXpAwarded} XP bonus for scoring 3/4 or higher</Text>
              )}
              <TouchableOpacity style={styles.retakeButton} onPress={handleStartQuiz}>
                <Text style={styles.retakeButtonText}>Retake Quiz</Text>
              </TouchableOpacity>
            </View>
          )}

          {reward && (
            <View style={styles.rewardCard}>
              <Text style={styles.rewardTitle}>Lesson Completed!</Text>
              <Text style={styles.rewardXp}>+{reward.xpAwarded} XP</Text>
              <Text style={styles.rewardMeta}>Streak: {reward.gamification?.streakDays ?? 0} days</Text>
              <Text style={styles.rewardMeta}>
                Badge Earned: {reward.newBadges[0] ?? 'Keep going to unlock badges'}
              </Text>
            </View>
          )}

          <View style={styles.completeSection}>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={async () => {
                const completionResult = await onComplete(lesson.id);
                if (completionResult) {
                  setReward(completionResult);
                  playXpCelebration(completionResult.xpAwarded ?? 0);
                  if (completionResult.gamification) {
                    onGamificationUpdate?.(completionResult.gamification);
                  }
                }
                Alert.alert('Lesson Completed!', 'Great job! You\'ve completed this lesson.', [
                  {
                    text: 'OK',
                    onPress: () => {
                      onClose();
                    },
                  },
                ]);
              }}
            >
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.completeButtonText}>Mark as Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retakeButton, { marginTop: 12 }]}
              onPress={onClose}
            >
              <Text style={styles.retakeButtonText}>Back to Lessons</Text>
            </TouchableOpacity>
            <Text style={styles.completeNote}>
              Click to mark this lesson as completed
            </Text>
          </View>
        </ScrollView>

        {showXpCelebration && (
          <Animated.View
            style={[
              styles.celebrationOverlay,
              {
                opacity: celebrationAnim,
                transform: [
                  {
                    translateY: celebrationAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Flame size={18} color="#60A5FA" />
            <Text style={styles.celebrationText}>Streak Flame Lit • +{celebrationXp} XP</Text>
          </Animated.View>
        )}
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
  const [selectedChapter, setSelectedChapter] = useState<ChapterNode | null>(null);
  const [annualIncomeInput, setAnnualIncomeInput] = useState('');
  const [investmentProfitInput, setInvestmentProfitInput] = useState('');
  const flamePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flamePulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(flamePulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [flamePulse]);

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

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => a.order - b.order),
    [lessons],
  );
  const continueLesson = useMemo(() => {
    if (!sortedLessons.length) {
      return null;
    }

    if (gamification?.nextLessonId) {
      return sortedLessons.find((item) => item.id === gamification.nextLessonId) ?? null;
    }
    return sortedLessons.find((item) => !completedLessons.includes(item.id)) ?? sortedLessons[0] ?? null;
  }, [completedLessons, gamification?.nextLessonId, sortedLessons]);

  const chapterCards = useMemo<ChapterNode[]>(() => {
    const moduleMap = new Map<string, Lesson[]>();
    for (const lesson of sortedLessons) {
      const key = lesson.module || 'chapter';
      if (!moduleMap.has(key)) {
        moduleMap.set(key, []);
      }
      moduleMap.get(key)!.push(lesson);
    }

    const groupedLessons = Array.from(moduleMap.values());
    return Array.from(moduleMap.entries()).map(([module, moduleLessons], index) => {
      const total = moduleLessons.length;
      const completed = moduleLessons.filter((lesson) => completedLessons.includes(lesson.id));
      const completedCount = completed.length;
      const firstPending = moduleLessons.find((lesson) => !completedLessons.includes(lesson.id)) ?? null;
      const openLesson = firstPending ?? moduleLessons[0] ?? null;
      const isCompleted = completedCount === total && total > 0;
      const previousChapter = index > 0 ? groupedLessons[index - 1] : null;
      const previousChapterCompleted = previousChapter
        ? previousChapter.every((lesson) => completedLessons.includes(lesson.id))
        : true;
      const isLocked = !isCompleted && !previousChapterCompleted;
      const firstLesson = moduleLessons[0];

      return {
        id: `chapter-${module}-${index}`,
        module,
        chapterNumber: index + 1,
        lessons: moduleLessons,
        total,
        completedCount,
        isCompleted,
        isLocked,
        openLesson,
        icon: firstLesson?.icon ?? BookOpen,
        color: firstLesson?.color ?? '#60A5FA',
      };
    });
  }, [completedLessons, sortedLessons]);

  const activeChapter = useMemo(
    () => chapterCards.find((chapter) => !chapter.isLocked && !chapter.isCompleted) ?? chapterCards[0] ?? null,
    [chapterCards],
  );

  const isLessonLocked = useCallback(
    (lesson: Lesson) => {
      const previous = sortedLessons
        .filter((item) => item.module === lesson.module && item.order < lesson.order)
        .sort((a, b) => b.order - a.order)[0];
      if (!previous) {
        return false;
      }
      return !completedLessons.includes(previous.id);
    },
    [completedLessons, sortedLessons],
  );

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
              <Text style={styles.chapterHeroKicker}>CHAPTER {activeChapter?.chapterNumber ?? 1}</Text>
              <Text style={styles.chapterHeroTitle}>{activeChapter?.module ?? 'Financial Literacy Quest'}</Text>
              <View style={styles.learningDashboardRow}>
                <View style={styles.dashboardChip}>
                  <Animated.View
                    style={{
                      transform: [
                        {
                          scale: flamePulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.12],
                          }),
                        },
                      ],
                      opacity: flamePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    }}
                  >
                    <Flame size={12} color="#60A5FA" />
                  </Animated.View>
                  <Text style={styles.dashboardChipText}>{gamification?.streakDays ?? 0}</Text>
                </View>
                <View style={styles.dashboardChip}>
                  <Text style={styles.dashboardChipText}>
                    Freeze {gamification?.streakFreezes ?? 3}/{gamification?.maxStreakFreezes ?? 3}
                  </Text>
                </View>
                <View style={styles.dashboardChip}>
                  <Text style={styles.dashboardChipText}>XP {gamification?.xp ?? 0}</Text>
                </View>
              </View>
              <Text style={styles.streakHintText}>{gamification?.streakMessage ?? "Don't forget me today!"}</Text>
              <View style={styles.weekProgressRow}>
                {(gamification?.weeklyProgress ?? []).map((day) => (
                  <View
                    key={day.date}
                    style={[
                      styles.weekProgressDot,
                      day.status === 'done' && styles.weekProgressDotDone,
                      day.status === 'today' && styles.weekProgressDotToday,
                      day.status === 'locked' && styles.weekProgressDotLocked,
                    ]}
                  >
                    <Text style={styles.weekProgressLabel}>{day.label}</Text>
                    <Text style={styles.weekProgressValue}>
                      {day.status === 'done'
                        ? '\u{1F525}'
                        : day.status === 'locked'
                          ? '\u{1F9CA}'
                          : '\u{1F614}'}
                    </Text>
                  </View>
                ))}
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

            {chapterCards.length > 0 && (
              <View style={styles.pathCard}>
                <Text style={styles.pathTitle}>Quest Map</Text>
                {chapterCards.map((chapter, index) => {
                  const Icon = chapter.icon;
                  return (
                    <TouchableOpacity
                      key={chapter.id}
                      style={[styles.pathNodeRow, index % 2 ? styles.pathRowRight : styles.pathRowLeft]}
                      disabled={chapter.isLocked}
                      onPress={() => !chapter.isLocked && setSelectedChapter(chapter)}
                    >
                      <LinearGradient
                        colors={
                          chapter.isCompleted
                            ? ['#1D4ED8', '#1E40AF']
                            : chapter.isLocked
                              ? ['#1F2937', '#111827']
                              : ['#38BDF8', '#2563EB']
                        }
                        style={[
                          styles.pathBubble,
                          chapter.isCompleted && styles.pathBubbleComplete,
                          !chapter.isCompleted && !chapter.isLocked && styles.pathBubbleActive,
                          chapter.isLocked && styles.pathBubbleLocked,
                        ]}
                      >
                        {chapter.isCompleted ? (
                          <CheckCircle size={22} color="#E2E8F0" />
                        ) : chapter.isLocked ? (
                          <Lock size={22} color="#94A3B8" />
                        ) : (
                          <Icon size={22} color="#E0F2FE" />
                        )}
                      </LinearGradient>
                      <View style={styles.pathProgressPill}>
                        <Text style={styles.pathProgressText}>{chapter.completedCount}/{chapter.total}</Text>
                      </View>
                    </TouchableOpacity>
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

      {selectedChapter && (
        <Modal visible={true} animationType="slide" presentationStyle="formSheet">
          <View style={styles.chapterModalContainer}>
            <View style={styles.chapterModalHeader}>
              <TouchableOpacity onPress={() => setSelectedChapter(null)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.chapterModalKicker}>Chapter {selectedChapter.chapterNumber}</Text>
                <Text style={styles.chapterModalTitle}>{selectedChapter.module}</Text>
              </View>
            </View>
            <ScrollView style={styles.chapterModalList} showsVerticalScrollIndicator={false}>
              {selectedChapter.lessons.map((lesson) => {
                const Icon = lesson.icon;
                const isDone = completedLessons.includes(lesson.id);
                const isLocked = isLessonLocked(lesson);
                return (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[styles.chapterLessonRow, isDone && styles.chapterLessonDone, isLocked && styles.chapterLessonLocked]}
                    disabled={isLocked}
                    onPress={() => {
                      setSelectedChapter(null);
                      toggleLesson(lesson);
                    }}
                  >
                    <View style={[styles.chapterLessonIcon, { backgroundColor: lesson.color + '22' }]}>
                      <Icon size={18} color={lesson.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chapterLessonTitle}>{lesson.title}</Text>
                      <Text style={styles.chapterLessonMeta}>
                        {isDone ? 'Completed' : isLocked ? 'Locked' : 'Interactive lesson'}
                      </Text>
                    </View>
                    {isDone ? <CheckCircle size={18} color="#60A5FA" /> : isLocked ? <Lock size={18} color="#64748B" /> : <Play size={18} color="#BFDBFE" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020B18', overflow: "visible" },
  sparkleBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sparkleDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 197, 255, 0.25)',
  },
  sparkleDotSmall: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(125, 211, 252, 0.22)',
  },
  blueHeader: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: "relative",
    zIndex: 20,
  },
  blueHeaderTop: { marginBottom: 16 },
  scrollView: { flex: 1, paddingHorizontal: 20, zIndex: 2 },
  header: { marginBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 32 },
  headerSubtitle: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginTop: 10 },
  sectionTabsWrap: {
    marginTop: 16,
    marginBottom: 18,
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  sectionTab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sectionTabActive: {
    backgroundColor: '#0B3B78',
  },
  sectionTabText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTabTextActive: {
    color: '#fff',
  },

  taxHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  taxHubTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  taxHubSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 18,
  },
  taxBasicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  taxBasicTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  taxBasicSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  taxRatePill: {
    backgroundColor: '#E0ECFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taxRateText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  taxInputLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 6,
  },
  taxInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1E293B',
    marginBottom: 10,
  },
  taxResultCard: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  taxResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taxResultLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  taxResultValue: {
    color: '#0B3B78',
    fontSize: 14,
    fontWeight: '800',
  },
  taxDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginVertical: 8,
  },
  taxBreakdownLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  taxBreakdownValue: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  taxDisclaimerCard: {
    backgroundColor: '#E0ECFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taxDisclaimerText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  learningDashboardCard: {
    backgroundColor: '#DCEEFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#93C5FD',
    padding: 14,
    marginBottom: 12,
  },
  chapterHeroKicker: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  chapterHeroTitle: {
    color: '#0F2E66',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  learningDashboardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dashboardChip: {
    flex: 1,
    backgroundColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dashboardChipText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  streakHintText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  weekProgressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  weekProgressDot: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#0B264A',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    alignItems: 'center',
    paddingVertical: 7,
  },
  weekProgressDotDone: {
    backgroundColor: '#14532D',
    borderColor: '#22C55E',
  },
  weekProgressDotToday: {
    backgroundColor: '#1D4ED8',
    borderColor: '#93C5FD',
  },
  weekProgressDotLocked: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  weekProgressLabel: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  weekProgressValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  continueButton: {
    backgroundColor: '#0E315E',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueButtonText: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '700',
  },
  progressCard: {
    backgroundColor: '#07172C',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: '#1E3A5F',
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
  pathNodeRow: {
    width: 90,
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  pathRowLeft: {
    alignSelf: 'flex-start',
  },
  pathRowRight: {
    alignSelf: 'flex-end',
  },
  pathBubble: {
    width: 68,
    height: 68,
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
  pathProgressPill: {
    backgroundColor: '#0B264A',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pathProgressText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
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
  celebrationOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(8, 30, 64, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  celebrationText: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '800',
  },
  worldCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: '#0B264A',
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  worldTitle: {
    color: '#DBEAFE',
    fontSize: 16,
    fontWeight: '800',
  },
  worldText: {
    color: '#BFDBFE',
    fontSize: 13,
    lineHeight: 20,
  },
  worldMeta: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  worldActionButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
    paddingVertical: 11,
    alignItems: 'center',
  },
  worldActionText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
  },
  chapterModalContainer: {
    flex: 1,
    backgroundColor: '#04152D',
  },
  chapterModalHeader: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chapterModalKicker: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chapterModalTitle: {
    color: '#E0F2FE',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  chapterModalList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chapterLessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: '#0A2244',
    marginBottom: 10,
  },
  chapterLessonDone: {
    borderColor: '#60A5FA',
    backgroundColor: '#0E315E',
  },
  chapterLessonLocked: {
    opacity: 0.6,
  },
  chapterLessonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterLessonTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  chapterLessonMeta: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 2,
  },
  flashcardsWorldContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  quizWorldContainer: {
    paddingTop: 18,
    paddingBottom: 24,
  },
});





