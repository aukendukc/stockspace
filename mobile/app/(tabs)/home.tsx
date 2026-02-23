import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { PostCard } from "../../components/PostCard";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ErrorScreen } from "../../components/ErrorScreen";
import { useState, useEffect } from "react";
import { SwipeableTabsWrapper } from "../../components/SwipeableTabsWrapper";
import { Image } from "react-native";

export default function HomeScreen() {
  const { posts, loading, error, refreshPosts, rankings, refreshRankings, user } = useApp();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const timelinePreview = posts.slice(0, 5);
  const popularStocks = rankings?.topGainers?.slice(0, 5) || [];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshPosts(), refreshRankings()]);
      if (user) {
        const { count } = await import("../../services/api").then((m) =>
          m.apiClient.getUnreadNotificationCount()
        );
        setUnreadCount(count);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // 初回・user変更時に未読数取得
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    import("../../services/api")
      .then((m) => m.apiClient.getUnreadNotificationCount())
      .then(({ count }) => setUnreadCount(count))
      .catch(() => {});
  }, [user]);

  if (loading && posts.length === 0) {
    return (
      <SwipeableTabsWrapper>
        <LoadingScreen message="データを読み込み中..." />
      </SwipeableTabsWrapper>
    );
  }

  if (error && posts.length === 0) {
    return (
      <SwipeableTabsWrapper>
        <ErrorScreen message={error} onRetry={onRefresh} />
      </SwipeableTabsWrapper>
    );
  }

  return (
    <SwipeableTabsWrapper>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* ヘッダー: ホーム + 通知 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>ホーム</Text>
              <Pressable
                style={{ position: "relative", padding: 8 }}
                onPress={() =>
                  user ? router.push("/notifications" as any) : router.push("/auth/login" as any)
                }
              >
                <Ionicons name="notifications-outline" size={24} color={colors.text} />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.danger,
                    }}
                  />
                )}
              </Pressable>
            </View>

            {/* 検索バー */}
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 16,
              }}
              onPress={() => router.push("/search" as any)}
            >
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginLeft: 10, fontSize: 15 }}>
                銘柄を検索...
              </Text>
            </Pressable>

            {/* 人気銘柄 */}
            <View style={{ marginBottom: 20 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="trending-up" size={20} color={colors.success} />
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                    人気銘柄
                  </Text>
                </View>
                <Pressable onPress={() => router.push("/(tabs)/stock" as any)}>
                  <Text style={{ color: colors.accent, fontSize: 14 }}>すべて見る &gt;</Text>
                </Pressable>
              </View>
              {popularStocks.length > 0 ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {popularStocks.slice(0, 5).map((entry: any) => (
                    <Pressable
                      key={entry.symbol}
                      onPress={() => router.push(`/stock/${entry.symbol}` as any)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <Text
                        style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}
                        numberOfLines={1}
                      >
                        {entry.symbol}
                      </Text>
                      <Text
                        style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {entry.name}
                      </Text>
                      <Text
                        style={{
                          color: entry.change_pct >= 0 ? colors.success : colors.danger,
                          fontSize: 11,
                          fontWeight: "600",
                          marginTop: 4,
                        }}
                      >
                        {entry.change_pct >= 0 ? "+" : ""}
                        {entry.change_pct?.toFixed(2)}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>データを読み込み中...</Text>
                </View>
              )}
            </View>

            {/* 投稿作成ウィジェット */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 14,
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Pressable
                  onPress={() => (user ? router.push("/profile/profile" as any) : router.push("/auth/login" as any))}
                  style={{ marginRight: 12 }}
                >
                  {user?.iconUrl ? (
                    <Image
                      source={{ uri: user.iconUrl }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.accent,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                        {user?.name?.[0] || "?"}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() =>
                    user ? router.push("/post/new" as any) : router.push("/auth/login" as any)
                  }
                >
                  <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                    いま何を考えていますか?
                  </Text>
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", gap: 20 }}>
                  <Pressable
                    onPress={() =>
                      user ? router.push("/post/new" as any) : router.push("/auth/login" as any)
                    }
                  >
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      user ? router.push("/post/new" as any) : router.push("/auth/login" as any)
                    }
                  >
                    <Ionicons name="bar-chart-outline" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() =>
                    user ? router.push("/post/new" as any) : router.push("/auth/login" as any)
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.accent,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    gap: 6,
                  }}
                >
                  <Ionicons name="send" size={16} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>投稿</Text>
                </Pressable>
              </View>
            </View>

            {/* タイムライン */}
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 }}>
              タイムライン
            </Text>
            {timelinePreview.length > 0 ? (
              timelinePreview.map((p, index) => (
                <PostCard
                  key={`${p.id}-${p.retweetedBy?.id || "original"}-${index}`}
                  post={p}
                />
              ))
            ) : (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 32,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>投稿がありません</Text>
                <Pressable
                  onPress={() =>
                    user ? router.push("/post/new" as any) : router.push("/auth/login" as any)
                  }
                  style={{
                    marginTop: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    backgroundColor: colors.accent,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                    最初の投稿をする
                  </Text>
                </Pressable>
              </View>
            )}
            {timelinePreview.length > 0 && (
              <Pressable
                onPress={() => router.push("/(tabs)/sns")}
                style={{
                  marginTop: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 14 }}>続きを見る</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SwipeableTabsWrapper>
  );
}
