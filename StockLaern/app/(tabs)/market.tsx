import { Activity, Search, TrendingDown, TrendingUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";
import { useDataServer } from "../context/DataServerContext";

type Page = "home" | "market";

interface BrowseMarketProps {
  onNavigate?: (page: Page) => void;
}

export default function MarketScreen({ onNavigate }: BrowseMarketProps) {
  const { stocks, ticks, loadingStocks, isConnected, searchStocks, subscribe, marketStatus } = useDataServer();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"all" | "gainers" | "losers">("all");

  // Subscribe to all tracked stock ticks on mount
  useEffect(() => {
    if (stocks.length > 0) {
      const symbols = stocks.map((s: any) => s.symbol).filter(Boolean);
      if (symbols.length > 0) {
        subscribe(symbols);
      }
    }
  }, [stocks]);

  // Search handler with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await searchStocks(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Merge stock data with live ticks
  const mergeWithTicks = (stock: any) => {
    const tick = ticks[stock.symbol?.toUpperCase()];
    if (tick) {
      return {
        ...stock,
        price: tick.current_price ?? stock.current_price ?? stock.ltp ?? 0,
        change: tick.change_pct ?? stock.change_pct ?? 0,
        volume: tick.volume ?? stock.volume ?? 0,
      };
    }
    return {
      ...stock,
      price: stock.current_price ?? stock.ltp ?? 0,
      change: stock.change_pct ?? 0,
      volume: stock.volume ?? 0,
    };
  };

  const displayStocks = (searchResults ?? stocks).map(mergeWithTicks);

  const filteredCompanies = displayStocks.filter((company: any) => {
    if (selectedTab === "gainers") return company.change > 0;
    if (selectedTab === "losers") return company.change < 0;
    return true;
  });

  const gainersCount = displayStocks.filter((c: any) => c.change > 0).length;
  const losersCount = displayStocks.filter((c: any) => c.change < 0).length;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        </View>
        <Text style={styles.headerTitle}>Browse Market</Text>
        <Text style={styles.headerSubtitle}>
          {marketStatus?.is_open ? "🟢 Market Open" : "🔴 Market Closed"} · NEPSE Live Data
        </Text>
      </View>

      <View style={styles.content}>
        {/* Market Overview */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Stocks</Text>
            <Text style={styles.statValue}>{stocks.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Gainers</Text>
            <Text style={[styles.statValue, { color: "#22c55e" }]}>{gainersCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Losers</Text>
            <Text style={[styles.statValue, { color: "#ef4444" }]}>{losersCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Live</Text>
            <Text style={[styles.statValue, { color: isConnected ? "#22c55e" : "#94A3B8" }]}>
              {isConnected ? "●" : "○"}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search width={20} height={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stocks by name or symbol..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searching && <ActivityIndicator size="small" color="#0B3B78" />}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setSelectedTab("all")}
            style={[styles.tabButton, selectedTab === "all" && styles.tabButtonActive]}
          >
            <Text style={selectedTab === "all" ? styles.tabTextActive : styles.tabText}>All Stocks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedTab("gainers")}
            style={[styles.tabButton, selectedTab === "gainers" && styles.tabButtonActiveGreen]}
          >
            <Text style={selectedTab === "gainers" ? styles.tabTextActive : styles.tabText}>Gainers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedTab("losers")}
            style={[styles.tabButton, selectedTab === "losers" && styles.tabButtonActiveRed]}
          >
            <Text style={selectedTab === "losers" ? styles.tabTextActive : styles.tabText}>Losers</Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {loadingStocks && stocks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0B3B78" />
            <Text style={styles.loadingText}>Loading live market data...</Text>
          </View>
        ) : filteredCompanies.length > 0 ? (
          filteredCompanies.map((company: any) => (
            <View key={company.symbol} style={styles.companyCard}>
              <View style={styles.companyHeader}>
                <View>
                  <Text style={styles.companySymbol}>{company.symbol}</Text>
                  <Text style={styles.companyName}>{company.name || company.company_name || ""}</Text>
                </View>
                <View style={styles.companyPriceContainer}>
                  <Text style={styles.companyPrice}>NPR {Number(company.price).toFixed(2)}</Text>
                  <View style={styles.changeRow}>
                    {company.change > 0 ? (
                      <>
                        <TrendingUp width={16} height={16} color="green" />
                        <Text style={styles.changePositive}>+{Number(company.change).toFixed(2)}%</Text>
                      </>
                    ) : company.change < 0 ? (
                      <>
                        <TrendingDown width={16} height={16} color="red" />
                        <Text style={styles.changeNegative}>{Number(company.change).toFixed(2)}%</Text>
                      </>
                    ) : (
                      <Text style={styles.changeNeutral}>0.00%</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.companyFooter}>
                <View style={styles.volumeContainer}>
                  <Activity width={14} height={14} />
                  <Text style={styles.volumeText}>Vol: {Number(company.volume).toLocaleString()}</Text>
                </View>
                {company.sector && (
                  <Text style={styles.sectorText}>{company.sector}</Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noCompanies}>
            <Text style={styles.noCompaniesText}>
              {searchQuery ? "No stocks found matching your search" : "No stocks available"}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", overflow: "visible" },
  header: {
    backgroundColor: "#031D44",
    padding: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    overflow: "visible",
    position: "relative",
    zIndex: 2,
    elevation: 4,
  },
  headerTopRow: { marginBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  headerSubtitle: { color: "#d1fae5", fontSize: 14 },
  content: { padding: 16, zIndex: 0 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, marginHorizontal: 4, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
  statLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: "bold", color: "#111" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40 },
  tabs: { flexDirection: "row", marginBottom: 16 },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: "#E2E8F0", marginHorizontal: 2, alignItems: "center" },
  tabButtonActive: { backgroundColor: "#70A288" },
  tabButtonActiveGreen: { backgroundColor: "#22c55e" },
  tabButtonActiveRed: { backgroundColor: "#ef4444" },
  tabText: { color: "#4b5563", fontSize: 14 },
  tabTextActive: { color: "#fff", fontWeight: "bold" },
  loadingContainer: { padding: 60, alignItems: "center" },
  loadingText: { color: "#6b7280", fontSize: 14, marginTop: 12 },
  companyCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
  companyHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  companySymbol: { fontSize: 16, fontWeight: "bold", color: "#111" },
  companyName: { fontSize: 12, color: "#6b7280", maxWidth: 180 },
  companyPriceContainer: { alignItems: "flex-end" },
  companyPrice: { fontSize: 14, fontWeight: "bold", color: "#111" },
  changeRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  changePositive: { color: "green", fontSize: 12, marginLeft: 4 },
  changeNegative: { color: "red", fontSize: 12, marginLeft: 4 },
  changeNeutral: { color: "#6b7280", fontSize: 12 },
  companyFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  volumeContainer: { flexDirection: "row", alignItems: "center" },
  volumeText: { fontSize: 12, color: "#6b7280", marginLeft: 4 },
  sectorText: { fontSize: 11, color: "#94A3B8", fontStyle: "italic" },
  noCompanies: { padding: 40, alignItems: "center" },
  noCompaniesText: { color: "#6b7280", fontSize: 14 },
});
