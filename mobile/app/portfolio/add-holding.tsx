import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { apiClient } from "../../services/api";

export default function AddHoldingScreen() {
  const { symbol, stockName, portfolioIndex } = useLocalSearchParams<{ symbol?: string; stockName?: string; portfolioIndex?: string }>();
  const router = useRouter();
  const { portfolios, refreshPortfolios, user } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shares, setShares] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const idx = parseInt(portfolioIndex || "0", 10);
    if (!isNaN(idx) && idx >= 0 && idx < (portfolios?.length ?? 0)) setSelectedIndex(idx);
  }, [portfolioIndex, portfolios?.length]);

  useEffect(() => {
    if (!user) {
      Alert.alert("ログインが必要です", "ポートフォリオに追加するにはログインしてください", [
        { text: "ログイン", onPress: () => router.push("/auth/login" as any) },
        { text: "キャンセル", onPress: () => router.back() },
      ]);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!symbol?.trim()) {
      Alert.alert("エラー", "銘柄を選択してください");
      return;
    }
    const portfolioId = portfolios?.[selectedIndex]?.id ?? portfolios?.[0]?.id;
    if (!portfolioId) {
      Alert.alert("エラー", "ポートフォリオがありません", [{ text: "OK", onPress: () => router.replace("/portfolio/new" as any) }]);
      return;
    }
    const sharesNum = shares.trim() ? parseFloat(shares) : 0;
    if (shares.trim() !== "" && (isNaN(sharesNum) || sharesNum < 0)) {
      Alert.alert("エラー", "保有株数は0以上の数値を入力してください");
      return;
    }
    setLoading(true);
    try {
      await apiClient.addPortfolioHolding(portfolioId, {
        stock_symbol: symbol.trim(),
        shares: sharesNum,
        purchase_price: purchasePrice.trim() ? parseFloat(purchasePrice) : undefined,
        memo: memo.trim() || undefined,
      });
      await refreshPortfolios();
      router.back();
    } catch (e: any) {
      console.error(e);
      Alert.alert("エラー", e?.message ?? "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const portfolio = portfolios?.[selectedIndex] ?? portfolios?.[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", flex: 1 }}>{symbol} を追加</Text>
      </View>
      <View style={{ padding: 16 }}>
        {stockName ? <Text style={{ color: colors.textMuted, marginBottom: 16 }}>{stockName}</Text> : null}
        {portfolios && portfolios.length > 1 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>追加先</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {portfolios.map((p, i) => (
                <Pressable
                  key={p.id ?? i}
                  onPress={() => setSelectedIndex(i)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedIndex === i ? colors.accent : colors.card,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14 }}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>保有株数（0でウォッチリスト）</Text>
        <TextInput
          value={shares}
          onChangeText={setShares}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, marginBottom: 16 }}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>取得単価（任意）</Text>
        <TextInput
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          placeholder="例: 2500"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, marginBottom: 16 }}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>メモ（任意）</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="メモ"
          placeholderTextColor={colors.textMuted}
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, marginBottom: 24 }}
        />
        <Pressable onPress={handleSubmit} disabled={loading} style={{ backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: "center" }}>
          {loading ? <ActivityIndicator color={colors.text} /> : <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>追加</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
