import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { PostCard } from "../../components/PostCard";
import { SwipeableTabsWrapper } from "../../components/SwipeableTabsWrapper";

const tabs = ["すべて", "購入", "売却"] as const;
type Tab = (typeof tabs)[number];

export default function SnsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("すべて");
  const [refreshing, setRefreshing] = useState(false);
  const { posts, refreshPosts, user } = useApp();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshPosts();
    } catch (error) {
      console.error("Failed to refresh posts:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshPosts]);

  const filtered =
    tab === "すべて"
      ? posts
      : tab === "購入"
      ? posts.filter((p) => p.type === "purchase")
      : posts.filter((p) => p.type === "sale");

  return (
    <SwipeableTabsWrapper>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {/* ヘッダー: タイムライン + 新規投稿ボタン */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 16,
              paddingBottom: 12,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
              タイムライン
            </Text>
            <Pressable
              onPress={() => (user ? router.push("/post/new") : router.push("/auth/login"))}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="add" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* タブ: すべて / 購入 / 売却 */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.card,
              borderRadius: 10,
              padding: 4,
              marginBottom: 12,
            }}
          >
            {tabs.map((t) => {
              const active = t === tab;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: active ? colors.text : "transparent",
                  }}
                >
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

          {/* 投稿リスト */}
          {filtered.length === 0 ? (
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.accent}
                />
              }
              contentContainerStyle={{ flex: 1, justifyContent: "center", paddingVertical: 48 }}
            >
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 32,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                  {tab === "すべて" ? "表示する投稿がありません" : `${tab}の投稿がありません`}
                </Text>
                <Pressable
                  onPress={() => (user ? router.push("/post/new") : router.push("/auth/login"))}
                  style={{
                    marginTop: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    backgroundColor: colors.accent,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                    投稿する
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.accent}
                />
              }
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {filtered.map((p, index) => (
                <PostCard
                  key={`${p.id}-${p.retweetedBy?.id || "original"}-${index}`}
                  post={p}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </SwipeableTabsWrapper>
  );
}
