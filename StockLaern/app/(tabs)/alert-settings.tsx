import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useAuth } from "../context/AuthContext";
import { useDataServer } from "../context/DataServerContext";
import { checkAlertThreshold, type AlertRecommendation } from "../lib/dataServer";

type AlertTemplateKey = "volume" | "jump" | "drop" | "trend";
type NotificationChannel = "inApp" | "email" | "push";
type ActiveHours = "24/7" | "Market Hours" | "Custom Window";

type AlertTemplate = {
  key: AlertTemplateKey;
  title: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  metaLeft: string;
  metaRight: string;
  defaultInput: number;
};

type ActiveAlertItem = {
  id: string;
  symbol: string;
  title: string;
  thresholdLabel: string;
  status: "active" | "paused";
  icon: string;
  color: string;
  channels: string;
  activeHours: ActiveHours;
};

type LessonCard = {
  symbol: string;
  company: string;
  title: string;
  scenario: string;
  lesson: string;
  action: string;
  icon: string;
  color: string;
  bg: string;
  changePct: number;
};

const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    key: "volume",
    title: "Volume Spike Alert",
    desc: "Get notified when trading volume exceeds average by a threshold.",
    icon: "bar-chart-2",
    color: "#3B82F6",
    bg: "#DBEAFE",
    metaLeft: "Threshold 150%",
    metaRight: "Timeframe 1 hour",
    defaultInput: 150,
  },
  {
    key: "jump",
    title: "Price Jump Alert",
    desc: "Alert when stock price increases by a selected percentage.",
    icon: "trending-up",
    color: "#22C55E",
    bg: "#DCFCE7",
    metaLeft: "Threshold 3%",
    metaRight: "Timeframe realtime",
    defaultInput: 3,
  },
  {
    key: "drop",
    title: "Price Drop Alert",
    desc: "Alert when stock price decreases by a selected percentage.",
    icon: "trending-down",
    color: "#EF4444",
    bg: "#FEE2E2",
    metaLeft: "Threshold 3%",
    metaRight: "Timeframe realtime",
    defaultInput: 3,
  },
  {
    key: "trend",
    title: "Trend Change Alert",
    desc: "Detect probable bullish or bearish trend reversal conditions.",
    icon: "activity",
    color: "#A855F7",
    bg: "#EDE9FE",
    metaLeft: "Sensitivity medium",
    metaRight: "Timeframe 24 hours",
    defaultInput: 2,
  },
];

const FALLBACK_SAMPLE_SYMBOLS = [
  "NABIL",
  "NLIC",
  "SCB",
  "UPPER",
  "HDL",
  "NHPC",
  "SBI",
  "EBL",
  "HIDCL",
  "NTC",
  "CHCL",
  "SHPC",
];

const SAMPLE_STOCK_NAMES: Record<string, string> = {
  NABIL: "Nabil Bank",
  NLIC: "Nepal Life Insurance",
  SCB: "Standard Chartered Bank",
  UPPER: "Upper Tamakoshi",
  HDL: "Himalayan Distillery",
  NHPC: "National Hydro Power",
  SBI: "Nepal SBI Bank",
  EBL: "Everest Bank",
  HIDCL: "Hydroelectricity Investment",
  NTC: "Nepal Telecom",
  CHCL: "Chilime Hydropower",
  SHPC: "Sanima Hydropower",
};

const LESSON_COPY: Record<AlertTemplateKey, { scenario: string; lesson: string; action: string }> = {
  volume: {
    scenario: "Unusual volume activity",
    lesson: "Volume spikes can signal news or momentum, but confirm with price behavior before reacting.",
    action: "Check volume against recent sessions and wait for confirmation candle direction.",
  },
  jump: {
    scenario: "Fast upside move",
    lesson: "A sharp jump can continue or fade quickly, so avoid chasing without a plan.",
    action: "Use stop-loss discipline and split entries instead of all-in execution.",
  },
  drop: {
    scenario: "Fast downside move",
    lesson: "Price drops often trigger emotional decisions; risk management matters most here.",
    action: "Reduce position size, review support zones, and avoid revenge trading.",
  },
  trend: {
    scenario: "Possible trend transition",
    lesson: "Mixed signals are common around trend changes, so patience is part of strategy.",
    action: "Track 2-3 sessions before taking directional bias and keep risk small.",
  },
};

