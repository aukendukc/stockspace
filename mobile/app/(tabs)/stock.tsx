import { View, ScrollView, Text, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SwipeableTabsWrapper } from "../../components/SwipeableTabsWrapper";
import { useState } from "react";

type RankingType = "gainers" | "losers" | null;

export default function StockScreen() {
  const { rankings } = useApp();
  const router = useRouter();
  const [activeRanking, setActiveRanking] = useState<RankingType>(null);

  const topGainers = rankings?.topGainers || [];
  const topLosers = rankings?.topLosers || [];
  const displayList = activeRanking === "gainers" ? topGainers : activeRanking === "losers" ? topLosers : [];

  return (
    <SwipeableTabsWrapper>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, padding: 16 }}>
          {/* ヘッダー */}
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            銘柄検索
          </Text>

          {/* 検索バー */}
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 20,
            }}
            onPress={() => router.push("/search" as any)}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginLeft: 10, fontSize: 15, flex: 1 }}>
              銘柄コード・会社名で検索...
            </Text>
          </Pressable>

          {/* ランキングボタン */}
          <View style={{ gap: 12, marginBottom: 20 }}>
            <Pressable
              onPress={() =>
                setActiveRanking((prev) => (prev === "gainers" ? null : "gainers"))
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(34, 197, 94, 0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons name="trending-up" size={22} color={colors.success} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                値上がりランキング
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setActiveRanking((prev) => (prev === "losers" ? null : "losers"))
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(249, 115, 115, 0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons name="trending-down" size={22} color={colors.danger} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                値下がりランキング
              </Text>
            </Pressable>
          </View>

          {/* ランキングリスト */}
          {activeRanking && displayList.length > 0 && (
            <FlatList
              data={displayList}
              keyExtractor={(item) => item.symbol}
              style={{ flex: 1 }}
              renderItem={({ item }) => {
                const positive = item.change_pct >= 0;
                return (
                  <Pressable
                    onPress={() => router.push(`/stock/${item.symbol}` as any)}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 8,
                    }}
                  >
                    <View>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                        {item.symbol}
                      </Text>
                      <Text
                        style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                        ¥{Number(item.price || 0).toLocaleString()}
                      </Text>
                      <Text
                        style={{
                          color: positive ? colors.success : colors.danger,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {positive ? "+" : ""}
                        {Number(item.change || 0).toLocaleString()} (
                        {positive ? "+" : ""}
                        {Number(item.change_pct || 0).toFixed(2)}%)
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {activeRanking && displayList.length === 0 && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 32,
              }}
            >
              <Text style={{ color: colors.textMuted }}>データがありません</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </SwipeableTabsWrapper>
  );
}
