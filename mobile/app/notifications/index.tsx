import { View, Text, FlatList, Pressable, Image, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { colors } from "../../theme/colors";
import { getAbsoluteImageUrl } from "../../config/api";
import { apiClient } from "../../services/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ja";
import { useApp } from "../../context/AppContext";

dayjs.extend(relativeTime);
dayjs.locale("ja");

export interface NotificationItem {
  id: number;
  type: string;
  actor_id: number;
  actor_name: string;
  actor_handle: string;
  actor_icon_url: string | null;
  post_id: number | null;
  post_text: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useApp();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiClient.getNotifications();
      setNotifications(data);
      const count = await apiClient.getUnreadNotificationCount();
      setUnreadCount(count.count);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setLoading(false);
    }
  }, [user, loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = async (id: number) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handlePress = (n: NotificationItem) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.type === "like" && n.post_id) {
      router.push(`/post/${n.post_id}` as any);
    } else if (n.type === "follow") {
      router.push(`/profile/${n.actor_id}` as any);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: 16, alignItems: "center", marginTop: 40 }}>
          <Text style={{ color: colors.textMuted, marginBottom: 16 }}>
            通知を表示するにはログインしてください
          </Text>
          <Pressable
            onPress={() => router.push("/auth/login")}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>ログイン</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const label =
      item.type === "like"
        ? "があなたの投稿にいいねしました"
        : "があなたをフォローしました";
    const time = item.created_at ? dayjs(item.created_at).fromNow() : "";

    return (
      <Pressable
        onPress={() => handlePress(item)}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          padding: 16,
          backgroundColor: item.is_read ? "transparent" : colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.push(`/profile/${item.actor_id}` as any)}>
          {getAbsoluteImageUrl(item.actor_icon_url) ? (
            <Image
              source={{ uri: getAbsoluteImageUrl(item.actor_icon_url)! }}
              style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                {item.actor_name?.[0] || "?"}
              </Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15 }}>
            <Text style={{ fontWeight: "600" }}>{item.actor_name}</Text>
            {label}
          </Text>
          {item.post_text && (
            <Text
              style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}
              numberOfLines={2}
            >
              {item.post_text}
            </Text>
          )}
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            {time}
          </Text>
        </View>
        {!item.is_read && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
              marginTop: 18,
              marginLeft: 8,
            }}
          />
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", flex: 1 }}>
          通知
        </Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead}>
            <Text style={{ color: colors.accent, fontSize: 14 }}>すべて既読にする</Text>
          </Pressable>
        )}
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.textMuted }}>読み込み中...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="notifications-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 16 }}>通知はありません</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </SafeAreaView>
  );
}
