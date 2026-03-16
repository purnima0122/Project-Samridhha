import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-chart-kit";
import HeaderBar from "../components/HeaderBar";
import { apiFetch } from "../lib/api";

// ─── Dimensions ───────────────────────────────────────────────────────────────
// Use a slightly narrower chart so value labels never get clipped on small phones
const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 16; // horizontal page padding
const CARD_INNER = 14; // card inner padding
const CHART_W = SCREEN_W - H_PAD * 2 - CARD_INNER * 2; // safe chart width

// ─── Types ────────────────────────────────────────────────────────────────────
type WardStat = { wardNumber: number; userCount: number };
type LiteracyTopicStat = { topic: string; avgScore: number };
type WardCoverageResponse = {
    metadata?: {
        province?: string; district?: string; municipality?: string;
        from?: string; to?: string; totalUsers?: number; generatedAt?: string;
    };
    wards: WardStat[];
    literacyTopics?: LiteracyTopicStat[];
};

// ─── Fallback data ────────────────────────────────────────────────────────────
const FALLBACK_WARDS: WardStat[] = [
    { wardNumber: 1, userCount: 120 },
    { wardNumber: 2, userCount: 80 },
    { wardNumber: 3, userCount: 250 },
    { wardNumber: 4, userCount: 60 },
    { wardNumber: 5, userCount: 90 },
];
const FALLBACK_LITERACY: LiteracyTopicStat[] = [
    { topic: "Risk & Volatility", avgScore: 52 },
    { topic: "Diversification", avgScore: 61 },
    { topic: "Long-term Investing", avgScore: 74 },
    { topic: "Reading Alerts", avgScore: 49 },
    { topic: "Basic Instruments", avgScore: 68 },
];
const LITERACY_SHORT: Record<string, string> = {
    "Risk & Volatility": "Risk",
    "Diversification": "Divers.",
    "Long-term Investing": "L-Term",
    "Reading Alerts": "Alerts",
    "Basic Instruments": "Basics",
};

// ─── Color palette ────────────────────────────────────────────────────────────
// Extra-bright, saturated colors so each bar pops clearly against white
const PALETTE = ["#2563EB", "#22C55E", "#F97316", "#EC4899", "#E11D48", "#A855F7"];

// Literacy score → semantic color
function scoreColor(n: number) {
    if (n < 55) return "#EF4444";
    if (n < 70) return "#F59E0B";
    return "#10B981";
}
function scoreLabel(n: number) {
    if (n < 55) return "Needs Focus";
    if (n < 70) return "Improving";
    return "Strong";
}

// ─── Chart configs ────────────────────────────────────────────────────────────
// White background so labels are always readable
const BAR_CFG = {
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    barPercentage: 0.6,
    // fallback color (overridden per-bar via datasets.colors + flatColor)
    color: (o = 1) => `rgba(37,99,235,${o})`,
    // Dark label color for maximum contrast on white bg
    labelColor: () => "#1E293B",
    // bright blue base if dataset-specific colors are not applied
    fillShadowGradient: "#2563EB",
    fillShadowGradientOpacity: 1,
    style: { borderRadius: 12 },
    propsForBackgroundLines: {
        // Completely invisible — no dashes, no lines
        strokeWidth: 0,
        stroke: "transparent",
    },
    propsForLabels: {
        fontSize: 11,
        fontWeight: "700",
    },
};

