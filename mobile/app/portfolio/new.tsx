import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { apiClient } from "../../services/api";

type HoldingRow = { stockSymbol: string; shares: string; purchasePrice: string };

export default function PortfolioNewScreen() {
  const router = useRouter();
  const { refreshPortfolios } = useApp();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [holdings, setHoldings] = useState<HoldingRow[]>([{ stockSymbol: "", shares: "", purchasePrice: "" }]);
  const [loading, setLoading] = useState(false);

  const addHolding = () => {
    setHoldings((prev) => [...prev, { stockSymbol: "", shares: "", purchasePrice: "" }]);
  };

  const updateHolding = (index: number, field: keyof HoldingRow, value: string) => {
    setHoldings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async () => {
    const nameTrim = name.trim();
    if (!nameTrim) {
      Alert.alert("エラー", "ポートフォリオ名を入力してください");
      return;
    }
    const hasToken = await apiClient.refreshAuthToken();
    if (!hasToken) {
      Alert.alert("ログインが必要です", "ポートフォリオを作成するにはログインしてください。", [
        { text: "ログイン", onPress: () => router.replace("/auth/login" as any) },
        { text: "キャンセル", style: "cancel" },
      ]);
      return;
    }
    setLoading(true);
    try {
      const holdingsData = holdings.map((h) => {
        const s = h.shares.trim();
        const sharesNum = s ? parseFloat(s) : 0;
        return {
          stock_symbol: h.stockSymbol,
          shares: isNaN(sharesNum) || sharesNum < 0 ? 0 : sharesNum,
          purchase_price: h.purchasePrice?.trim() ? parseFloat(h.purchasePrice) : undefined,
        };
      });
      await apiClient.createPortfolio({
        name: nameTrim,
        is_public: isPublic,
        holdings: holdingsData,
      });
      await refreshPortfolios();
      router.back();
    } catch (err: any) {
      console.error("Error creating portfolio:", err);
      Alert.alert("エラー", err?.message ?? "ポートフォリオの作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", flex: 1 }}>新規ポートフォリオ</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>名前</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="例: マイポートフォリオ"
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 14,
            color: colors.text,
            fontSize: 16,
            marginBottom: 16,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>公開する</Text>
          <Pressable onPress={() => setIsPublic((v) => !v)} style={{ padding: 8 }}>
            <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: isPublic ? colors.accent : colors.border, justifyContent: "center", paddingHorizontal: 4 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text, alignSelf: isPublic ? "flex-end" : "flex-start" }} />
            </View>
          </Pressable>
        </View>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 }}>銘柄（任意）</Text>
        {holdings.map((h, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <TextInput
              value={h.stockSymbol}
              onChangeText={(v) => updateHolding(i, "stockSymbol", v)}
              placeholder="銘柄コード"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 2, backgroundColor: colors.card, borderRadius: 12, padding: 12, color: colors.text, fontSize: 14 }}
              autoCapitalize="characters"
            />
            <TextInput
              value={h.shares}
              onChangeText={(v) => updateHolding(i, "shares", v)}
              placeholder="株数"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, color: colors.text, fontSize: 14 }}
            />
            <TextInput
              value={h.purchasePrice}
              onChangeText={(v) => updateHolding(i, "purchasePrice", v)}
              placeholder="取得単価"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, color: colors.text, fontSize: 14 }}
            />
          </View>
        ))}
        <Pressable onPress={addHolding} style={{ marginBottom: 24, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
          <Text style={{ color: colors.textMuted }}>+ 銘柄を追加</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={{ backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: "center" }}
        >
          {loading ? <ActivityIndicator color={colors.text} /> : <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>作成</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
