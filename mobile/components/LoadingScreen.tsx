import { View, ActivityIndicator, Text } from "react-native";
import { colors } from "../theme/colors";

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      {message && (
        <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 14 }}>
          {message}
        </Text>
      )}
    </View>
  );
}


