import { LinearGradient } from "expo-linear-gradient";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { BarChart, PieChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

/* data */

const sectorData = [
  {
    name: "Banking",
    population: 35,
    color: "#2563EB",
    legendFontColor: "#334155",
    legendFontSize: 12,
  },
  {
    name: "Hydro",
    population: 25,
    color: "#16A34A",
    legendFontColor: "#334155",
    legendFontSize: 12,
  },
  {
    name: "Insurance",
    population: 18,
    color: "#D97706",
    legendFontColor: "#334155",
    legendFontSize: 12,
  },
  {
    name: "Hotels",
    population: 12,
    color: "#7C3AED",
    legendFontColor: "#334155",
    legendFontSize: 12,
  },
  {
    name: "Others",
    population: 10,
    color: "#DC2626",
    legendFontColor: "#334155",
    legendFontSize: 12,
  },
];

const barData = {
  labels: ["Gainers", "Losers"],
  datasets: [
    {
      data: [62, 38],
    },
  ],
};

const heatMapData = [
  0.2, 0.6, 0.9, 0.4, 0.1,
  0.3, 0.7, 1.0, 0.5, 0.2,
  0.1, 0.4, 0.8, 0.6, 0.3,
];

/* screen */

export default function InsightsScreen() {
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
        </Text>
      </LinearGradient>

      <View style={styles.content}>

      {/*piechart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sector Allocation</Text>
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
      </View>

      {/* Heatmap */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Market Momentum</Text>
        <Text style={styles.cardDesc}>
          Darker blocks indicate higher activity
        </Text>

        <View style={styles.heatMap}>
          {heatMapData.map((value, index) => (
            <View
              key={index}
              style={[
                styles.heatCell,
                { backgroundColor: getHeatColor(value) },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Barchart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gainers vs Losers</Text>
        <BarChart
          data={barData}
          width={screenWidth - 40}
          height={220}
          fromZero
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={chartConfig}
          showValuesOnTopOfBars
        />
      </View>

      {/* Insights*/}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📌 Today’s Takeaways</Text>
        <Text style={styles.infoText}>
          • Banking sector dominates NEPSE volume{"\n"}
          • Market sentiment is moderately bullish{"\n"}
          • Beginners should observe before entering
        </Text>
      </View>
      </View>
    </ScrollView>
  );
}

/*helpers */

function getHeatColor(value: number) {
  if (value > 0.8) return "#16A34A";
  if (value > 0.5) return "#22C55E";
  if (value > 0.3) return "#FACC15";
  return "#E5E7EB";
}

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: () => "#2563EB",
  labelColor: () => "#475569",
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
