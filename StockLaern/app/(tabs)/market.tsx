import { Activity, Search, TrendingDown, TrendingUp } from "lucide-react-native";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import HeaderBar from "../components/HeaderBar";
import TopRightMenu from "../components/TopRightMenu";

type Page = "home" | "market";

interface BrowseMarketProps {
  onNavigate: (page: Page) => void;
}

const mockCompanies = [
  { symbol: "NABIL", name: "Nabil Bank Ltd", price: 1245.0, change: 2.4, volume: 12450, sector: "Commercial Banks", marketCap: "52.4B" },
  { symbol: "NIBL", name: "Nepal Investment Bank", price: 892.5, change: -1.2, volume: 8932, sector: "Commercial Banks", marketCap: "38.2B" },
  { symbol: "NICA", name: "NIC Asia Bank", price: 1034.0, change: 3.1, volume: 15234, sector: "Commercial Banks", marketCap: "45.8B" },
  { symbol: "EBL", name: "Everest Bank Ltd", price: 756.0, change: 1.8, volume: 6789, sector: "Commercial Banks", marketCap: "28.9B" },
  { symbol: "BOKL", name: "Bank of Kathmandu", price: 534.5, change: -0.5, volume: 4523, sector: "Commercial Banks", marketCap: "22.1B" },
  { symbol: "ADBL", name: "Agricultural Development Bank", price: 423.0, change: 0.8, volume: 3456, sector: "Development Banks", marketCap: "18.5B" },
  { symbol: "NBL", name: "Nepal Bank Limited", price: 512.0, change: 2.1, volume: 5678, sector: "Commercial Banks", marketCap: "24.3B" },
  { symbol: "SBI", name: "Nepal SBI Bank", price: 487.5, change: -1.8, volume: 3892, sector: "Commercial Banks", marketCap: "19.7B" },
];

export default function MarketScreen({ onNavigate }: BrowseMarketProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "gainers" | "losers">("all");

  const filteredCompanies = mockCompanies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.symbol.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedTab === "gainers") return matchesSearch && company.change > 0;
    if (selectedTab === "losers") return matchesSearch && company.change < 0;
    return matchesSearch;
  });

  const marketStats = {
    totalTurnover: "2.45B",
    totalVolume: "4.2M",
    totalTrades: "12,456",
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <HeaderBar tint="dark" rightSlot={<TopRightMenu theme="dark" />} />
        </View>
        <Text style={styles.headerTitle}>Browse Market</Text>
        <Text style={styles.headerSubtitle}>NEPSE Commercial Banks Data</Text>
      </View>

      <View style={styles.content}>
        {/* Market Overview */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Turnover</Text>
            <Text style={styles.statValue}>NPR {marketStats.totalTurnover}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>{marketStats.totalVolume}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Trades</Text>
            <Text style={styles.statValue}>{marketStats.totalTrades}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search width={20} height={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search companies..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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

        {/* Companies List */}
        {filteredCompanies.length > 0 ? (
          filteredCompanies.map((company) => (
            <View key={company.symbol} style={styles.companyCard}>
              <View style={styles.companyHeader}>
                <View>
                  <Text style={styles.companySymbol}>{company.symbol}</Text>
                  <Text style={styles.companyName}>{company.name}</Text>
                </View>
                <View style={styles.companyPriceContainer}>
                  <Text style={styles.companyPrice}>NPR {company.price.toFixed(2)}</Text>
                  <View style={styles.changeRow}>
                    {company.change > 0 ? (
                      <>
                        <TrendingUp width={16} height={16} color="green" />
                        <Text style={styles.changePositive}>+{company.change}%</Text>
                      </>
                    ) : (
                      <>
                        <TrendingDown width={16} height={16} color="red" />
                        <Text style={styles.changeNegative}>{company.change}%</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.companyFooter}>
                <View style={styles.volumeContainer}>
                  <Activity width={14} height={14} />
                  <Text style={styles.volumeText}>Vol: {company.volume.toLocaleString()}</Text>
                </View>
                <Text style={styles.marketCapText}>Mkt Cap: {company.marketCap}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noCompanies}>
            <Text style={styles.noCompaniesText}>No companies found</Text>
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
  companyCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
  companyHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  companySymbol: { fontSize: 16, fontWeight: "bold", color: "#111" },
  companyName: { fontSize: 12, color: "#6b7280" },
  companyPriceContainer: { alignItems: "flex-end" },
  companyPrice: { fontSize: 14, fontWeight: "bold", color: "#111" },
  changeRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  changePositive: { color: "green", fontSize: 12, marginLeft: 4 },
  changeNegative: { color: "red", fontSize: 12, marginLeft: 4 },
  companyFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  volumeContainer: { flexDirection: "row", alignItems: "center" },
  volumeText: { fontSize: 12, color: "#6b7280", marginLeft: 4 },
  marketCapText: { fontSize: 12, color: "#6b7280" },
  noCompanies: { padding: 40, alignItems: "center" },
  noCompaniesText: { color: "#6b7280", fontSize: 14 },
});