const PIE_CFG = {
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    color: (o = 1) => `rgba(79,70,229,${o})`,
    labelColor: () => "#1E293B",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pill toggle: Bar | Pie */
function ChartToggle({
    value,
    onChange,
}: {
    value: "bar" | "pie";
    onChange: (v: "bar" | "pie") => void;
}) {
    return (
        <View style={tog.wrap}>
            {(["bar", "pie"] as const).map((opt) => {
                const active = value === opt;
                return (
                    <TouchableOpacity
                        key={opt}
                        activeOpacity={0.85}
                        onPress={() => onChange(opt)}
                        style={[tog.btn, active && tog.btnOn]}
                    >
                        <Feather
                            name={opt === "bar" ? "bar-chart-2" : "pie-chart"}
                            size={12}
                            color={active ? "#FFFFFF" : "#64748B"}
                        />
                        <Text style={[tog.txt, active && tog.txtOn]}>
                            {opt === "bar" ? "Bar" : "Pie"}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
const tog = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        backgroundColor: "#F1F5F9",
        borderRadius: 99,
        padding: 3,
    },
    btn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 99,
    },
    btnOn: { backgroundColor: "#4F46E5" },
    txt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    txtOn: { color: "#FFFFFF" },
});

/** Colored KPI tile */
function KpiTile({
    icon,
    label,
    value,
    accent,
}: {
    icon: string;
    label: string;
    value: string;
    accent: string;
}) {
    return (
        <View style={[kpi.tile, { borderColor: accent + "40" }]}>
            <View style={[kpi.iconRing, { backgroundColor: accent + "1A" }]}>
                <Feather name={icon as any} size={15} color={accent} />
            </View>
            <Text style={[kpi.val, { color: accent }]}>{value}</Text>
            <Text style={kpi.lbl}>{label}</Text>
        </View>
    );
}
const kpi = StyleSheet.create({
    tile: {
        flex: 1,
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderWidth: 1.5,
        marginHorizontal: 4,
        // subtle shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 3,
    },
    iconRing: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    val: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
    lbl: {
        fontSize: 10,
        fontWeight: "600",
        color: "#94A3B8",
        marginTop: 2,
        textAlign: "center",
    },
});

/** Card wrapper */
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
    return <View style={[cd.card, style]}>{children}</View>;
}
const cd = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: CARD_INNER,
        marginBottom: 16,
        shadowColor: "#1E293B",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 5,
    },
});

/** Card section header row */
function CardHeader({
    title,
    desc,
    accentColor,
    chartType,
    onToggle,
}: {
    title: string;
    desc: string;
    accentColor: string;
    chartType: "bar" | "pie";
    onToggle: (v: "bar" | "pie") => void;
}) {
    return (
        <View style={ch.wrap}>
            {/* Left: accent bar + text */}
            <View style={ch.left}>
                <View style={[ch.accent, { backgroundColor: accentColor }]} />
                <View style={{ flex: 1 }}>
                    <Text style={ch.title}>{title}</Text>
                    <Text style={ch.desc} numberOfLines={2}>{desc}</Text>
                </View>
            </View>
            {/* Right: toggle */}
            <ChartToggle value={chartType} onChange={onToggle} />
        </View>
    );
}
const ch = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 14,
    },
    left: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
    accent: { width: 4, borderRadius: 99, height: "100%", minHeight: 36 },
    title: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    desc: { fontSize: 11, color: "#94A3B8", lineHeight: 16 },
});

