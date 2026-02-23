import { useLocalSearchParams, useRouter } from "expo-router";
import { useMessages, DirectMessage, ConversationDetail } from "../../context/MessageContext";
import { useApp } from "../../context/AppContext";
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { useState, useEffect, useRef, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getConversation, sendMessage, markAsRead } = useMessages();
  const { user } = useApp();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadConversation = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    const data = await getConversation(id);
    if (data) {
      setConversation(data);
      setMessages(data.messages);
      // 既読にする
      await markAsRead(id);
    }
    setLoading(false);
  }, [id, getConversation, markAsRead]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // 定期的に更新（5秒ごと）
  useEffect(() => {
    const interval = setInterval(() => {
      if (id) {
        getConversation(id).then(data => {
          if (data) {
            setMessages(data.messages);
          }
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, getConversation]);

  const onSend = async () => {
    if (!text.trim() || !id || sending) return;
    
    setSending(true);
    const newMessage = await sendMessage(id, text.trim());
    if (newMessage) {
      setMessages(prev => [...prev, newMessage]);
      setText("");
      // リストを最下部にスクロール
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Ionicons name="chatbubble-outline" size={64} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, marginTop: 16 }}>会話が見つかりませんでした</Text>
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
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* ヘッダー */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: conversation.otherUser.id } } as any)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.cardSoft,
              justifyContent: "center",
              alignItems: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
              {conversation.otherUser.name[0]}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
              {conversation.otherUser.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {conversation.otherUser.handle}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* メッセージ一覧 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.id;
          return (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 4,
                alignItems: isMine ? "flex-end" : "flex-start",
              }}
            >
              <View
                style={{
                  backgroundColor: isMine ? colors.accent : colors.card,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 18,
                  borderBottomRightRadius: isMine ? 4 : 18,
                  borderBottomLeftRadius: isMine ? 18 : 4,
                  maxWidth: "80%",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 20 }}>{item.text}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {dayjs(item.createdAt).format("HH:mm")}
                </Text>
                {isMine && item.isRead && (
                  <Text style={{ color: colors.accent, fontSize: 10 }}>既読</Text>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ color: colors.textMuted }}>メッセージがありません</Text>
          </View>
        }
      />

      {/* 入力欄 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="メッセージを入力..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            backgroundColor: colors.card,
            color: colors.text,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            paddingTop: 10,
            marginRight: 8,
            maxHeight: 100,
            fontSize: 15,
          }}
        />
        <Pressable
          onPress={onSend}
          disabled={!text.trim() || sending}
          style={{
            backgroundColor: text.trim() ? colors.accent : colors.cardSoft,
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="send" size={20} color={text.trim() ? colors.text : colors.textMuted} />
          )}
        </Pressable>
      </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
