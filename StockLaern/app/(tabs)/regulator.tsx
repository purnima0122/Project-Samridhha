import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-chart-kit";
import HeaderBar from "../components/HeaderBar";
import { apiFetch } from "../lib/api";

const screenWidth = Dimensions.get("window").width;
const chartWidth = screenWidth - 60; // keep charts comfortably inside card on mobile

type WardStat = {
    wardNumber: number;
    userCount: number;
};

type LiteracyTopicStat = {
    topic: string;
    avgScore: number; // 0–100
};

type WardCoverageResponse = {
    metadata?: {
        province?: string;
        district?: string;
        municipality?: string;
        from?: string;
        to?: string;
        totalUsers?: number;
        generatedAt?: string;
    };
    wards: WardStat[];
    literacyTopics?: LiteracyTopicStat[];
};

const FALLBACK_WARD_DATA: WardStat[] = [
    { wardNumber: 1, userCount: 120 },
    { wardNumber: 2, userCount: 80 },
    { wardNumber: 3, userCount: 250 },
    { wardNumber: 4, userCount: 60 },
    { wardNumber: 5, userCount: 90 },
];

const PIE_COLORS = [
    "#2563EB",
    "#16A34A",
    "#D97706",
    "#7C3AED",
    "#DC2626",
    "#0EA5E9",
];

const FALLBACK_LITERACY_DATA: LiteracyTopicStat[] = [
    { topic: "Risk & Volatility", avgScore: 52 },
    { topic: "Diversification", avgScore: 61 },
    { topic: "Long-term Investing", avgScore: 74 },
    { topic: "Reading Alerts", avgScore: 49 },
    { topic: "Basic Instruments", avgScore: 68 },
];

const LITERACY_SHORT_LABELS: Record<string, string> = {
    "Risk & Volatility": "Risk",
    Diversification: "Diversify",
    "Long-term Investing": "Long-term",
    "Reading Alerts": "Alerts",
    "Basic Instruments": "Basics",
};

