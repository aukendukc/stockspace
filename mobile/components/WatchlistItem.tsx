import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { WatchlistItem as WatchlistItemType } from "../data/mockData";
import { useRouter } from "expo-router";

interface WatchlistItemProps {
  item: WatchlistItemType;
  onEdit: () => void;
  onRemove: () => void;
}

export function WatchlistItem({ item, onEdit, onRemove }: WatchlistItemProps) {
  const router = useRouter();
  const positive = item.changePct >= 0;
  
  // 損益計算
  const currentValue = item.shares && item.shares > 0 ? item.shares * item.price : 0;
  const purchaseValue = item.shares && item.purchasePrice && item.purchasePrice > 0 
    ? item.shares * item.purchasePrice 
    : 0;
  const profitLoss = currentValue - purchaseValue;
  const profitLossPct = purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

  const handlePress = () => {
    router.push(`/stock/${item.symbol}` as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* 左側: 銘柄情報 */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginRight: 8 }}>
              {item.symbol}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }} numberOfLines={1}>
            {item.name}
          </Text>

          {/* 価格情報 */}
          <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 4 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
              ¥{item.price.toLocaleString()}
            </Text>
            <Text
              style={{
                color: positive ? colors.success : colors.danger,
                fontSize: 14,
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              {positive ? "+" : ""}
              {item.change.toLocaleString()} ({positive ? "+" : ""}
              {item.changePct.toFixed(2)}%)
            </Text>
          </View>

          {/* 保有情報 */}
          {item.shares && item.shares > 0 ? (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>保有数</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "500" }}>
                  {item.shares.toLocaleString()} 株
                </Text>
              </View>
              {item.purchasePrice && item.purchasePrice > 0 && (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>取得価格</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "500" }}>
                      ¥{item.purchasePrice.toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>評価額</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "500" }}>
                      ¥{currentValue.toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>損益</Text>
                    <Text
                      style={{
                        color: profitLoss >= 0 ? colors.success : colors.danger,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {profitLoss >= 0 ? "+" : ""}
                      ¥{profitLoss.toLocaleString()} ({profitLoss >= 0 ? "+" : ""}
                      {profitLossPct.toFixed(2)}%)
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
              保有情報未設定
            </Text>
          )}
        </View>

        {/* 右側: 編集ボタン */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          style={{
            marginLeft: 12,
            padding: 8,
          }}
        >
          <Ionicons name="create-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>
    </Pressable>
  );
}







