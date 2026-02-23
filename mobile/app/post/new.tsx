import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { Stock } from "../../data/mockData";
import * as ImagePicker from "expo-image-picker";
import { apiClient } from "../../services/api";
import { Ionicons } from "@expo/vector-icons";

const POST_TYPES = [
  { value: "user" as const, label: "通常投稿" },
  { value: "purchase" as const, label: "購入報告" },
  { value: "sale" as const, label: "売却報告" },
];

export default function NewPostScreen() {
  const params = useLocalSearchParams<{ symbol?: string; stockName?: string }>();
  const { user, addPost } = useApp();
  const [text, setText] = useState("");
  const [postType, setPostType] = useState<"user" | "purchase" | "sale">("user");
  const [selected, setSelected] = useState<Stock | undefined>(
    params.symbol ? { symbol: params.symbol, name: params.stockName || params.symbol, price: 0, change: 0, changePct: 0 } as Stock : undefined
  );
  /** 購入/売却報告の複数銘柄（1件目は selected と連動させるため、購入/売却時はこちらを優先） */
  type StockRow = { stock: Stock; holding: string; shares: string; price: string };
  const [stockItems, setStockItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockSearchResults, setStockSearchResults] = useState<any[]>([]);
  const [stockSearching, setStockSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  const searchStocks = async (query: string) => {
    if (!query.trim()) {
      setStockSearchResults([]);
      return;
    }
    setStockSearching(true);
    try {
      const results = await apiClient.getStocks({ search: query, limit: 20 });
      const list = Array.isArray(results) ? results : [];
      setStockSearchResults(list.map((s: any) => ({
        symbol: s.symbol,
        name: s.name,
        price: s.price ?? 0,
        change: s.change ?? 0,
        changePct: s.change_pct ?? s.changePct ?? 0,
        high: s.high,
        low: s.low,
      })));
    } catch {
      try {
        const listed = await apiClient.getListedStocks({ search: query, limit: 20 });
        setStockSearchResults(Array.isArray(listed) ? listed.map((s: any) => ({ symbol: s.symbol, name: s.name, price: 0, change: 0, changePct: 0 })) : []);
      } catch {
        setStockSearchResults([]);
      }
    } finally {
      setStockSearching(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      // MediaType は一部バージョンで未定義になるため、警告は出るが安定して動く MediaTypeOptions を使用
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onSubmit = async () => {
    if (!text.trim()) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    setLoading(true);
    try {
      let uploadedUrl: string | undefined;
      if (imageUri) {
        setUploading(true);
        uploadedUrl = await apiClient.uploadImage(imageUri);
        setUploading(false);
      }

      const isMulti = (postType === "purchase" || postType === "sale") && stockItems.length > 0;
      if (isMulti) {
        await addPost({
          type: postType,
          user: { id: user.id, name: user.name, handle: user.handle },
          text,
          chartImage: uploadedUrl,
          stockItems: stockItems.map((row) => ({
            stock_symbol: row.stock.symbol,
            shares: row.shares.trim() ? parseFloat(row.shares) : undefined,
            price: row.price.trim() ? parseFloat(row.price) : undefined,
            holding_shares: row.holding.trim() ? parseFloat(row.holding) : undefined,
          })),
        });
      } else {
        const single = stockItems[0] || (selected ? { stock: selected, holding: "", shares: "", price: "" } : null);
        const sharesNum = single?.shares?.trim() ? parseFloat(single.shares) : undefined;
        const priceNum = single?.price?.trim() ? parseFloat(single.price) : undefined;
        await addPost({
          type: postType,
          user: { id: user.id, name: user.name, handle: user.handle },
          text,
          stock: single?.stock ?? selected,
          chartImage: uploadedUrl,
          shares: sharesNum,
          price: priceNum,
        });
      }
      router.back();
    } catch (error: any) {
      console.error("Error creating post:", error);
      let errorMsg = error.message || "投稿の作成に失敗しました";
      
      // 認証エラーの場合、より具体的なメッセージを表示
      if (errorMsg.includes("Could not validate credentials") || 
          errorMsg.includes("認証トークン") || 
          errorMsg.includes("再度ログイン") ||
          errorMsg.includes("401")) {
        errorMsg = "認証に失敗しました。再度ログインしてください。";
        // ログイン画面に遷移するオプションを提供
        Alert.alert(
          "認証エラー",
          errorMsg,
          [
            { text: "キャンセル", style: "cancel" },
            {
              text: "ログイン",
              onPress: () => router.replace("/auth/login" as any),
            },
          ]
        );
        return;
      }
      
      Alert.alert("エラー", errorMsg);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 24}
        >
          <View style={{ flex: 1 }}>
            {/* ヘッダー */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>新規投稿</Text>
            <Pressable
              onPress={onSubmit}
              disabled={loading || uploading || !text.trim()}
              style={{
                backgroundColor: colors.accent,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                opacity: loading || uploading || !text.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>投稿</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
          {/* 本文（いま何を考えている？）※一番上に表示・キーボードで隠れない */}
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>
            いま何を考えている？
          </Text>
          <TextInput
            multiline
            value={text}
            onChangeText={setText}
            placeholder="投稿内容を入力..."
            placeholderTextColor={colors.textMuted}
            style={{
              minHeight: 100,
              borderRadius: 16,
              backgroundColor: colors.card,
              color: colors.text,
              padding: 16,
              marginBottom: 20,
              fontSize: 16,
            }}
          />

          {/* ユーザー情報 */}
          {user && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                  {user.name?.[0] || "?"}
                </Text>
              </View>
              <View>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                  {user.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{user.handle}</Text>
              </View>
            </View>
          )}

          {/* 投稿タイプ（購入報告・売却報告・通常） */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              投稿タイプ
            </Text>
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 4,
              }}
            >
              {POST_TYPES.map((t) => {
                const active = postType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setPostType(t.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: active ? colors.accent : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        color: active ? colors.text : colors.textMuted,
                        fontSize: 14,
                        fontWeight: active ? "600" : "400",
                      }}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 銘柄を追加（通常は1銘柄、購入/売却報告は複数銘柄可） */}
          <View style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setStockModalVisible(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Ionicons name="bar-chart-outline" size={22} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                {(postType === "purchase" || postType === "sale") && stockItems.length > 0
                  ? `銘柄を追加（${stockItems.length}件）`
                  : postType === "user" && selected
                    ? `${selected.symbol} ${selected.name}`
                    : "銘柄を追加"}
              </Text>
              {postType === "user" && selected && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelected(undefined);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </Pressable>
              )}
            </Pressable>

            {/* 通常投稿：単一銘柄の表示 */}
            {postType === "user" && selected && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: colors.cardSoft,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{selected.name}</Text>
                <Text style={{ color: colors.accent, fontSize: 12 }}>{selected.symbol}</Text>
                {typeof selected.price === "number" && selected.price > 0 && (
                  <>
                    <Text style={{ color: colors.text, fontSize: 12 }}>¥{selected.price.toLocaleString()}</Text>
                    <Text style={{ color: (selected.changePct ?? 0) >= 0 ? "#22c55e" : "#ef4444", fontSize: 12 }}>
                      {(selected.changePct ?? 0) >= 0 ? "+" : ""}{(selected.changePct ?? 0).toFixed(2)}%
                    </Text>
                    {selected.high != null && (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>高値 ¥{(selected.high as number).toLocaleString()}</Text>
                    )}
                  </>
                )}
              </View>
            )}

            {/* 購入/売却報告：複数銘柄リスト（保有株数・取得/売却株数・取得/売却株価） */}
            {(postType === "purchase" || postType === "sale") && stockItems.length > 0 && (
              <View style={{ marginTop: 12, gap: 16 }}>
                {stockItems.map((row, index) => (
                  <View
                    key={`${row.stock.symbol}-${index}`}
                    style={{
                      backgroundColor: colors.cardSoft,
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{row.stock.name}</Text>
                        <Text style={{ color: colors.accent, fontSize: 12 }}>{row.stock.symbol}</Text>
                        {typeof row.stock.price === "number" && row.stock.price > 0 && (
                          <Text style={{ color: colors.text, fontSize: 11 }}>¥{row.stock.price.toLocaleString()}</Text>
                        )}
                      </View>
                      <Pressable
                        onPress={() => setStockItems((prev) => prev.filter((_, i) => i !== index))}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>保有株数</Text>
                        <TextInput
                          value={row.holding}
                          onChangeText={(v) =>
                            setStockItems((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, holding: v } : r))
                            )
                          }
                          placeholder="任意"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: 8,
                            padding: 10,
                            color: colors.text,
                            fontSize: 13,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>
                          {postType === "sale" ? "売却株数" : "取得株数"}
                        </Text>
                        <TextInput
                          value={row.shares}
                          onChangeText={(v) =>
                            setStockItems((prev) => prev.map((r, i) => (i === index ? { ...r, shares: v } : r)))
                          }
                          placeholder="任意"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: 8,
                            padding: 10,
                            color: colors.text,
                            fontSize: 13,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>
                          {postType === "sale" ? "売却株価" : "取得株価"}
                        </Text>
                        <TextInput
                          value={row.price}
                          onChangeText={(v) =>
                            setStockItems((prev) => prev.map((r, i) => (i === index ? { ...r, price: v } : r)))
                          }
                          placeholder="円"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: 8,
                            padding: 10,
                            color: colors.text,
                            fontSize: 13,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 画像を追加 */}
          <View style={{ marginBottom: 24 }}>
            <Pressable
              onPress={pickImage}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Ionicons name="image-outline" size={22} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>画像を追加</Text>
            </Pressable>
            {imageUri && (
              <View style={{ marginTop: 8, position: "relative" }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: "100%", height: 200, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setImageUri(null)}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    borderRadius: 20,
                    padding: 6,
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
            )}
            {uploading && (
              <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>画像をアップロード中...</Text>
              </View>
            )}
          </View>
        </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* 銘柄選択モーダル */}
      <Modal
        visible={stockModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setStockModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 40}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
            onPress={() => { Keyboard.dismiss(); setStockModalVisible(false); }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.bg,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: "85%",
              }}
            >
              {/* 検索欄を常に上に固定し、キーボードで隠れないようにする */}
              <View
                style={{
                  paddingTop: 8,
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
                    銘柄を選択
                  </Text>
                  <Pressable onPress={() => setStockModalVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                  }}
                >
                  <Ionicons name="search" size={20} color={colors.textMuted} />
                  <TextInput
                    placeholder="銘柄コード・会社名で検索..."
                    placeholderTextColor={colors.textMuted}
                    value={stockSearchQuery}
                    onChangeText={(v) => {
                      setStockSearchQuery(v);
                      searchStocks(v);
                    }}
                    style={{
                      flex: 1,
                      color: colors.text,
                      padding: 14,
                      fontSize: 16,
                    }}
                  />
                </View>
              </View>
              {stockSearching && (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
              <FlatList
                data={stockSearchResults}
                keyExtractor={(item) => item.symbol}
                style={{ maxHeight: 320 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    const stock: Stock = {
                      symbol: item.symbol,
                      name: item.name,
                      price: item.price ?? 0,
                      change: item.change ?? 0,
                      changePct: item.changePct ?? 0,
                      high: item.high,
                      low: item.low,
                    } as Stock;
                    if (postType === "purchase" || postType === "sale") {
                      setStockItems((prev) => [...prev, { stock, holding: "", shares: "", price: "" }]);
                    } else {
                      setSelected(stock);
                    }
                    setStockModalVisible(false);
                  }}
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.accent, fontSize: 12 }}>{item.symbol}</Text>
                    {typeof (item as any).price === "number" && (item as any).price > 0 && (
                      <>
                        <Text style={{ color: colors.text, fontSize: 12 }}>
                          ¥{Number((item as any).price).toLocaleString()}
                        </Text>
                        <Text
                          style={{
                            color: ((item as any).changePct ?? 0) >= 0 ? "#22c55e" : "#ef4444",
                            fontSize: 12,
                          }}
                        >
                          {((item as any).changePct ?? 0) >= 0 ? "+" : ""}
                          {Number((item as any).changePct ?? 0).toFixed(2)}%
                        </Text>
                        {(item as any).high != null && (
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                            高値 ¥{Number((item as any).high).toLocaleString()}
                          </Text>
                        )}
                      </>
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  !stockSearching && stockSearchQuery.trim() ? (
                    <View style={{ padding: 24, alignItems: "center" }}>
                      <Text style={{ color: colors.textMuted }}>銘柄コード・会社名で検索...</Text>
                    </View>
                  ) : null
                }
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
