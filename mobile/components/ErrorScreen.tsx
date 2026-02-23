import { View, Text, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

export function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
      }}
    >
      <Ionicons name="alert-circle" size={64} color={colors.danger} />
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: "600",
          marginTop: 24,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        エラーが発生しました
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 14,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            backgroundColor: colors.accent,
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
            再試行
          </Text>
        </Pressable>
      )}
    </View>
  );
}


