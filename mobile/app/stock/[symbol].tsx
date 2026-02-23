import { View, Text, ScrollView, Pressable, Dimensions, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { PostCard } from "../../components/PostCard";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, StackedBarChart, BarChart } from "react-native-chart-kit";
import { useMemo, useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { Stock } from "../../data/mockData";

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { posts } = useApp();
  const router = useRouter();
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<string>("3m");

  useEffect(() => {
    loadStockData();
  }, [symbol, chartPeriod]);

  const loadStockData = async () => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getStockDetailed(symbol, chartPeriod);
      // Stock型に変換
      const stockData: Stock = {
        id: data.id?.toString() || symbol,
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
        marketCap: data.market_cap,
        revenue: data.revenue,
        profit: data.profit,
        history: (() => {
          const h = data.price_history || [];
          if (h.length >= 2) return h;
          if (h.length === 1 && typeof data.price === "number") {
            const prev = data.previous_close ?? data.price;
            return [prev, h[0]];
          }
          if (typeof data.price === "number") {
            const prev = data.previous_close ?? data.price;
            return [prev, data.price];
          }
          return h;
        })(),
        historyLabels: (() => {
          const h = data.price_history || [];
          const l = data.price_history_labels || [];
          if (h.length >= 2 && l.length >= 2) return l;
          if (h.length < 2 && typeof data.price === "number") return ["前日", "当日"];
          return l;
        })(),
        revenueHistory: data.revenue_history || [],
        profitHistory: data.profit_history || [],
        dividendHistory: data.dividend_history || [],
        dividendLabels: data.dividend_labels || [],
      };
      setStock(stockData);
    } catch (err: any) {
      setError(err.message || "銘柄データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const positive = (stock?.changePct ?? 0) >= 0;
  const isNumber = (value: number | null | undefined): value is number =>
    typeof value === "number" && !Number.isNaN(value);
  const toOku = (value: number) => value / 100000000;
  const formatOku = (value: number | null | undefined) =>
    isNumber(value) ? `¥${toOku(value).toFixed(1)}億` : "-";

  const history = useMemo(() => stock?.history ?? [], [stock?.history]);
  const historyLabels = useMemo(() => {
    if (stock?.history && stock.history.length > 0) {
      if (stock?.historyLabels && stock.historyLabels.length === stock.history.length) {
        return stock.historyLabels;
      }
      return generateHistoryLabels(stock.history.length);
    }
    return [];
  }, [stock?.historyLabels, stock?.history]);
  const revenueHistory = useMemo(() => stock?.revenueHistory ?? [], [stock?.revenueHistory]);
  const profitHistory = useMemo(() => stock?.profitHistory ?? [], [stock?.profitHistory]);
  const dividendHistory = useMemo(() => {
    if (stock?.dividendHistory && stock.dividendHistory.length > 0) {
      return stock.dividendHistory.map((d: any) => (typeof d === "object" ? d.amount : d));
    }
    return [];
  }, [stock?.dividendHistory]);
  const dividendLabels = useMemo(() => {
    if (stock?.dividendLabels && stock.dividendLabels.length > 0) {
      return stock.dividendLabels;
    }
    if (stock?.dividendHistory && stock.dividendHistory.length > 0) {
      return stock.dividendHistory.map((d: any, idx: number) => {
        if (typeof d === "object" && d.date) {
          return new Date(d.date).getFullYear().toString();
        }
        return `${2024 - (stock.dividendHistory?.length ?? 0) + idx + 1}`;
      });
    }
    return [];
  }, [stock?.dividendLabels, stock?.dividendHistory]);
  const metricLabels = revenueHistory.length > 0 ? generateHistoryLabels(revenueHistory.length) : [];
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 32;
  const chartWidthInCard = chartWidth - 24;
  const stockPosts = posts.filter((p) => p.stock?.symbol === symbol);
  const purchaseCount = stockPosts.filter((p) => p.type === "purchase").length;
  const saleCount = stockPosts.filter((p) => p.type === "sale").length;
  
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textMuted, marginTop: 16 }}>読み込み中...</Text>
      </View>
    );
  }

  if (error || !stock) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="alert-circle" size={48} color={colors.danger} />
        <Text style={{ color: colors.text, marginTop: 16, fontSize: 16 }}>{error || "銘柄が見つかりませんでした"}</Text>
        <Pressable
          onPress={loadStockData}
          style={{
            marginTop: 16,
            backgroundColor: colors.accent,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>再試行</Text>
        </Pressable>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      {/* ヘッダー */}
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 20 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>{stock.symbol}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{stock.name}</Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/portfolio/add-holding", params: { symbol: stock.symbol, stockName: stock.name } } as any)}
          style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
        >
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>ポートフォリオ追加</Text>
        </Pressable>
      </View>

      {/* 株価チャート */}
      <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.card, borderRadius: 16, padding: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>株価推移</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {(["1d", "5d", "1m", "3m", "6m", "1y", "5y"] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setChartPeriod(p)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: chartPeriod === p ? colors.accent : "transparent",
                }}
              >
                <Text style={{ color: chartPeriod === p ? colors.text : colors.textMuted, fontSize: 11, fontWeight: chartPeriod === p ? "600" : "400" }}>
                  {p.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {history.length >= 2 ? (
          <LineChart
            data={{
              labels: historyLabels,
              datasets: [
                {
                  data: history,
                  color: () => (positive ? colors.success : colors.danger),
                  strokeWidth: 2,
                },
              ],
            }}
            width={chartWidthInCard}
            height={200}
            yAxisLabel="¥"
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 12, marginLeft: -8 }}
            withShadow={false}
            withDots
            fromZero={false}
          />
        ) : history.length === 1 ? (
          <View style={{ height: 200, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "600" }}>¥{history[0]?.toLocaleString()}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>データが1日分のみです</Text>
          </View>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>チャートデータがありません</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 8 }}>期間を変えてお試しください</Text>
          </View>
        )}
      </View>

      {/* 現在価格 */}
      <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 4 }}>現在価格</Text>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: "bold", marginBottom: 8 }}>
            ¥{stock.price.toLocaleString()}
          </Text>
          <Text
            style={{
              color: positive ? colors.success : colors.danger,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {positive ? "+" : ""}
            {stock.change.toLocaleString()} ({stock.changePct.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* 財務情報 */}
      <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>財務情報</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>時価総額</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {formatOku(stock.marketCap)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>売上</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {formatOku(stock.revenue)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>利益</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {formatOku(stock.profit)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>PER</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {isNumber(stock.per) ? (stock.per as number).toFixed(1) : "-"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>PBR</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {isNumber(stock.pbr) ? (stock.pbr as number).toFixed(1) : "-"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>配当利回り</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {isNumber(stock.dividendYield) ? `${(stock.dividendYield as number).toFixed(2)}%` : "-"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 業績・配当推移 */}
      <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>業績推移</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 12 }}>
          {revenueHistory.length > 0 ? (
            <StackedBarChart
              data={{
                labels: metricLabels,
                legend: ["売上(億円)", "利益(億円)"],
                data: revenueHistory.map((rev, idx) => [
                  Math.round(toOku(rev) * 10) / 10,
                  Math.round(toOku(profitHistory[idx] ?? 0) * 10) / 10,
                ]),
                barColors: [colors.accent, colors.success],
              }}
              width={chartWidthInCard}
              height={200}
              chartConfig={chartConfig}
              hideLegend={false}
              style={{ borderRadius: 12 }}
            />
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 40 }}>
              データがありません
            </Text>
          )}
        </View>
      </View>

      <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>配当推移</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 12 }}>
          {dividendHistory.length > 0 ? (
            <BarChart
              data={{
                labels: dividendLabels,
                datasets: [{ data: dividendHistory }],
              }}
              width={chartWidthInCard}
              height={200}
              yAxisLabel="¥"
              yAxisSuffix=""
              chartConfig={chartConfig}
              fromZero
              showValuesOnTopOfBars
              style={{ borderRadius: 12 }}
            />
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 40 }}>
              データがありません
            </Text>
          )}
        </View>
      </View>

      {/* この銘柄について投稿するボタン */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/post/new",
            params: { symbol: stock.symbol, stockName: stock.name },
          } as any)
        }
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: colors.accent,
          borderRadius: 16,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="create-outline" size={20} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginLeft: 8 }}>
          この銘柄について投稿する
        </Text>
      </Pressable>

      {/* 関連投稿 */}
      <View style={{ marginHorizontal: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            関連投稿 ({stockPosts.length})
          </Text>
          {(purchaseCount > 0 || saleCount > 0) && (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: colors.success, fontSize: 12 }}>購入 {purchaseCount}</Text>
              <Text style={{ color: colors.danger, fontSize: 12 }}>売却 {saleCount}</Text>
            </View>
          )}
        </View>
        {stockPosts.length > 0 ? (
          stockPosts.map((post, index) => (
            <PostCard key={`${post.id}-${post.retweetedBy?.id || 'original'}-${index}`} post={post} />
          ))
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              この銘柄に関する投稿はまだありません
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const chartConfig = {
  backgroundColor: colors.card,
  backgroundGradientFrom: colors.card,
  backgroundGradientTo: colors.card,
  decimalPlaces: 0,
  color: (opacity = 1) => colors.accent,
  labelColor: () => colors.textMuted,
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: colors.accent,
  },
};

const generateHistoryLabels = (length: number) =>
  Array.from({ length }).map((_, idx) => {
    const remaining = length - idx - 1;
    return remaining === 0 ? "今日" : `-${remaining}日`;
  });