export default function RegulatorScreen() {
    const [wards, setWards] = useState<WardStat[]>([]);
    const [totalUsers, setTotalUsers] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [literacyStats, setLiteracyStats] = useState<LiteracyTopicStat[]>(
        FALLBACK_LITERACY_DATA
    );
    const [wardChartType, setWardChartType] = useState<"bar" | "pie">("bar");
    const [literacyChartType, setLiteracyChartType] = useState<"bar" | "pie">(
        "bar"
    );

    useEffect(() => {
        let isMounted = true;

        async function loadWardCoverage() {
            try {
                setLoading(true);
                setError(null);

                const res = await apiFetch<WardCoverageResponse>("/regulator/ward-coverage");

                if (!isMounted) return;

                if (!res || !Array.isArray(res.wards) || res.wards.length === 0) {
                    // Fallback to demo data so the regulator view still renders
                    setWards(FALLBACK_WARD_DATA);
                    setTotalUsers(
                        FALLBACK_WARD_DATA.reduce((sum, w) => sum + w.userCount, 0)
                    );
                    setLiteracyStats(FALLBACK_LITERACY_DATA);
                } else {
                    setWards(res.wards);
                    const total =
                        res.metadata?.totalUsers ??
                        res.wards.reduce((sum, w) => sum + w.userCount, 0);
                    setTotalUsers(total);
                    if (Array.isArray(res.literacyTopics) && res.literacyTopics.length > 0) {
                        setLiteracyStats(res.literacyTopics);
                    } else {
                        setLiteracyStats(FALLBACK_LITERACY_DATA);
                    }
                }
            } catch (e) {
                if (!isMounted) return;
                console.warn("Failed to load ward coverage", e);
                setError("Unable to load live ward coverage. Showing sample data.");
                setWards(FALLBACK_WARD_DATA);
                setTotalUsers(
                    FALLBACK_WARD_DATA.reduce((sum, w) => sum + w.userCount, 0)
                );
                setLiteracyStats(FALLBACK_LITERACY_DATA);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadWardCoverage();

        return () => {
            isMounted = false;
        };
    }, []);

    const barData = {
        labels: wards.map((w) => `W-${w.wardNumber}`),
        datasets: [
            {
                data: wards.map((w) => w.userCount || 0),
            },
        ],
    };

    const wardPieData = wards.map((w, index) => ({
        name: `Ward ${w.wardNumber}`,
        population: w.userCount,
        color: PIE_COLORS[index % PIE_COLORS.length],
        legendFontColor: "#334155",
        legendFontSize: 12,
    }));

    const literacyBarData = {
        labels: literacyStats.map(
            (t) => LITERACY_SHORT_LABELS[t.topic] ?? t.topic
        ),
        datasets: [
            {
                data: literacyStats.map((t) => t.avgScore),
            },
        ],
    };

    const literacyPieData = literacyStats.map((t, index) => ({
        name: t.topic,
        population: t.avgScore,
        color: PIE_COLORS[index % PIE_COLORS.length],
        legendFontColor: "#334155",
        legendFontSize: 11,
    }));

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            <LinearGradient
                colors={["#111827", "#020617"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            >
                <HeaderBar
                    tint="dark"
                    rightSlot={
                        <Feather name="shield" size={20} color="#E5E7EB" />
                    }
                />
                <Text style={styles.headerTitle}>Regulator Insights</Text>
                <Text style={styles.headerSubtitle}>
                    Ward-wise view of StockLearn adoption for government & regulators
                </Text>
            </LinearGradient>

            <View style={styles.content}>
                {loading && (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="small" color="#2563EB" />
                        <Text style={styles.loadingText}>Loading ward coverage…</Text>
                    </View>
                )}

                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* High-level summary */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Coverage Snapshot</Text>
                    <Text style={styles.summaryMetric}>
                        {totalUsers ?? "—"}{" "}
                        <Text style={styles.summaryMetricUnit}>citizens using the app</Text>
                    </Text>
                    <Text style={styles.summarySub}>
                        Data shown by ward to help target financial literacy programs.
                    </Text>
                </View>

                {/* Bar chart – absolute number of downloads per ward */}
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>Downloads by ward</Text>
                        <View style={styles.toggleContainer}>
                            <Text
                                style={[
                                    styles.toggleOption,
                                    wardChartType === "bar" && styles.toggleOptionActive,
                                ]}
                                onPress={() => setWardChartType("bar")}
                            >
                                Bar
                            </Text>
                            <Text
                                style={[
                                    styles.toggleOption,
                                    wardChartType === "pie" && styles.toggleOptionActive,
                                ]}
                                onPress={() => setWardChartType("pie")}
                            >
                                Pie
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.cardDesc}>
                        Switch between bar and pie view to compare high- and low-adoption wards for targeted campaigns.
                    </Text>
                    {wardChartType === "bar" ? (
                        <BarChart
                            data={barData}
                            width={chartWidth}
                            height={220}
                            fromZero
                            yAxisLabel=""
                            yAxisSuffix=""
                            chartConfig={barChartConfig}
                            showValuesOnTopOfBars
                            flatColor
                            withInnerLines
                            style={styles.chart}
                        />
                    ) : (
                        <PieChart
                            data={wardPieData}
                            width={chartWidth}
                            height={220}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="8"
                            chartConfig={pieChartConfig}
                            absolute
                            style={styles.chart}
                        />
                    )}
                </View>

                {/* Literacy gaps visual – quiz performance by topic */}
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>Financial literacy by topic</Text>
                        <View style={styles.toggleContainer}>
                            <Text
                                style={[
                                    styles.toggleOption,
                                    literacyChartType === "bar" && styles.toggleOptionActive,
                                ]}
                                onPress={() => setLiteracyChartType("bar")}
                            >
                                Bar
                            </Text>
                            <Text
                                style={[
                                    styles.toggleOption,
                                    literacyChartType === "pie" && styles.toggleOptionActive,
                                ]}
                                onPress={() => setLiteracyChartType("pie")}
                            >
                                Pie
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.cardDesc}>
                        Lower scores highlight where citizens are most confused about investing, market behaviour, or risk.
                    </Text>
                    {literacyChartType === "bar" ? (
                        <BarChart
                            data={literacyBarData}
                            width={chartWidth}
                            height={220}
                            fromZero
                            yAxisLabel=""
                            yAxisSuffix="%"
                            chartConfig={barChartConfig}
                            showValuesOnTopOfBars
                            flatColor
                            withInnerLines
                            style={styles.chart}
                        />
                    ) : (
                        <PieChart
                            data={literacyPieData}
                            width={chartWidth}
                            height={220}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="8"
                            chartConfig={pieChartConfig}
                            absolute
                            style={styles.chart}
                        />
                    )}
                </View>

                {/* Explanation: ward coverage for government */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>How regulators can use this</Text>
                    <Text style={styles.infoText}>
                        • Focus literacy workshops on wards with low downloads and low quiz scores.{"\n"}
                        • Compare high-adoption wards to see what communication is working.{"\n"}
                        • Track change over time once campaigns are launched in specific wards.
                    </Text>
                </View>

                {/* Explanation: how STOCKLEARN helps government & regulators */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Behavioral insights from StockLearn</Text>
                    <Text style={styles.infoText}>
                        • The literacy chart above is built from quiz and lesson data inside StockLearn.{"\n"}
                        • Topics with lower scores mark knowledge gaps where citizens struggle the most.{"\n"}
                        • Regulators can target campaigns and policies toward those weak areas to reduce risky behaviour and improve safe participation.
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}
const barChartConfig = {
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    barPercentage: 0.6,
    fillShadowGradient: "#0B3B78",
    fillShadowGradientOpacity: 1,
    color: (opacity = 1) => `rgba(11, 59, 120, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
    style: {
        borderRadius: 16,
    },
    propsForBackgroundLines: {
        strokeDasharray: "",
        stroke: "#E2E8F0",
    },
};

const pieChartConfig = {
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
};

const styles = StyleSheet.create({
    container: { backgroundColor: "#020617" },
    headerGradient: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 22,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: "visible",
        position: "relative",
        elevation: 50,
        zIndex: 50,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: "700",
        color: "#fff",
        marginTop: 12,
    },
    headerSubtitle: {
        fontSize: 14,
        color: "#E5E7EB",
        marginTop: 6,
    },
    content: { paddingHorizontal: 20, paddingTop: 16, zIndex: 0 },
    loadingBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#EFF6FF",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    loadingText: {
        fontSize: 13,
        color: "#1D4ED8",
    },
    errorBox: {
        backgroundColor: "#FEF2F2",
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
    },
    errorText: {
        fontSize: 13,
        color: "#B91C1C",
    },
    summaryCard: {
        backgroundColor: "#020617",
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.3)",
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#E5E7EB",
        marginBottom: 6,
    },
    summaryMetric: {
        fontSize: 24,
        fontWeight: "700",
        color: "#FACC15",
    },
    summaryMetricUnit: {
        fontSize: 14,
        fontWeight: "500",
        color: "#E5E7EB",
    },
    summarySub: {
        marginTop: 6,
        fontSize: 13,
        color: "#9CA3AF",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 16,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 6,
    },
    chart: {
        alignSelf: "center",
        marginTop: 4,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#0F172A",
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 13,
        color: "#64748B",
        marginBottom: 12,
    },
    cardHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    toggleContainer: {
        flexDirection: "row",
        backgroundColor: "#E5E7EB",
        borderRadius: 999,
        padding: 2,
    },
    toggleOption: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        fontSize: 12,
        color: "#475569",
    },
    toggleOptionActive: {
        backgroundColor: "#0F172A",
        color: "#F9FAFB",
        borderRadius: 999,
    },
    infoCard: {
        backgroundColor: "#0B1120",
        borderRadius: 18,
        padding: 16,
        marginTop: 4,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.4)",
    },
    infoTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#E5E7EB",
        marginBottom: 6,
    },
    infoText: {
        fontSize: 13,
        color: "#CBD5F5",
        lineHeight: 20,
    },
});
