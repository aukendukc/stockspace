import React, { useState, useRef } from "react";
import { View, Text, Pressable, FlatList, Dimensions, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SwipeableTabsWrapper } from "../../components/SwipeableTabsWrapper";
import { apiClient } from "../../services/api";
import type { Portfolio } from "../../data/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PfScreen() {
  const { portfolios, refreshPortfolios, user } = useApp();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const pf: Portfolio | undefined = portfolios[activeIndex] ?? portfolios[0];
  const totalValue =
    pf?.holdings?.reduce((sum: number, h: any) => sum + (h.shares || 0) * (h.stock?.price || 0), 0) ?? 0;

  const handleAdd = () => {
    router.push(
      (portfolios.length > 0
        ? { pathname: "/search", params: { from: "portfolio", portfolioIndex: String(activeIndex) } }
        : "/portfolio/new"
    ) as any
    );
  };

  const handleCreateNew = () => {
    router.push("/portfolio/new" as any);
  };

  const handleTogglePublic = async (portfolioId: number, isPublic: boolean) => {
    try {
      await apiClient.updatePortfolio(portfolioId, { is_public: isPublic });
      await refreshPortfolios();
    } catch (e) {
      console.error(e);
    }
  };

  const renderPortfolioCard = ({ item, index }: { item: Portfolio; index: number }) => {
    const totalVal =
      item.holdings?.reduce((sum: number, h: any) => sum + (h.shares || 0) * (h.stock?.price || 0), 0) ?? 0;
    return (
      <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>{item.name}</Text>
          {user && item.id && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>公開</Text>
              <Switch
                value={item.is_public ?? false}
                onValueChange={(v) => handleTogglePublic(item.id!, v)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.text}
              />
            </View>
          )}
        </View>
        <View style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, marginBottom: 4 }}>総資産額</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700" }}>¥{totalVal.toLocaleString()}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 6 }}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>保有銘柄</Text>
        </View>
        {item?.holdings && item.holdings.length > 0 ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14 }}>
            {item.holdings.map((h: any) => (
              <View
                key={`${h.stock?.symbol}-${h.shares}`}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{h.stock?.name || ""}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {h.stock?.symbol || ""} ・ {h.shares} 株
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                  ¥{((h.shares || 0) * (h.stock?.price || 0)).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 40, alignItems: "center" }}>
            <Ionicons name="briefcase-outline" size={64} color={colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 16 }}>保有銘柄がありません</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/search", params: { from: "portfolio", portfolioIndex: String(index) } } as any)}
              style={{ marginTop: 24, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            >
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>銘柄を探す</Text>
            </Pressable>
          </View>
        )}
        {item?.holdings && item.holdings.length > 0 && (
          <Pressable
            onPress={() => router.push({ pathname: "/search", params: { from: "portfolio", portfolioIndex: String(index) } } as any)}
            style={{ marginTop: 16, backgroundColor: colors.accent, paddingVertical: 12, borderRadius: 12, alignItems: "center" }}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>銘柄を探す</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SwipeableTabsWrapper>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="briefcase" size={24} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>ポートフォリオ</Text>
            </View>
            <Pressable
              onPress={portfolios.length > 0 ? handleAdd : handleCreateNew}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
            >
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginLeft: 4 }}>{portfolios.length > 0 ? "追加" : "新規"}</Text>
            </Pressable>
          </View>
          {portfolios.length > 1 && (
            <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8 }}>
              {portfolios.map((p, i) => (
                <Pressable
                  key={p.id ?? i}
                  onPress={() => { setActiveIndex(i); flatListRef.current?.scrollToIndex({ index: i, animated: true }); }}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeIndex === i ? colors.accent : colors.card }}
                >
                  <Text style={{ color: activeIndex === i ? colors.text : colors.textMuted, fontSize: 14, fontWeight: activeIndex === i ? "600" : "400" }} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {portfolios.length === 0 ? (
            <View style={{ flex: 1, padding: 32, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="briefcase-outline" size={80} color={colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginTop: 24 }}>ポートフォリオがありません</Text>
              <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: "center" }}>最初のポートフォリオを作成しましょう</Text>
              <Pressable onPress={handleCreateNew} style={{ marginTop: 24, backgroundColor: colors.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>ポートフォリオを作成</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={portfolios}
              renderItem={renderPortfolioCard}
              keyExtractor={(item, i) => String(item.id ?? i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveIndex(Math.min(Math.max(0, i), portfolios.length - 1));
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </SwipeableTabsWrapper>
  );
}