const BEST_PRACTICES = [
  "Set realistic thresholds using historical behavior of each stock.",
  "Combine price and volume alerts for better context.",
  "Review alert settings weekly based on market volatility.",
  "Avoid excessive alerts to prevent notification fatigue.",
];

const EDUCATIONAL_WARNING =
  "Educational purpose only: alerts, AI recommendations, and lessons in this screen are for learning workflows and simulation practice. They are not financial advice, not a buy or sell signal, and should not be used as the sole basis for investment decisions.";

const ACTIVE_HOURS_OPTIONS: ActiveHours[] = ["24/7", "Market Hours", "Custom Window"];

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inApp: "In-App",
  email: "Email",
  push: "Push",
};

function dedupeSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const symbol of symbols) {
    if (!symbol || seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);
    output.push(symbol);
  }
  return output;
}

function normalizeSymbol(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function formatThresholdLabel(template: AlertTemplate, value: number): string {
  if (template.key === "volume") {
    return `${value}%`;
  }
  if (template.key === "trend") {
    return `Sensitivity ${value}`;
  }
  return `${value}%`;
}

function buildThresholdPayload(template: AlertTemplate, value: number) {
  if (template.key === "volume") {
    return {
      price_threshold_pct: 5,
      volume_threshold_multiplier: Math.max(1.1, value / 100),
    };
  }

  if (template.key === "trend") {
    return {
      price_threshold_pct: Math.max(1, value),
      volume_threshold_multiplier: 2,
    };
  }

  return {
    price_threshold_pct: Math.max(0.5, value),
    volume_threshold_multiplier: 5,
  };
}

function resolveTemplateFromThreshold(threshold: {
  price_threshold_pct?: number;
  volume_threshold_multiplier?: number;
}): AlertTemplate {
  const price = Number(threshold.price_threshold_pct ?? 0);
  const volume = Number(threshold.volume_threshold_multiplier ?? 0);

  if (volume > 0 && volume <= 2.5) {
    return ALERT_TEMPLATES[0];
  }
  if (price > 0 && price <= 2) {
    return ALERT_TEMPLATES[3];
  }
  if (price > 0) {
    return ALERT_TEMPLATES[1];
  }
  return ALERT_TEMPLATES[0];
}

export default function AlertSettingsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const {
    alerts,
    isConnected,
    setAlertThreshold,
    stocks,
    ticks,
    subscribe,
    unsubscribe,
    addAlertEvent,
    loadSubscriptions,
    thresholds,
  } = useDataServer();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<AlertTemplateKey>("volume");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [thresholdInput, setThresholdInput] = useState(String(ALERT_TEMPLATES[0].defaultInput));
  const [activeHours, setActiveHours] = useState<ActiveHours>("24/7");
  const [channelState, setChannelState] = useState<Record<NotificationChannel, boolean>>({
    inApp: true,
    email: false,
    push: true,
  });
  const [latestRecommendation, setLatestRecommendation] = useState<AlertRecommendation | null>(null);
  const [checkingRecommendation, setCheckingRecommendation] = useState(false);

  const selectedTemplate = useMemo(
    () => ALERT_TEMPLATES.find((item) => item.key === selectedTemplateKey) ?? ALERT_TEMPLATES[0],
    [selectedTemplateKey],
  );

  const sampleSymbols = useMemo(() => {
    const fromServer = stocks
      .map((stock) => normalizeSymbol(stock?.symbol))
      .filter((symbol) => Boolean(symbol));
    return dedupeSymbols([...fromServer, ...FALLBACK_SAMPLE_SYMBOLS]).slice(0, 12);
  }, [stocks]);

  const sampleSymbolsKey = sampleSymbols.join(",");
  const activeAlertSymbols = useMemo(
    () => dedupeSymbols(thresholds.map((item) => normalizeSymbol(item.symbol))),
    [thresholds],
  );

  useEffect(() => {
    setThresholdInput(String(selectedTemplate.defaultInput));
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedSymbol && sampleSymbols.length > 0) {
      setSelectedSymbol(sampleSymbols[0]);
    }
  }, [selectedSymbol, sampleSymbols]);

  useEffect(() => {
    if (!accessToken || sampleSymbols.length === 0) {
      return;
    }
    subscribe(sampleSymbols);
    return () => {
      unsubscribe(sampleSymbols);
    };
  }, [accessToken, sampleSymbolsKey, sampleSymbols, subscribe, unsubscribe]);

  useEffect(() => {
    if (!accessToken || !isConnected) {
      return;
    }
    loadSubscriptions(accessToken);
  }, [accessToken, isConnected, loadSubscriptions]);

  const stockLookup = useMemo(() => {
    const map: Record<string, any> = {};
    for (const stock of stocks) {
      const symbol = normalizeSymbol(stock?.symbol);
      if (symbol) {
        map[symbol] = stock;
      }
    }
    return map;
  }, [stocks]);

  const lessons = useMemo<LessonCard[]>(() => {
    const snapshots = activeAlertSymbols.map((symbol) => {
      const stockFromList = stockLookup[symbol] ?? {};
      const liveTick = ticks[symbol] ?? {};

      return {
        symbol,
        company: String(stockFromList.name ?? SAMPLE_STOCK_NAMES[symbol] ?? symbol),
        changePct: Number(liveTick.change_pct ?? stockFromList.change_pct ?? 0),
        volume: Number(liveTick.volume ?? stockFromList.volume ?? 0),
      };
    });

    if (snapshots.length === 0) {
      return [];
    }

    const volumeSeries = snapshots
      .map((item) => item.volume)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);

    const cutoffIndex = Math.max(0, Math.floor(volumeSeries.length * 0.75) - 1);
    const highVolumeCutoff = volumeSeries.length > 0 ? volumeSeries[cutoffIndex] : 0;

    return snapshots.map((item) => {
      let scenarioKey: AlertTemplateKey = "trend";

      if (item.changePct >= 3) {
        scenarioKey = "jump";
      } else if (item.changePct <= -3) {
        scenarioKey = "drop";
      } else if (highVolumeCutoff > 0 && item.volume >= highVolumeCutoff) {
        scenarioKey = "volume";
      }

      const template = ALERT_TEMPLATES.find((entry) => entry.key === scenarioKey) ?? ALERT_TEMPLATES[3];
      const scenarioCopy = LESSON_COPY[scenarioKey];

      return {
        symbol: item.symbol,
        company: item.company,
        title: template.title,
        scenario: scenarioCopy.scenario,
        lesson: scenarioCopy.lesson,
        action: scenarioCopy.action,
        icon: template.icon,
        color: template.color,
        bg: template.bg,
        changePct: item.changePct,
      };
    });
  }, [activeAlertSymbols, stockLookup, ticks]);

  const activeAlerts = useMemo<ActiveAlertItem[]>(
    () =>
      thresholds.map((threshold, index) => {
        const symbol = normalizeSymbol(threshold.symbol);
        const template = resolveTemplateFromThreshold(threshold);
        const thresholdValue =
          template.key === "volume"
            ? Number(threshold.volume_threshold_multiplier ?? 2) * 100
            : Number(threshold.price_threshold_pct ?? 3);

        return {
          id: `${symbol}-${index}`,
          symbol,
          title: template.title,
          thresholdLabel: formatThresholdLabel(template, thresholdValue),
          status: "active",
          icon: template.icon,
          color: template.color,
          channels: "In-App",
          activeHours: "24/7",
        };
      }),
    [thresholds],
  );

  const recentNotifications = useMemo(() => alerts.slice(0, 8), [alerts]);

  const toggleChannel = (channel: NotificationChannel) => {
    setChannelState((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const resetForm = () => {
    setThresholdInput(String(selectedTemplate.defaultInput));
    setActiveHours("24/7");
    setChannelState({ inApp: true, email: false, push: true });
  };

  const handleCreateAlert = async () => {
    if (!accessToken) {
      Alert.alert("Login required", "Please log in to configure alerts.");
      router.push("/login");
      return;
    }

    const symbol = normalizeSymbol(selectedSymbol);
    if (!symbol) {
      Alert.alert("Missing symbol", "Select a stock symbol before creating an alert.");
      return;
    }

    const thresholdValue = Number(thresholdInput);
    if (!Number.isFinite(thresholdValue) || thresholdValue <= 0) {
      Alert.alert("Invalid threshold", "Enter a valid positive threshold value.");
      return;
    }

    const payload = buildThresholdPayload(selectedTemplate, thresholdValue);
    setCheckingRecommendation(true);

    try {
      setAlertThreshold({
        user_id: accessToken,
        symbol,
        ...payload,
      });

      const checkResult = await checkAlertThreshold({
        symbol,
        ...payload,
      });

      setLatestRecommendation(checkResult.recommendation ?? null);

      if (Array.isArray(checkResult.alerts) && checkResult.alerts.length > 0) {
        checkResult.alerts.forEach((item) => {
          addAlertEvent({
            user_id: accessToken,
            alert: {
              ...item,
              message: item.message || `${item.symbol} ${item.alert_type} threshold crossed.`,
            },
          });
        });
      }

      const immediateSignal =
        checkResult.alert_count > 0
          ? `${checkResult.alert_count} condition(s) are already triggered.`
          : "No immediate trigger found in current tick.";

      Alert.alert("Alert Created", `${selectedTemplate.title} for ${symbol} is active. ${immediateSignal}`);
    } catch {
      Alert.alert(
        "Alert Created",
        `${selectedTemplate.title} for ${symbol} was saved. AI check is temporarily unavailable.`,
      );
    } finally {
      setCheckingRecommendation(false);
    }
  };

  const recommendationConfidence = latestRecommendation
    ? Math.round(Math.max(0, Math.min(1, latestRecommendation.confidence)) * 100)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={["#312E81", "#4338CA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        <Text style={styles.heroTitle}>Smart Alert Center</Text>
        <Text style={styles.heroSubtitle}>
          Configure alert templates and get lessons only for your active alerts.
        </Text>
        <View style={styles.connectionBadge}>
          <View
            style={[
              styles.connectionDot,
              isConnected ? styles.connectionDotConnected : styles.connectionDotDisconnected,
            ]}
          />
          <Text style={styles.connectionText}>
            {isConnected ? "Connected to Data Server" : "Disconnected from Data Server"}
          </Text>
        </View>
      </LinearGradient>

      {!accessToken && (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>Login Required</Text>
          <Text style={styles.gateText}>
            Alert creation and personalized lessons are available only after login.
          </Text>
          <TouchableOpacity style={styles.gateButton} onPress={() => router.push("/login")}>
            <Text style={styles.gateButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {accessToken && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Smart Alert Types</Text>
            <Text style={styles.sectionSubtitle}>
              Choose a template and configure one alert at a time with clear thresholds.
            </Text>
            <View style={styles.templateGrid}>
              {ALERT_TEMPLATES.map((template) => {
                const isSelected = selectedTemplate.key === template.key;
                return (
                  <View
                    key={template.key}
                    style={[styles.templateCard, isSelected ? styles.templateCardSelected : null]}
                  >
                    <View style={styles.templateHeader}>
                      <View style={[styles.templateIcon, { backgroundColor: template.bg }]}>
                        <Feather name={template.icon as any} size={18} color={template.color} />
                      </View>
                      <View style={styles.templateHeaderTextWrap}>
                        <Text style={styles.templateTitle}>{template.title}</Text>
                        <Text style={styles.templateDesc}>{template.desc}</Text>
                      </View>
                    </View>

                    <View style={styles.templateMetaRow}>
                      <Text style={styles.templateMetaText}>{template.metaLeft}</Text>
                      <Text style={styles.templateMetaText}>{template.metaRight}</Text>
                    </View>

                    <TouchableOpacity onPress={() => setSelectedTemplateKey(template.key)}>
                      <LinearGradient
                        colors={isSelected ? ["#3730A3", "#5B21B6"] : ["#4338CA", "#6D28D9"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.templateButton}
                      >
                        <Feather name={isSelected ? "check" : "plus"} size={16} color="#FFFFFF" />
                        <Text style={styles.templateButtonText}>
                          {isSelected ? "Template Selected" : "Create Alert"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create New Alert - {selectedTemplate.title}</Text>

              <Text style={styles.fieldLabel}>Select Stock</Text>
              <TextInput
                value={selectedSymbol}
                onChangeText={(value) => setSelectedSymbol(normalizeSymbol(value))}
                placeholder="Choose a stock symbol"
                autoCapitalize="characters"
                style={styles.input}
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.symbolChipRow}>
                {sampleSymbols.map((symbol) => {
                  const selected = symbol === selectedSymbol;
                  return (
                    <TouchableOpacity
                      key={symbol}
                      onPress={() => setSelectedSymbol(symbol)}
                      style={[styles.symbolChip, selected ? styles.symbolChipSelected : null]}
                    >
                      <Text style={[styles.symbolChipText, selected ? styles.symbolChipTextSelected : null]}>
                        {symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                {selectedTemplate.key === "volume"
                  ? "Volume Threshold (%)"
                  : selectedTemplate.key === "trend"
                    ? "Trend Sensitivity"
                    : "Price Threshold (%)"}
              </Text>
              <TextInput
                value={thresholdInput}
                onChangeText={setThresholdInput}
                placeholder={`e.g. ${selectedTemplate.defaultInput}`}
                keyboardType="numeric"
                style={styles.input}
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Notification Method</Text>
              <View style={styles.channelRow}>
                {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((channel) => {
                  const enabled = channelState[channel];
                  return (
                    <TouchableOpacity
                      key={channel}
                      onPress={() => toggleChannel(channel)}
                      style={[styles.channelButton, enabled ? styles.channelButtonEnabled : null]}
                    >
                      <Feather
                        name={enabled ? "check-square" : "square"}
                        size={16}
                        color={enabled ? "#7E22CE" : "#64748B"}
                      />
                      <Text style={styles.channelButtonText}>{CHANNEL_LABELS[channel]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Active Hours</Text>
              <View style={styles.hoursRow}>
                {ACTIVE_HOURS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.hoursChip, activeHours === option ? styles.hoursChipSelected : null]}
                    onPress={() => setActiveHours(option)}
                  >
                    <Text
                      style={[styles.hoursChipText, activeHours === option ? styles.hoursChipTextSelected : null]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.primaryAction} onPress={handleCreateAlert}>
                  <LinearGradient
                    colors={["#3730A3", "#5B21B6"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.primaryActionGradient}
                  >
                    <Text style={styles.primaryActionText}>
                      {checkingRecommendation ? "Creating Alert..." : "Create Alert"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryAction} onPress={resetForm}>
                  <Text style={styles.secondaryActionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.blockCard}>
              <View style={styles.blockHeader}>
                <Text style={styles.blockTitle}>My Active Alerts</Text>
                <Text style={styles.blockCount}>{activeAlerts.length} alerts</Text>
              </View>

              {activeAlerts.length === 0 ? (
                <Text style={styles.emptyText}>
                  No active alerts yet. Create your first alert from the selected template above.
                </Text>
              ) : (
                activeAlerts.map((item) => (
                  <View key={item.id} style={styles.activeAlertRow}>
                    <View style={[styles.activeIcon, { backgroundColor: `${item.color}22` }]}>
                      <Feather name={item.icon as any} size={16} color={item.color} />
                    </View>
                    <View style={styles.activeContent}>
                      <Text style={styles.activeSymbol}>{item.symbol}</Text>
                      <Text style={styles.activeMeta}>{item.title}</Text>
                      <Text style={styles.activeMeta}>
                        {item.thresholdLabel} | {item.channels} | {item.activeHours}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusChip,
                        item.status === "active" ? styles.statusChipActive : styles.statusChipPaused,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.status === "active" ? styles.statusTextActive : styles.statusTextPaused,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          {(checkingRecommendation || latestRecommendation) && (
            <View style={styles.section}>
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationTitle}>AI/ML Alert Recommendation</Text>
                {checkingRecommendation ? (
                  <Text style={styles.recommendationMeta}>Analyzing latest tick data...</Text>
                ) : null}
                {latestRecommendation ? (
                  <>
                    <Text style={styles.recommendationAction}>
                      Action: {String(latestRecommendation.action).toUpperCase()} | Confidence: {recommendationConfidence}%
                    </Text>
                    <Text style={styles.recommendationMeta}>
                      Risk: {String(latestRecommendation.risk_level).toUpperCase()} | Score: {latestRecommendation.score.toFixed(2)}
                    </Text>
                    {latestRecommendation.reasons.map((reason, index) => (
                      <Text key={`${reason}-${index}`} style={styles.recommendationReason}>
                        - {reason}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.bestPracticeCard}>
              <Text style={styles.blockTitle}>Alert Best Practices</Text>
              {BEST_PRACTICES.map((item) => (
                <Text key={item} style={styles.bestPracticeText}>
                  - {item}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.blockCard}>
              <Text style={styles.blockTitle}>Short Lessons for Active Alerts</Text>
              <Text style={styles.sectionSubtitle}>
                Lessons are generated only for symbols currently in your active alert list.
              </Text>

              {lessons.length === 0 ? (
                <Text style={styles.emptyText}>
                  No active alerts yet. Add an alert above to unlock contextual lessons here.
                </Text>
              ) : (
                lessons.map((lesson) => (
                  <View key={lesson.symbol} style={styles.lessonRow}>
                    <View style={[styles.lessonIcon, { backgroundColor: lesson.bg }]}>
                      <Feather name={lesson.icon as any} size={16} color={lesson.color} />
                    </View>
                    <View style={styles.lessonContent}>
                      <View style={styles.lessonHeaderRow}>
                        <Text style={styles.lessonSymbol}>{lesson.symbol}</Text>
                        <Text
                          style={[
                            styles.lessonChange,
                            lesson.changePct > 0
                              ? styles.lessonChangePositive
                              : lesson.changePct < 0
                                ? styles.lessonChangeNegative
                                : styles.lessonChangeFlat,
                          ]}
                        >
                          {lesson.changePct >= 0 ? "+" : ""}
                          {lesson.changePct.toFixed(2)}%
                        </Text>
                      </View>
                      <Text style={styles.lessonCompany}>{lesson.company}</Text>
                      <Text style={styles.lessonTitle}>{lesson.title}</Text>
                      <Text style={styles.lessonText}>Situation: {lesson.scenario}</Text>
                      <Text style={styles.lessonText}>Lesson: {lesson.lesson}</Text>
                      <Text style={styles.lessonAction}>How to handle: {lesson.action}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.blockCard}>
              <Text style={styles.blockTitle}>Recent Notifications</Text>

              {recentNotifications.length === 0 ? (
                <Text style={styles.emptyText}>
                  No triggered notifications yet. Alerts will appear here as live conditions are met.
                </Text>
              ) : (
                recentNotifications.map((item, index) => (
                  <View key={`${item.alert?.symbol}-${index}`} style={styles.notificationRow}>
                    <View style={styles.notificationDot} />
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle}>
                        {item.alert?.symbol} {item.alert?.alert_type} alert
                      </Text>
                      <Text style={styles.notificationText}>{item.alert?.message}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#94A3B8" />
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Educational Purpose Only</Text>
              <Text style={styles.warningText}>{EDUCATIONAL_WARNING}</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EFF8",
  },
  contentContainer: {
    paddingBottom: 44,
  },
  hero: {
    paddingTop: 90,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 12,
  },
  heroSubtitle: {
    color: "#DFE8FF",
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  connectionBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionDotConnected: {
    backgroundColor: "#22C55E",
  },
  connectionDotDisconnected: {
    backgroundColor: "#EF4444",
  },
  connectionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 18,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 14,
    lineHeight: 18,
  },
  gateCard: {
    marginHorizontal: 18,
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  gateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  gateText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  gateButton: {
    marginTop: 14,
    backgroundColor: "#0B3B78",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  gateButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  templateGrid: {
    marginTop: 4,
  },
  templateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  templateCardSelected: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  templateHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  templateHeaderTextWrap: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  templateDesc: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
    lineHeight: 17,
  },
  templateMetaRow: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#F4EFFA",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  templateMetaText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  templateButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  templateButtonText: {
    marginLeft: 8,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#A5B4FC",
    padding: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 10,
  },
  symbolChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  symbolChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    marginBottom: 8,
  },
  symbolChipSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  symbolChipText: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
  },
  symbolChipTextSelected: {
    color: "#3730A3",
  },
  channelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  channelButton: {
    minWidth: 100,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  channelButtonEnabled: {
    borderColor: "#A5B4FC",
    backgroundColor: "#EEF2FF",
  },
  channelButtonText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  hoursRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  hoursChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    marginBottom: 8,
  },
  hoursChipSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#A5B4FC",
  },
  hoursChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  hoursChipTextSelected: {
    color: "#3730A3",
  },
  formFooter: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryAction: {
    flex: 1,
    marginRight: 10,
  },
  primaryActionGradient: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryAction: {
    width: 88,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryActionText: {
    color: "#475569",
    fontWeight: "700",
  },
  blockCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 20,
    color: "#0F172A",
    fontWeight: "700",
  },
  blockCount: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  activeAlertRow: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#FBFAFF",
  },
  activeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  activeContent: {
    flex: 1,
  },
  activeSymbol: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14,
  },
  activeMeta: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipActive: {
    backgroundColor: "#DCFCE7",
  },
  statusChipPaused: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontWeight: "700",
    fontSize: 11,
  },
  statusTextActive: {
    color: "#15803D",
  },
  statusTextPaused: {
    color: "#B91C1C",
  },
  recommendationCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 16,
  },
  recommendationTitle: {
    color: "#1E1B4B",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  recommendationAction: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  recommendationMeta: {
    color: "#334155",
    fontSize: 12,
    marginBottom: 6,
  },
  recommendationReason: {
    color: "#475569",
    fontSize: 12,
    marginBottom: 4,
  },
  bestPracticeCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 16,
  },
  bestPracticeText: {
    fontSize: 14,
    color: "#1E3A8A",
    marginBottom: 8,
    lineHeight: 19,
  },
  lessonRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    backgroundColor: "#FCFCFF",
  },
  lessonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  lessonContent: {
    flex: 1,
  },
  lessonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lessonSymbol: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  lessonChange: {
    fontSize: 12,
    fontWeight: "700",
  },
  lessonChangePositive: {
    color: "#15803D",
  },
  lessonChangeNegative: {
    color: "#B91C1C",
  },
  lessonChangeFlat: {
    color: "#475569",
  },
  lessonCompany: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
  },
  lessonTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  lessonText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  lessonAction: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: "#334155",
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 10,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8B5CF6",
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  notificationText: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
  },
  warningCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 18,
    padding: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9A3412",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7C2D12",
  },
});
