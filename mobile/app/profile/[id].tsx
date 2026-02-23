import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Alert, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { getAbsoluteImageUrl } from "../../config/api";
import { apiClient } from "../../services/api";
import { useApp } from "../../context/AppContext";
import { useMessages } from "../../context/MessageContext";
import { PostCard } from "../../components/PostCard";
import { StockRow } from "../../components/StockRow";

type Tab = "投稿" | "ポートフォリオ";

export default function OtherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser, posts } = useApp();
  const { startConversation } = useMessages();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [dmText, setDmText] = useState("");
  const [tab, setTab] = useState<Tab>("投稿");
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
  const [otherPortfolios, setOtherPortfolios] = useState<any[]>([]);

  useEffect(() => {
    loadUserProfile();
  }, [id]);

  const loadUserProfile = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // ユーザー情報を取得
      const userData = await apiClient.getUserById(parseInt(id));
      setProfileUser(userData);
      
      // フォロー状態を確認
      const following = await apiClient.getFollowing();
      setIsFollowing(Array.isArray(following) && following.some((u: any) => u.id === parseInt(id)));
      
      // フォロー数
      const [followingList, followersList, portfoliosData] = await Promise.all([
        apiClient.getFollowing(),
        apiClient.getFollowers(),
        apiClient.getPortfolios({ user_id: parseInt(id) }).catch(() => []),
      ]);
      setFollowCounts({
        following: Array.isArray(followingList) ? followingList.length : 0,
        followers: Array.isArray(followersList) ? followersList.length : 0,
      });
      setOtherPortfolios(Array.isArray(portfoliosData) ? portfoliosData.filter((p: any) => p.is_public) : []);
    } catch (error) {
      console.error("Error loading user profile:", error);
      Alert.alert("エラー", "ユーザー情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!id || !currentUser) {
      Alert.alert("エラー", "ログインが必要です");
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await apiClient.unfollowUser(parseInt(id));
        setIsFollowing(false);
        setFollowCounts((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await apiClient.followUser(parseInt(id));
        setIsFollowing(true);
        setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (error: any) {
      Alert.alert("エラー", error.message || "フォロー操作に失敗しました");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSendDM = async () => {
    if (!id || !currentUser || !dmText.trim()) return;

    setDmLoading(true);
    try {
      const conversation = await startConversation(id, dmText.trim());
      if (conversation) {
        setShowDmModal(false);
        setDmText("");
        router.push({
          pathname: "/messages/[id]",
          params: { id: conversation.id },
        } as any);
      } else {
        Alert.alert("エラー", "メッセージの送信に失敗しました");
      }
    } catch (error: any) {
      Alert.alert("エラー", error.message || "メッセージの送信に失敗しました");
    } finally {
      setDmLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profileUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Ionicons name="person-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 16 }}>ユーザーが見つかりませんでした</Text>
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
      </SafeAreaView>
    );
  }

  const userPosts = posts.filter((p) => p.user.id === id);
  const isOwnProfile = currentUser?.id === id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* ヘッダー */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", flex: 1 }}>
            {profileUser.name || "ユーザー"}
          </Text>
        </View>

        {/* プロフィール情報 */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          {getAbsoluteImageUrl(profileUser.icon_url) ? (
            <Image
              source={{ uri: getAbsoluteImageUrl(profileUser.icon_url)! }}
              style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }}
            />
          ) : (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.card,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Ionicons name="person" size={40} color={colors.textMuted} />
            </View>
          )}

          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}>
            {profileUser.name || "ユーザー"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
            {profileUser.handle || "@user"}
          </Text>
          {profileUser.bio && (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
              {profileUser.bio}
            </Text>
          )}

          <View style={{ flexDirection: "row", marginTop: 16, gap: 16 }}>
            <Pressable
              onPress={() => {
                // フォロー中一覧画面へ（後で実装）
              }}
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                フォロー中: {followCounts.following}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // フォロワー一覧画面へ（後で実装）
              }}
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                フォロワー: {followCounts.followers}
              </Text>
            </Pressable>
          </View>

          {!isOwnProfile && currentUser && (
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={handleFollow}
                disabled={followLoading}
                style={{
                  backgroundColor: isFollowing ? colors.card : colors.accent,
                  borderRadius: 20,
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                  minWidth: 100,
                  alignItems: "center",
                  opacity: followLoading ? 0.6 : 1,
                }}
              >
                {followLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                    {isFollowing ? "フォロー中" : "フォロー"}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setShowDmModal(true)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name="mail-outline" size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>DM</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* タブ */}
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: 12,
          }}
        >
          {(["投稿", "ポートフォリオ"] as Tab[]).map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderBottomColor: active ? colors.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? colors.accent : colors.textMuted,
                    fontSize: 14,
                    fontWeight: active ? "600" : "400",
                    textAlign: "center",
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* タブコンテンツ */}
        {tab === "投稿" && (
          <View>
            {userPosts.length > 0 ? (
              userPosts.map((post, index) => <PostCard key={`${post.id}-${post.retweetedBy?.id || 'original'}-${index}`} post={post} />)
            ) : (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 32,
                  alignItems: "center",
                }}
              >
                <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 16 }}>
                  投稿がありません
                </Text>
              </View>
            )}
          </View>
        )}

        {tab === "ポートフォリオ" && (
          <View>
            {otherPortfolios.length === 0 ? (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 32, alignItems: "center" }}>
                <Ionicons name="briefcase-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12 }}>公開されているポートフォリオはありません</Text>
              </View>
            ) : (
              otherPortfolios.map((portfolio: any) => (
                <View key={portfolio.id} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 }}>{portfolio.name}</Text>
                  {(portfolio.holdings || []).map((h: any) => (
                    <View key={h.stock?.symbol} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View>
                        <Text style={{ color: colors.text, fontSize: 14 }}>{h.stock?.name || ""}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{h.stock?.symbol || ""} ・ {h.shares} 株</Text>
                      </View>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>¥{((h.shares || 0) * (h.stock?.price || 0)).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* DM送信モーダル */}
      <Modal
        visible={showDmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDmModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>
                {profileUser?.name}にDMを送る
              </Text>
              <Pressable onPress={() => setShowDmModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextInput
              value={dmText}
              onChangeText={setDmText}
              placeholder="メッセージを入力..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              style={{
                backgroundColor: colors.card,
                color: colors.text,
                borderRadius: 16,
                padding: 16,
                minHeight: 100,
                maxHeight: 200,
                fontSize: 15,
                marginBottom: 16,
              }}
            />
            <Pressable
              onPress={handleSendDM}
              disabled={!dmText.trim() || dmLoading}
              style={{
                backgroundColor: dmText.trim() ? colors.accent : colors.cardSoft,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              {dmLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                  送信
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
