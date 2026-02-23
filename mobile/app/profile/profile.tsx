import { View, Text, Pressable, ScrollView, Alert, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useApp, type AppUser } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { PostCard } from "../../components/PostCard";
import { Portfolio } from "../../data/mockData";
import { apiClient } from "../../services/api";
import { LoadingScreen } from "../../components/LoadingScreen";
import { STORAGE_KEYS } from "../../constants/storageKeys";

type Tab = "投稿" | "ポートフォリオ" | "いいね";

export default function ProfileScreen() {
  const { posts, portfolios, user: appUser, refreshUser } = useApp();
  const [tab, setTab] = useState<Tab>("投稿");
  const [profileUser, setProfileUser] = useState<AppUser | null>(appUser);
  const router = useRouter();
  const pf: Portfolio | undefined = portfolios[0];
  const [iconUploading, setIconUploading] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(appUser?.iconUrl ?? undefined);
  const [loadingUser, setLoadingUser] = useState(!appUser);
  const [isLoggedIn, setIsLoggedIn] = useState(!!appUser);
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
  const [loadingFollows, setLoadingFollows] = useState(false);

  useEffect(() => {
    setProfileUser(appUser);
    setAvatar(appUser?.iconUrl ?? undefined);
    setIsLoggedIn(!!appUser);
  }, [appUser]);

  const loadFollowCounts = useCallback(async () => {
    try {
      setLoadingFollows(true);
      const [following, followers] = await Promise.all([
        apiClient.getFollowing(),
        apiClient.getFollowers(),
      ]);
      setFollowCounts({
        following: Array.isArray(following) ? following.length : 0,
        followers: Array.isArray(followers) ? followers.length : 0,
      });
    } catch (error) {
      console.error("Failed to load follow counts:", error);
      setFollowCounts({ following: 0, followers: 0 });
    } finally {
      setLoadingFollows(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setLoadingUser(true);
      const refreshed = await refreshUser();
      setProfileUser(refreshed);
      setAvatar(refreshed?.iconUrl ?? undefined);
      setIsLoggedIn(!!refreshed);
      if (refreshed) {
        await loadFollowCounts();
      } else {
        setFollowCounts({ following: 0, followers: 0 });
      }
    } catch (error) {
      console.error("Error loading user:", error);
      setIsLoggedIn(false);
    } finally {
      setLoadingUser(false);
    }
  }, [refreshUser, loadFollowCounts]);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleChangeIcon = async () => {
    if (!isLoggedIn) {
      Alert.alert("ログインが必要です", "アイコンを変更するにはログインしてください。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // MediaType は一部バージョンで未定義になるため、警告は出るが安定して動く MediaTypeOptions を使用
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setIconUploading(true);
      const uri = result.assets[0].uri;
      const uploaded = await apiClient.uploadImage(uri);
      await apiClient.updateIcon(uploaded);
      setAvatar(uploaded);
      await loadUser();
      Alert.alert("成功", "アイコンを更新しました");
    } catch (error: any) {
      console.error("Failed to update icon:", error);
      Alert.alert("エラー", error.message || "アイコンの更新に失敗しました");
    } finally {
      setIconUploading(false);
    }
  };

  const handleLogout = async () => {
    if (!isLoggedIn) {
      router.push("/login" as any);
      return;
    }
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          await apiClient.logout();
          await AsyncStorage.setItem(STORAGE_KEYS.guestMode, "true");
          await refreshUser();
          setFollowCounts({ following: 0, followers: 0 });
          router.replace("/(tabs)/home");
        },
      },
    ]);
  };

  const myPosts = profileUser
    ? posts.filter((p) => p.user.id === profileUser.id?.toString())
    : [];
  const likedPosts = posts.filter((p) => p.isLiked);

  if (loadingUser && !profileUser) {
    return <LoadingScreen message="プロフィールを読み込み中..." />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* ヘッダー: プロフィール + アイコン */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>プロフィール</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => router.push("/messages" as any)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings" as any)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* プロフィールカード */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Pressable onPress={handleChangeIcon} style={{ position: "relative" }}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: "600" }}>
                  {profileUser?.name?.[0] || "U"}
                </Text>
              </View>
            )}
          </Pressable>
          {iconUploading && (
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>アイコンを更新中...</Text>
            </View>
          )}
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: "600",
              marginTop: 12,
            }}
          >
            {profileUser?.name || "Guest"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {profileUser?.handle || "@guest"}
          </Text>

          {/* 統計: 投稿 / フォロワー / フォロー中 */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 16,
              gap: 20,
              justifyContent: "center",
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                {myPosts.length}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>投稿</Text>
            </View>
            <Pressable
              onPress={() => {
                if (profileUser?.id) {
                  router.push({
                    pathname: "/profile/follows",
                    params: { userId: profileUser.id.toString(), type: "followers" },
                  } as any);
                }
              }}
              style={{ alignItems: "center" }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                {loadingFollows ? "…" : followCounts.followers}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>フォロワー</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (profileUser?.id) {
                  router.push({
                    pathname: "/profile/follows",
                    params: { userId: profileUser.id.toString(), type: "following" },
                  } as any);
                }
              }}
              style={{ alignItems: "center" }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                {loadingFollows ? "…" : followCounts.following}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>フォロー中</Text>
            </Pressable>
          </View>

          {/* プロフィール編集ボタン */}
          <Pressable
            onPress={() =>
              isLoggedIn
                ? router.push("/profile/edit" as any)
                : router.push("/auth/login" as any)
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 16,
              backgroundColor: colors.cardSoft,
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 12,
              gap: 8,
            }}
          >
            <Ionicons name="pencil" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
              プロフィール編集
            </Text>
          </Pressable>

          {!isLoggedIn && (
            <Pressable
              onPress={() => router.push("/auth/login" as any)}
              style={{
                marginTop: 12,
                backgroundColor: colors.accent,
                paddingVertical: 10,
                paddingHorizontal: 24,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                ログイン / 会員登録
              </Text>
            </Pressable>
          )}
        </View>

        {/* タブ: 投稿 / ポートフォリオ / いいね */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.card,
            borderRadius: 10,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {(["投稿", "ポートフォリオ", "いいね"] as Tab[]).map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: active ? colors.text : "transparent",
                }}
              >
                {t === "投稿" && (
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={active ? colors.bg : colors.textMuted}
                  />
                )}
                <Text
                  style={{
                    textAlign: "center",
                    color: active ? colors.bg : colors.text,
                    fontSize: 14,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* コンテンツ：投稿 */}
        {tab === "投稿" && (
          <>
            {myPosts.length > 0 ? (
              myPosts.map((p, index) => (
                <PostCard key={`${p.id}-${p.retweetedBy?.id || "original"}-${index}`} post={p} />
              ))
            ) : (
              <View style={{ padding: 32, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>投稿がありません</Text>
              </View>
            )}
          </>
        )}

        {/* コンテンツ：ポートフォリオ */}
        {tab === "ポートフォリオ" && (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
            {pf?.holdings && pf.holdings.length > 0 ? (
              pf.holdings.map((h: Portfolio["holdings"][number]) => (
                <View
                  key={h.stock.symbol}
                  style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <View>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{h.stock.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{h.stock.symbol}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>¥{(h.shares * h.stock.price).toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>ポートフォリオがありません</Text>
                <Pressable onPress={() => router.push("/portfolio/new" as any)} style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.accent, borderRadius: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>ポートフォリオを作成</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* コンテンツ：いいね */}
        {tab === "いいね" && (
          <>
            {likedPosts.length > 0 ? (
              likedPosts.map((p, index) => (
                <PostCard key={`${p.id}-like-${index}`} post={p} />
              ))
            ) : (
              <View style={{ padding: 32, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>いいねした投稿がありません</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
