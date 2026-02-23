import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { useWatchlist } from "../../hooks/useWatchlist";
import { apiClient } from "../../services/api";

export default function EditWatchlistItemScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const { watchlist, updateWatchlistItem, removeFromWatchlist } = useWatchlist();
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stockData, setStockData] = useState<any>(null);

  const item = watchlist.find((w) => w.symbol === symbol);

  useEffect(() => {
    if (item) {
      setShares(item.shares?.toString() || "");
      setPurchasePrice(item.purchasePrice?.toString() || "");
    }
    loadStockData();
  }, [symbol]);

  const loadStockData = async () => {
    if (!symbol) return;
    try {
      const data = await apiClient.getStockDetailed(symbol);
      setStockData(data);
    } catch (error) {
      console.error("Failed to load stock data:", error);
    }
  };

  const handleSave = async () => {
    if (!item) return;

    const sharesNum = shares ? parseFloat(shares) : 0;
    const priceNum = purchasePrice ? parseFloat(purchasePrice) : 0;

    if (sharesNum < 0) {
      Alert.alert("エラー", "保有株数は0以上で入力してください");
      return;
    }

    if (priceNum < 0) {
      Alert.alert("エラー", "取得価格は0以上で入力してください");
      return;
    }

    // 最新の株価データを取得して更新
    try {
      const latestData = await apiClient.getStockDetailed(symbol);
      updateWatchlistItem(symbol, {
        ...item,
        ...latestData,
        shares: sharesNum || undefined,
        purchasePrice: priceNum || undefined,
        price: latestData.price || item.price,
        change: latestData.change || item.change,
        changePct: latestData.change_pct || item.changePct,
      });
      router.back();
    } catch (error: any) {
      Alert.alert("エラー", error.message || "更新に失敗しました");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "ウォッチリストから削除",
      "この銘柄をウォッチリストから削除してもよろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => {
            if (symbol) {
              removeFromWatchlist(symbol);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Ionicons name="alert-circle" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 16 }}>銘柄が見つかりませんでした</Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 24,
              backgroundColor: colors.accent,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>戻る</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentPrice = stockData?.price || item.price;
  const currentChange = stockData?.change || item.change;
  const currentChangePct = stockData?.change_pct || item.changePct;
  const positive = currentChangePct >= 0;

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
          <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              {item.symbol}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Pressable onPress={handleDelete} style={{ marginLeft: 12 }}>
            <Ionicons name="trash-outline" size={24} color={colors.danger} />
          </Pressable>
        </View>

        <View style={{ flex: 1, padding: 16 }}>
          {/* 現在価格 */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>現在価格</Text>
            <Text style={{ color: colors.text, fontSize: 32, fontWeight: "bold", marginBottom: 8 }}>
              ¥{currentPrice.toLocaleString()}
            </Text>
            <Text
              style={{
                color: positive ? colors.success : colors.danger,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {positive ? "+" : ""}
              {currentChange.toLocaleString()} ({positive ? "+" : ""}
              {currentChangePct.toFixed(2)}%)
            </Text>
          </View>

          {/* 保有情報入力 */}
          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8, fontWeight: "500" }}>
                保有株数
              </Text>
              <TextInput
                placeholder="例: 100"
                placeholderTextColor={colors.textMuted}
                value={shares}
                onChangeText={setShares}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  color: colors.text,
                  fontSize: 16,
                }}
              />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                保有している株数を入力してください（0の場合は未設定）
              </Text>
            </View>

            <View>
              <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8, fontWeight: "500" }}>
                取得価格（1株あたり）
              </Text>
              <TextInput
                placeholder="例: 3000"
                placeholderTextColor={colors.textMuted}
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  color: colors.text,
                  fontSize: 16,
                }}
              />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                1株あたりの取得価格を入力してください
              </Text>
            </View>

            {/* プレビュー */}
            {shares && parseFloat(shares) > 0 && purchasePrice && parseFloat(purchasePrice) > 0 && (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>損益計算</Text>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>取得金額</Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
                      ¥{(parseFloat(shares) * parseFloat(purchasePrice)).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>現在の評価額</Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
                      ¥{(parseFloat(shares) * currentPrice).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>損益</Text>
                    <Text
                      style={{
                        color:
                          parseFloat(shares) * currentPrice - parseFloat(shares) * parseFloat(purchasePrice) >= 0
                            ? colors.success
                            : colors.danger,
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {parseFloat(shares) * currentPrice - parseFloat(shares) * parseFloat(purchasePrice) >= 0
                        ? "+"
                        : ""}
                      ¥{(
                        parseFloat(shares) * currentPrice -
                        parseFloat(shares) * parseFloat(purchasePrice)
                      ).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 保存ボタン */}
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>保存</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}








