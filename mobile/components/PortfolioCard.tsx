import { View, Text, ScrollView } from "react-native";
import { Portfolio } from "../data/mockData";
import { colors } from "../theme/colors";
import { StockRow } from "./StockRow";

export const PortfolioCard = ({ portfolio }: { portfolio: Portfolio }) => {
  const totalValue = portfolio.holdings.reduce(
    (sum, h) => sum + h.shares * h.stock.price,
    0
  );

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 14,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        Portfolio
      </Text>
      <Text
        style={{
          color: colors.text,
          fontWeight: "600",
          fontSize: 16,
          marginBottom: 8,
        }}
      >
        {portfolio.name}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: "700",
          marginBottom: 10,
        }}
      >
        ¥{totalValue.toLocaleString()}
      </Text>

      <ScrollView style={{ maxHeight: 200 }}>
        {portfolio.holdings.slice(0, 5).map((h) => (
          <StockRow key={h.stock.symbol} stock={h.stock} />
        ))}
      </ScrollView>
    </View>
  );
};
