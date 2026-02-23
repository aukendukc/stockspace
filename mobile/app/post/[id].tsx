import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { apiClient } from "../../services/api";
import { useApp } from "../../context/AppContext";
import { PostCard } from "../../components/PostCard";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ja";

dayjs.extend(relativeTime);
dayjs.locale("ja");

interface Comment {
  id: number;
  user_id: number;
  post_id: number;
  text: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    handle: string;
    icon_url?: string | null;
  };
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, posts, refreshPosts } = useApp();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");

  const post = posts.find((p) => p.id === id);

  const loadComments = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<Comment[]>(`/posts/${id}/comments`);
      setComments(data);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleComment = async () => {
    if (!commentText.trim() || !user || !id) return;

    setCommenting(true);
    try {
      const newComment = await apiClient.post<Comment>(`/posts/${id}/comments`, {
        text: commentText.trim(),
      });
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      // 投稿一覧を更新（コメント数を反映）
      refreshPosts();
    } catch (error: any) {
      Alert.alert("エラー", error.message || "コメントの送信に失敗しました");
    } finally {
      setCommenting(false);
    }
  };

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.textMuted }}>投稿が見つかりません</Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: colors.accent,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.text }}>戻る</Text>
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
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>投稿</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* 投稿本体 */}
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <PostCard post={post} />
        </View>

        {/* コメントセクション */}
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 }}>
            コメント {comments.length > 0 && `(${comments.length})`}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
          ) : comments.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 24,
                alignItems: "center",
              }}
            >
              <Ionicons name="chatbubble-outline" size={32} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 8 }}>コメントはまだありません</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {comments.map((comment) => (
                <View
                  key={comment.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: comment.user.id.toString() },
                      } as any)
                    }
                    style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.cardSoft,
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                        {comment.user.name[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
                        {comment.user.name}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                        {comment.user.handle}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {dayjs(comment.created_at).fromNow()}
                    </Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                    {comment.text}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* コメント入力欄 */}
      {user ? (
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
            value={commentText}
            onChangeText={setCommentText}
            placeholder="コメントを入力..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={{
              flex: 1,
              backgroundColor: colors.card,
              color: colors.text,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginRight: 8,
              maxHeight: 100,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={handleComment}
            disabled={!commentText.trim() || commenting}
            style={{
              backgroundColor: commentText.trim() ? colors.accent : colors.cardSoft,
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {commenting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="send" size={20} color={commentText.trim() ? "#fff" : colors.textMuted} />
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push("/auth/login")}
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>
            ログインしてコメントする
          </Text>
        </Pressable>
      )}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
