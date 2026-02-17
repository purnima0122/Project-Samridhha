import { LinearGradient } from "expo-linear-gradient";
import { Dimensions, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { BarChart, PieChart } from "react-native-chart-kit";
import { useDataServer } from "../context/DataServerContext";
import { useMemo } from "react";

const screenWidth = Dimensions.get("window").width;

export default function InsightsScreen() {
  const { stocks, ticks, loadingStocks, isConnected } = useDataServer();

  // 1. Sector Allocation (Pie Chart)
  const sectorData = useMemo(() => {
    if (!stocks.length) return [];

    const sectorCounts: Record<string, number> = {};
    stocks.forEach(stock => {
      const sector = stock.sector || "Others";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    const colors = ["#2563EB", "#16A34A", "#D97706", "#7C3AED", "#DC2626", "#0891B2", "#BE123C"];

    return Object.keys(sectorCounts)
      .sort((a, b) => sectorCounts[b] - sectorCounts[a])
      .slice(0, 5) // Top 5 sectors
      .map((sector, index) => ({
        name: sector,
        population: sectorCounts[sector],
        color: colors[index % colors.length],
        legendFontColor: "#334155",
        legendFontSize: 12,
      }));
  }, [stocks]);

  // 2. Gainers vs Losers (Bar Chart)
  const barData = useMemo(() => {
    let gainers = 0;
    let losers = 0;

    stocks.forEach(stock => {
      const tick = ticks[stock.symbol];
      const change = tick ? tick.change : (stock.change || 0);
      if (change > 0) gainers++;
      else if (change < 0) losers++;
    });

    return {
      labels: ["Gainers", "Losers"],
      datasets: [{ data: [gainers, losers] }],
    };
  }, [stocks, ticks]);

  // 3. Heatmap (Top 15 stocks by volume, colored by change%)
  const heatMapItems = useMemo(() => {
    // Merge static stock data with live ticks
    const liveStocks = stocks.map(s => {
      const t = ticks[s.symbol];
      return {
        ...s,
        price: t?.current_price ?? s.price,
        change_pct: t?.change_pct ?? s.change_pct ?? 0,
        volume: t?.volume ?? s.volume ?? 0,
      };
    });

    // Sort by volume descending
    return liveStocks
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 15);
  }, [stocks, ticks]);

  const topGainer = useMemo<{ symbol: string; change: number } | null>(() => {
    if (!stocks.length) return null;
    let best: { symbol: string; change: number } | null = null;
    stocks.forEach(s => {
      const t = ticks[s.symbol];
      const change = t ? t.change_pct : (s.change_pct || 0);
      if (!best || change > best.change) {
        best = { symbol: s.symbol, change };
      }
    });
    return best;
  }, [stocks, ticks]);

  if (loadingStocks && !stocks.length) {
    return (
      <View style={[styles.container, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#0B3B78" />
        <Text style={{ marginTop: 10, color: "#64748B" }}>Loading Market Insights...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#0A2D5C", "#0B3B78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        <Text style={styles.headerTitle}>Market Insights</Text>
        <Text style={styles.headerSubtitle}>
          Visual breakdown of NEPSE market trends
          {!isConnected && " (Connecting...)"}
        </Text>
      </LinearGradient>

      <View style={styles.content}>

        {/* Pie Chart: Sector Allocation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sector Allocation</Text>
          {sectorData.length > 0 ? (
            <PieChart
              data={sectorData}
              width={screenWidth - 40}
              height={220}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              chartConfig={chartConfig}
              absolute
            />
          ) : (
            <Text style={styles.noDataText}>No sector data available</Text>
          )}
        </View>

        {/* Heatmap: Market Momentum */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Market Momentum (Top Vol)</Text>
          <Text style={styles.cardDesc}>
            Top 15 active stocks. Green = Up, Red = Down.
          </Text>

          <View style={styles.heatMap}>
            {heatMapItems.map((item, index) => (
              <View
                key={item.symbol}
                style={[
                  styles.heatCell,
                  { backgroundColor: getHeatColor(item.change_pct) },
                ]}
              >
                <Text style={styles.heatText}>{item.symbol}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bar Chart: Gainers vs Losers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gainers vs Losers</Text>
          <BarChart
            data={barData}
            width={screenWidth - 40}
            height={220}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            showValuesOnTopOfBars
          />
        </View>

        {/* Insights */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📌 Market Snapshot</Text>
          <Text style={styles.infoText}>
            • {barData.datasets[0].data[0]} stocks advanced, {barData.datasets[0].data[1]} declined today.{"\n"}
            • Top Volume: {heatMapItems[0]?.symbol} ({heatMapItems[0]?.volume?.toLocaleString()}){"\n"}
            {topGainer && `• Top Gainer: ${topGainer.symbol} (+${topGainer.change.toFixed(2)}%)`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/*helpers */

function getHeatColor(changePct: number) {
  if (changePct >= 2) return "#16A34A"; // Strong Green
  if (changePct > 0) return "#4ADE80";  // Light Green
  if (changePct === 0) return "#E5E7EB"; // Grey
  if (changePct > -2) return "#F87171"; // Light Red
  return "#DC2626";                     // Strong Red
}

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
  barPercentage: 0.7,
};

/* styling */

const styles = StyleSheet.create({
  container: { backgroundColor: "#F8FAFC" },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "visible",
    position: "relative",
    elevation: 4,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#E0E7FF",
    marginTop: 6,
  },
  content: { paddingHorizontal: 20, paddingTop: 16, zIndex: 0 },
  noDataText: { textAlign: "center", color: "#64748B", marginTop: 20 },
  heatText: { fontSize: 10, color: "#fff", fontWeight: "bold", textAlign: "center" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 10,
  },

  cardDesc: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
  },

  heatMap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  heatCell: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },

  infoCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginBottom: 40,
  },

  infoTitle: {
    fontWeight: "600",
    color: "#3730A3",
    marginBottom: 6,
  },

  infoText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
});
