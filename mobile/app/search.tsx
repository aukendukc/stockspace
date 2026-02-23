import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { apiClient, StockListedInfo } from "../services/api";
import { Stock } from "../data/mockData";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWatchlist } from "../hooks/useWatchlist";

const SEARCH_HISTORY_KEY = "@search_history";
const MAX_HISTORY_ITEMS = 10;

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { addToWatchlist, isInWatchlist } = useWatchlist();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockListedInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<StockListedInfo[]>([]);

  // 検索履歴を読み込む
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        const parsed = JSON.parse(history);
        setSearchHistory(parsed);
        // 最近検索した銘柄を取得
        if (parsed.length > 0) {
          loadRecentSearches(parsed.slice(0, 5));
        }
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  };

  const saveSearchHistory = async (query: string) => {
    try {
      const history = searchHistory.filter((h) => h !== query);
      const newHistory = [query, ...history].slice(0, MAX_HISTORY_ITEMS);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  };

  const loadRecentSearches = async (symbols: string[]) => {
    try {
      const stocks: StockListedInfo[] = [];
      for (const symbol of symbols) {
        try {
          const listed = await apiClient.getListedStocks({ search: symbol, limit: 1 });
          if (Array.isArray(listed) && listed.length > 0) {
            stocks.push(listed[0]);
          } else {
            const result = await apiClient.getStocks({ search: symbol, limit: 1 });
            if (Array.isArray(result) && result.length > 0) {
              const fallback = result[0] as any;
              stocks.push({ symbol: fallback.symbol, name: fallback.name, market: null });
            }
          }
        } catch (err) {
          // 個別のエラーは無視
        }
      }
      setRecentSearches(stocks);
    } catch (error) {
      console.error("Failed to load recent searches:", error);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSearchError(null);
    
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      let results: StockListedInfo[] = [];
      try {
        const listed = await apiClient.getListedStocks({ search: query, limit: 20 });
        if (Array.isArray(listed)) {
          results = listed;
        }
      } catch (err) {
        // ignore and fallback
      }
      if (results.length === 0) {
        const fallback = await apiClient.getStocks({ search: query, limit: 20 });
        if (Array.isArray(fallback)) {
          results = fallback.map((item: any) => ({
            symbol: item.symbol,
            name: item.name,
            market: null,
          }));
        }
      }
      if (results.length > 0) {
        setSearchResults(results);
        // 検索履歴に保存
        await saveSearchHistory(query);
      } else {
        setSearchResults([]);
        setSearchError("銘柄が見つかりませんでした");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setSearchResults([]);
      const errorMessage = err?.message || "検索中にエラーが発生しました";
      setSearchError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [searchHistory]);

  const handleStockPress = (stock: StockListedInfo) => {
    if (params.from === "portfolio") {
      const portfolioIndex = (params as any).portfolioIndex ?? "0";
      router.replace({
        pathname: "/portfolio/add-holding",
        params: { symbol: stock.symbol, stockName: stock.name, portfolioIndex },
      } as any);
    } else {
      router.push(`/stock/${stock.symbol}`);
    }
  };

  const handleAddToWatchlist = async (stock: StockListedInfo) => {
    try {
      const data = await apiClient.getStockDetailed(stock.symbol);
      const stockData: Stock = {
        id: data.id?.toString() || stock.symbol,
        symbol: data.symbol,
        name: data.name,
        price: data.price || 0,
        change: data.change || 0,
        changePct: data.change_pct || 0,
        high: data.high,
        low: data.low,
        per: data.per,
        pbr: data.pbr,
        dividendYield: data.dividend_yield,
        dividendPayoutRatio: data.dividend_payout_ratio,
        marketCap: data.market_cap,
        revenue: data.revenue,
        profit: data.profit,
        history: undefined,
        historyLabels: undefined,
        revenueHistory: data.revenue_history || [],
        profitHistory: data.profit_history || [],
        dividendHistory: data.dividend_history || [],
        dividendLabels: data.dividend_labels || [],
      };
      addToWatchlist(stockData);
      // 編集画面に遷移して保有情報を入力
      router.push(`/watchlist/edit?symbol=${stock.symbol}` as any);
    } catch (err: any) {
      const errorMessage = err?.message || "ウォッチリスト追加に失敗しました";
      setSearchError(errorMessage);
    }
  };

  const handleHistoryPress = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
      setRecentSearches([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const hasSearchQuery = searchQuery.trim().length > 0;
  const showResults = hasSearchQuery && (searchResults.length > 0 || searchError);
  const showEmptyState = hasSearchQuery && !isSearching && !searchError && searchResults.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {/* ヘッダー */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          
          {/* 検索バー */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="銘柄コード・会社名で検索（例: 7203 / トヨタ）"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
              style={{
                color: colors.text,
                marginLeft: 8,
                fontSize: 16,
                padding: 0,
                flex: 1,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchError(null);
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* コンテンツ */}
        {isSearching && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>検索中...</Text>
          </View>
        )}

        {!isSearching && showResults && (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.symbol}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleStockPress(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.symbol}{item.market ? ` ・ ${item.market}` : ""}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (isInWatchlist(item.symbol)) {
                      router.push(`/watchlist/edit?symbol=${item.symbol}` as any);
                    } else {
                      handleAddToWatchlist(item);
                    }
                  }}
                  style={{ marginLeft: 12, padding: 8 }}
                >
                  <Ionicons
                    name={isInWatchlist(item.symbol) ? "star" : "star-outline"}
                    size={24}
                    color={isInWatchlist(item.symbol) ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              searchError ? (
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 16 }}>
                    {searchError}
                  </Text>
                  <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 14, textAlign: "center" }}>
                    銘柄コードまたは会社名（例: 7203 / トヨタ）を入力してください
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}

        {!isSearching && showEmptyState && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Ionicons name="search" size={64} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 16 }}>
              検索結果が見つかりませんでした
            </Text>
          </View>
        )}

        {!isSearching && !hasSearchQuery && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {/* 最近の検索 */}
            {recentSearches.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
                    最近の検索
                  </Text>
                  <Pressable onPress={clearHistory}>
                    <Text style={{ color: colors.accent, fontSize: 14 }}>クリア</Text>
                  </Pressable>
                </View>
                {recentSearches.map((stock) => (
                  <Pressable
                    key={stock.symbol}
                    onPress={() => handleStockPress(stock)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
                        {stock.name}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>
                        {stock.symbol}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* 検索履歴 */}
            {searchHistory.length > 0 && recentSearches.length === 0 && (
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
                    検索履歴
                  </Text>
                  <Pressable onPress={clearHistory}>
                    <Text style={{ color: colors.accent, fontSize: 14 }}>クリア</Text>
                  </Pressable>
                </View>
                {searchHistory.map((query, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleHistoryPress(query)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.textMuted} style={{ marginRight: 12 }} />
                    <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{query}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* おすすめ検索 */}
            <View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
                おすすめ検索
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["7203", "9984", "6758", "9434", "9983"].map((symbol) => (
                  <Pressable
                    key={symbol}
                    onPress={() => handleHistoryPress(symbol)}
                    style={{
                      backgroundColor: colors.card,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>{symbol}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