/** Tip row inside info card */
function Tip({
    icon,
    text,
    iconBg,
    iconColor,
}: {
    icon: string;
    text: string;
    iconBg: string;
    iconColor: string;
}) {
    return (
        <View style={tp.row}>
            <View style={[tp.icon, { backgroundColor: iconBg }]}>
                <Feather name={icon as any} size={12} color={iconColor} />
            </View>
            <Text style={tp.text}>{text}</Text>
        </View>
    );
}
const tp = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    icon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
    },
    text: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RegulatorScreen() {
    const [wards, setWards] = useState<WardStat[]>([]);
    const [totalUsers, setTotalUsers] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [literacy, setLiteracy] = useState<LiteracyTopicStat[]>(FALLBACK_LITERACY);
    const [wardChart, setWardChart] = useState<"bar" | "pie">("bar");
    const [litChart, setLitChart] = useState<"bar" | "pie">("bar");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await apiFetch<WardCoverageResponse>("/regulator/ward-coverage");
                if (!alive) return;
                if (!res || !Array.isArray(res.wards) || res.wards.length === 0) {
                    setWards(FALLBACK_WARDS);
                    setTotalUsers(FALLBACK_WARDS.reduce((s, w) => s + w.userCount, 0));
                } else {
                    setWards(res.wards);
                    setTotalUsers(
                        res.metadata?.totalUsers ?? res.wards.reduce((s, w) => s + w.userCount, 0)
                    );
                    if (res.literacyTopics?.length) setLiteracy(res.literacyTopics);
                }
            } catch {
                if (!alive) return;
                setError("Showing sample data — live data unavailable.");
                setWards(FALLBACK_WARDS);
                setTotalUsers(FALLBACK_WARDS.reduce((s, w) => s + w.userCount, 0));
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    // ── Derived stats ──
    const avgLit = literacy.length
        ? Math.round(literacy.reduce((s, t) => s + t.avgScore, 0) / literacy.length)
        : 0;
    const weakCount = literacy.filter((t) => t.avgScore < 60).length;
    const topWard = wards.length
        ? wards.reduce((a, b) => (a.userCount > b.userCount ? a : b))
        : null;

    // ── Ward chart data ──
    const wardBarData = {
        labels: wards.map((w) => `W${w.wardNumber}`),
        datasets: [{
            data: wards.map((w) => w.userCount || 0),
            // One vivid color per bar — rendered via flatColor prop
            colors: wards.map((_, i) => () => PALETTE[i % PALETTE.length]),
        }],
    };
    const wardPieData = wards.map((w, i) => ({
        name: `Ward ${w.wardNumber}`,
        population: w.userCount,
        color: PALETTE[i % PALETTE.length],
        legendFontColor: "#334155",
        legendFontSize: 12,
    }));

    // ── Literacy chart data ──
    // Use semantic colors per bar so bar chart itself shows red/amber/green
    const litBarData = {
        labels: literacy.map((t) => LITERACY_SHORT[t.topic] ?? t.topic.split(" ")[0]),
        datasets: [{
            data: literacy.map((t) => t.avgScore),
            colors: literacy.map((t) => () => scoreColor(t.avgScore)),
        }],
    };
    const litPieData = literacy.map((t, i) => ({
        name: t.topic,
        population: t.avgScore,
        color: PALETTE[i % PALETTE.length],
        legendFontColor: "#334155",
        legendFontSize: 11,
    }));

    return (
        <ScrollView
            style={s.root}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
        >
            {/* ════════════════════════════════
                HERO HEADER
            ════════════════════════════════ */}
            <LinearGradient
                colors={["#0A2D5C", "#0B3B78"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.hero}
            >
                <HeaderBar
                    tint="dark"
                    rightSlot={<Feather name="shield" size={20} color="#93C5FD" />}
                />

                {/* Status badge — matches Browse Market dot pill */}
                <View style={s.liveBadge}>
                    <View style={s.liveDot} />
                    <Text style={s.liveTxt}>Regulator Dashboard</Text>
                </View>

                <Text style={s.heroTitle}>Regulator Insights</Text>
                <Text style={s.heroSub}>
                    Ward-wise StockLearn adoption · Government &amp; Regulator view
                </Text>

            </LinearGradient>

            {/* ════════════════════════════════
                BODY
            ════════════════════════════════ */}
            <View style={s.body}>

                {/* ── Banners ── */}
                {loading && (
                    <View style={s.infoBanner}>
                        <ActivityIndicator size="small" color="#4F46E5" />
                        <Text style={s.infoTxt}>Loading ward coverage…</Text>
                    </View>
                )}
                {!!error && (
                    <View style={s.warnBanner}>
                        <Feather name="alert-circle" size={13} color="#B45309" />
                        <Text style={s.warnTxt}>{error}</Text>
                    </View>
                )}

                {/* ── KPI tiles ── */}
                <View style={s.kpiRow}>
                    <KpiTile
                        icon="users"
                        label="Total Users"
                        value={totalUsers != null ? String(totalUsers) : "—"}
                        accent="#4F46E5"
                    />
                    <KpiTile
                        icon="award"
                        label="Avg Literacy"
                        value={`${avgLit}%`}
                        accent="#10B981"
                    />
                    <KpiTile
                        icon="alert-triangle"
                        label="Weak Topics"
                        value={String(weakCount)}
                        accent="#F59E0B"
                    />
                </View>

                {/* ════════ WARD DOWNLOADS CARD ════════ */}
                <Card>
                    <CardHeader
                        title="Downloads by Ward"
                        desc="Which wards are using StockLearn most?"
                        accentColor="#4F46E5"
                        chartType={wardChart}
                        onToggle={setWardChart}
                    />

                    {/* Chart area with light tinted bg so white chart doesn't merge into card */}
                    <View style={s.chartShell}>
                        {wardChart === "bar" ? (
                            <BarChart
                                data={wardBarData}
                                width={CHART_W}
                                height={220}
                                fromZero
                                yAxisLabel=""
                                yAxisSuffix=""
                                chartConfig={BAR_CFG}
                                showValuesOnTopOfBars
                                flatColor
                                withInnerLines
                                style={s.chart}
                            />
                        ) : (
                            <PieChart
                                data={wardPieData}
                                width={CHART_W}
                                height={220}
                                accessor="population"
                                backgroundColor="transparent"
                                paddingLeft="10"
                                chartConfig={PIE_CFG}
                                absolute
                                style={s.chart}
                            />
                        )}
                    </View>

                    {/* Insight chip */}
                    {topWard && (
                        <View style={s.chip}>
                            <Feather name="trending-up" size={12} color="#4F46E5" />
                            <Text style={s.chipTxt}>
                                Ward {topWard.wardNumber} leads —{" "}
                                <Text style={s.chipBold}>{topWard.userCount} users</Text>
                            </Text>
                        </View>
                    )}
                </Card>

                {/* ════════ LITERACY CARD ════════ */}
                <Card>
                    <CardHeader
                        title="Literacy by Topic"
                        desc="Avg quiz scores — lower = citizens need more help here"
                        accentColor="#10B981"
                        chartType={litChart}
                        onToggle={setLitChart}
                    />

                    <View style={s.chartShell}>
                        {litChart === "bar" ? (
                            <BarChart
                                data={litBarData}
                                width={CHART_W}
                                height={220}
                                fromZero
                                yAxisLabel=""
                                yAxisSuffix="%"
                                chartConfig={BAR_CFG}
                                showValuesOnTopOfBars
                                flatColor
                                withInnerLines
                                style={s.chart}
                            />
                        ) : (
                            <PieChart
                                data={litPieData}
                                width={CHART_W}
                                height={220}
                                accessor="population"
                                backgroundColor="transparent"
                                paddingLeft="10"
                                chartConfig={PIE_CFG}
                                absolute
                                style={s.chart}
                            />
                        )}
                    </View>

                    {/* Color legend for literacy */}
                    <View style={s.legendWrap}>
                        {[
                            { color: "#EF4444", label: "< 55% · Needs Focus" },
                            { color: "#F59E0B", label: "55–70% · Improving" },
                            { color: "#10B981", label: "> 70% · Strong" },
                        ].map((l) => (
                            <View key={l.label} style={s.legendItem}>
                                <View style={[s.legendDot, { backgroundColor: l.color }]} />
                                <Text style={s.legendTxt}>{l.label}</Text>
                            </View>
                        ))}
                    </View>
                </Card>

                {/* ════════ HOW TO USE ════════ */}
                <Card style={s.infoCard}>
                    <View style={s.infoHeadRow}>
                        <View style={[s.infoIcon, { backgroundColor: "#EEF2FF" }]}>
                            <Feather name="compass" size={15} color="#4F46E5" />
                        </View>
                        <Text style={s.infoHeadTitle}>How regulators can use this</Text>
                    </View>
                    <Tip
                        icon="map-pin"
                        text="Focus workshops on wards with both low downloads and low quiz scores."
                        iconBg="#EEF2FF"
                        iconColor="#4F46E5"
                    />
                    <Tip
                        icon="copy"
                        text="Study high-adoption wards — see what communication is working."
                        iconBg="#EEF2FF"
                        iconColor="#4F46E5"
                    />
                    <Tip
                        icon="trending-up"
                        text="Track change over time once campaigns launch in specific wards."
                        iconBg="#EEF2FF"
                        iconColor="#4F46E5"
                    />
                </Card>

                {/* ════════ BEHAVIORAL INSIGHTS ════════ */}
                <Card style={[s.infoCard, { borderColor: "#D1FAE5" }]}>
                    <View style={s.infoHeadRow}>
                        <View style={[s.infoIcon, { backgroundColor: "#D1FAE5" }]}>
                            <Feather name="activity" size={15} color="#059669" />
                        </View>
                        <Text style={s.infoHeadTitle}>Behavioral Insights from StockLearn</Text>
                    </View>
                    <Tip
                        icon="book-open"
                        text="Literacy chart is built from real quiz and lesson data inside the app."
                        iconBg="#D1FAE5"
                        iconColor="#059669"
                    />
                    <Tip
                        icon="alert-circle"
                        text="Low-score topics reveal where citizens are most confused about investing."
                        iconBg="#D1FAE5"
                        iconColor="#059669"
                    />
                    <Tip
                        icon="shield"
                        text="Use these insights to shape policies and campaigns that reduce risky behaviour."
                        iconBg="#D1FAE5"
                        iconColor="#059669"
                    />
                </Card>

            </View>
        </ScrollView>
    );
}

// ─── Global stylesheet ────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F1F5F9" },
    scroll: { paddingBottom: 52 },

    // ── Hero ──
    hero: {
        paddingTop: 56,
        paddingHorizontal: H_PAD,
        paddingBottom: 28,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    liveBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        marginTop: 16,
        marginBottom: 10,
    },
    liveDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#EF4444" },
    liveTxt: { fontSize: 12, fontWeight: "600", color: "#E2E8F0" },
    heroTitle: {
        fontSize: 28,
        fontWeight: "800",
        color: "#FFFFFF",
        letterSpacing: -0.3,
        lineHeight: 34,
        marginBottom: 6,
    },
    heroSub: {
        fontSize: 13,
        color: "#94A3B8",
        marginTop: 8,
        lineHeight: 19,
        maxWidth: "80%",
    },


    // ── Body ──
    body: { paddingHorizontal: H_PAD, paddingTop: 20 },

    // ── Banners ──
    infoBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#EEF2FF",
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
    },
    infoTxt: { fontSize: 13, color: "#3730A3", fontWeight: "600" },
    warnBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        backgroundColor: "#FFFBEB",
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#FDE68A",
    },
    warnTxt: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },

    // ── KPI row ──
    kpiRow: {
        flexDirection: "row",
        marginHorizontal: -4,
        marginBottom: 16,
    },

    // ── Chart shell ──
    // Gives the chart a soft tinted background so it reads as a distinct panel
    chartShell: {
        backgroundColor: "#F8FAFF",
        borderRadius: 14,
        paddingVertical: 6,
        alignItems: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    chart: { borderRadius: 12 },

    // ── Insight chip ──
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "#EEF2FF",
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 99,
        marginTop: 12,
    },
    chipTxt: { fontSize: 12, color: "#3730A3" },
    chipBold: { fontWeight: "800" },

    // ── Literacy legend ──
    legendWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 99 },
    legendTxt: { fontSize: 11, color: "#64748B", fontWeight: "500" },

    // ── Info cards ──
    infoCard: {
        borderWidth: 1.5,
        borderColor: "#E0E7FF",
        shadowOpacity: 0.03,
    },
    infoHeadRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
    },
    infoIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    infoHeadTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.2,
    },
});