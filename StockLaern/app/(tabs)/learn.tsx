import {
  Award,
  BookOpen,
  CheckCircle,
  ChevronRight,
  ExternalLink,
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
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
    mcqs: (apiLesson.quiz || []).map((question) => ({
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

  return Array.from(new Set(normalized)).slice(0, 6);
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

function FlashcardCarousel({ cards }: { cards: string[] }) {
  const cardWidth = Math.max(260, Dimensions.get('window').width - 64);
  const scrollX = useRef(new Animated.Value(0)).current;

  if (cards.length === 0) {
    return null;
  }

  return (
    <View style={styles.flashcardsSection}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.blockTitle}>Concept Flashcards</Text>
        <Text style={styles.swipeHint}>Swipe</Text>
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
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 1) * (cardWidth + FLASHCARD_GAP),
            index * (cardWidth + FLASHCARD_GAP),
            (index + 1) * (cardWidth + FLASHCARD_GAP),
          ];
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.6, 1, 0.6],
            extrapolate: 'clamp',
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.96, 1, 0.96],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              style={[
                styles.flashcardItem,
                {
                  width: cardWidth,
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            >
              <Text style={styles.flashcardText}>{item}</Text>
            </Animated.View>
          );
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
}: {
  lesson: Lesson;
  onClose: () => void;
  onComplete: (lessonId: string) => Promise<void> | void;
  isCompleted: boolean;
  nextLessonTitle?: string | null;
}) {
  const { accessToken } = useAuth();
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

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
      }>(`/progress/quiz/${lesson.id}`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }, accessToken);

      if (result.passed) {
        await onComplete(lesson.id);
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
  };

  return (
    <Modal visible={true} animationType="slide" presentationStyle="formSheet">
      <View style={styles.modalContainer}>
        {/* Compact Header */}
        <View style={styles.modalHeaderCompact}>
          <View style={styles.modalHeaderTop}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
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

          {/* Content Section */}
          <View style={styles.contentSection}>
            <Text style={styles.contentTitle}>Lesson Content</Text>
            <Text style={styles.contentText}>{lessonIntro}</Text>
          </View>

          <FlashcardCarousel cards={conceptCards} />

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

          {/* Quiz Section */}
          {!showQuiz && !quizCompleted && (
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
                  <Text style={styles.startQuizButtonText}>Start Quiz</Text>
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
              <TouchableOpacity style={styles.retakeButton} onPress={handleStartQuiz}>
                <Text style={styles.retakeButtonText}>Retake Quiz</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.completeSection}>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={async () => {
                await onComplete(lesson.id);
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
      </View>
    </Modal>
  );
}

export default function LearnScreen() {
  const { accessToken, isAuthenticated } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
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

  useEffect(() => {
    if (!accessToken) return;
    loadLessons();
    loadProgress();
  }, [accessToken, loadLessons, loadProgress]);

  const toggleLesson = async (lesson: Lesson) => {
    setSelectedLesson(lesson);
    if (!accessToken) return;
    try {
      await apiFetch(`/progress/start/${lesson.id}`, { method: 'POST' }, accessToken);
    } catch (error) {
      console.warn('Unable to start lesson', error);
    }
  };

  const handleLessonComplete = async (lessonId: string) => {
    if (accessToken) {
      try {
        await apiFetch(`/progress/complete/${lessonId}`, { method: 'POST' }, accessToken);
      } catch (error) {
        console.warn('Unable to complete lesson', error);
      }
    }

    setCompletedLessons((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]));
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
      {/* Dark Blue Header */}
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.blueHeader}
      >
        <View style={styles.blueHeaderTop}>
          <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        </View>
        <Text style={styles.headerTitle}>Beginners Guide</Text>
        <Text style={styles.headerSubtitle}>Learn stock market basics with videos & quizzes</Text>
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
                <Info size={16} color="#6D28D9" />
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
              <Info size={14} color="#6D28D9" />
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', overflow: "visible" },
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
  scrollView: { flex: 1, paddingHorizontal: 20, zIndex: 0 },
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
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taxDisclaimerText: {
    flex: 1,
    color: '#6D28D9',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  progressCard: {
    backgroundColor: '#FAFAF5',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: '#E8E8E3',
  },
  progressTextContainer: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  progressStat: { fontSize: 14, fontWeight: '700', color: '#166534' },
  progressBarBg: { backgroundColor: '#F1F5F9', height: 10, borderRadius: 5 },
  progressBarFill: { backgroundColor: '#166534', height: 10, borderRadius: 5 },
  levelCompleteText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 16, marginTop: 8 },

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

  tipCard: { backgroundColor: '#F3E8FF', padding: 16, borderRadius: 16, marginTop: 10, borderWidth: 1, borderColor: '#D8B4FE' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#6D28D9', marginLeft: 8 },
  tipText: { fontSize: 13, color: '#6D28D9', lineHeight: 18, marginTop: 4 },

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
    color: '#5E22AD',
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
    color: '#415A80',
    fontWeight: '700',
  },
  flashcardList: {
    paddingRight: 12,
  },
  flashcardItem: {
    backgroundColor: '#E9F2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B5C8E6',
    padding: 16,
    marginRight: FLASHCARD_GAP,
    minHeight: 132,
    justifyContent: 'center',
  },
  flashcardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5E22AD',
    marginBottom: 8,
  },
  flashcardText: {
    fontSize: 15,
    color: '#123B77',
    lineHeight: 22,
    fontWeight: '600',
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
    backgroundColor: '#7B2BD9',
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
    backgroundColor: '#5E22AD',
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
  quizSectionSubText: { fontSize: 12, color: '#5E22AD', marginBottom: 10, fontWeight: '600' },
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
    backgroundColor: '#7B2BD9',
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
    borderColor: '#8A2BE2',
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
    borderLeftColor: '#8A2BE2',
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
    backgroundColor: '#7B2BD9',
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
});

