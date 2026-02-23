import React from "react";
import { View, Text, Pressable } from "react-native";
import { Stock } from "../data/mockData";
import { colors } from "../theme/colors";
import { useRouter } from "expo-router";

export const StockRow = ({ stock }: { stock: Stock }) => {
  const router = useRouter();
  const positive = stock.changePct >= 0;

  return (
    <Pressable
      onPress={() =>
        router.push(
          {
            pathname: "/stock/[symbol]",
            params: { symbol: stock.symbol },
          } as any
        )
      }
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
      }}
    >
      <View>
        <Text style={{ color: colors.text, fontSize: 15 }}>{stock.name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {stock.symbol}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>
          ¥{stock.price.toLocaleString()}
        </Text>
        <Text
          style={{
            color: positive ? colors.success : colors.danger,
            fontSize: 12,
          }}
        >
          {positive ? "+" : ""}
          {stock.change.toLocaleString()} ({stock.changePct.toFixed(2)}%)
        </Text>
      </View>
    </Pressable>
  );
};
