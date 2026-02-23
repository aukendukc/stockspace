import { View, Text } from "react-native";
import { colors } from "../theme/colors";

export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
        {title}
      </Text>
    </View>
  );
}

