import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useMessages } from "../../context/MessageContext";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ja";

dayjs.extend(relativeTime);
dayjs.locale("ja");

export default function MessageListScreen() {
  const { conversations, loading, error, refreshConversations } = useMessages();
  const { user } = useApp();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Ionicons name="mail-outline" size={64} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, marginTop: 16, textAlign: "center" }}>
          ログインするとDM機能が使えます
        </Text>
        <Pressable
          onPress={() => router.push("/auth/login")}
          style={{
            marginTop: 24,
            backgroundColor: colors.accent,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>ログイン</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && conversations.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}>DM</Text>
        <Pressable
          onPress={() => router.push("/search" as any)}
          style={{
            backgroundColor: colors.accent,
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
      </View>

      {error && (
        <View style={{ backgroundColor: colors.danger + "20", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {conversations.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 16, textAlign: "center" }}>
            まだ会話がありません
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: "center" }}>
            ユーザーのプロフィールからDMを送信できます
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/messages/[id]",
                  params: { id: item.id },
                } as any)
              }
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {/* アバター */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.cardSoft,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
                  {item.otherUser.name[0]}
                </Text>
              </View>

              {/* メッセージ内容 */}
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                    {item.otherUser.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 8 }}>
                    {item.otherUser.handle}
                  </Text>
                </View>
                <Text
                  style={{
                    color: item.unreadCount > 0 ? colors.text : colors.textMuted,
                    fontSize: 13,
                    fontWeight: item.unreadCount > 0 ? "500" : "400",
                  }}
                  numberOfLines={1}
                >
                  {item.lastMessage?.text || "メッセージがありません"}
                </Text>
              </View>

              {/* 時間と未読バッジ */}
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {item.lastMessage ? dayjs(item.lastMessage.createdAt).fromNow() : ""}
                </Text>
                {item.unreadCount > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: 999,
                      minWidth: 20,
                      height: 20,
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>
                      {item.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
      </View>
    </TouchableWithoutFeedback>
  );
}
