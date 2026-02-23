import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { getAbsoluteImageUrl } from "../../config/api";
import { apiClient, type UserResponse } from "../../services/api";
import { LoadingScreen } from "../../components/LoadingScreen";

export default function FollowsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; type?: "followers" | "following" }>();
  const { user: currentUser } = useApp();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [type, setType] = useState<"followers" | "following">(
    (params.type as "followers" | "following") || "followers"
  );
  const targetUserId = params.userId ? parseInt(params.userId) : currentUser?.id ? parseInt(currentUser.id) : null;

  useEffect(() => {
    loadUsers();
    loadFollowingIds();
  }, [type, targetUserId]);

  const loadFollowingIds = async () => {
    if (!currentUser?.id) return;
    try {
      const following = await apiClient.getFollowing();
      setFollowingIds(new Set(following.map((u) => u.id)));
    } catch (error) {
      console.error("Failed to load following IDs:", error);
    }
  };

  const loadUsers = async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let data: UserResponse[];
      if (targetUserId === (currentUser?.id ? parseInt(currentUser.id) : null)) {
        // 自分のフォロワー/フォロー中
        if (type === "followers") {
          data = await apiClient.getFollowers();
        } else {
          data = await apiClient.getFollowing();
        }
      } else {
        // 他のユーザーのフォロワー/フォロー中
        if (type === "followers") {
          data = await apiClient.getUserFollowers(targetUserId);
        } else {
          data = await apiClient.getUserFollowing(targetUserId);
        }
      }
      setUsers(data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await apiClient.followUser(userId);
      setFollowingIds((prev) => new Set([...prev, userId]));
      await loadUsers();
    } catch (error) {
      console.error("Failed to follow user:", error);
    }
  };

  const handleUnfollow = async (userId: number) => {
    try {
      await apiClient.unfollowUser(userId);
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      await loadUsers();
    } catch (error) {
      console.error("Failed to unfollow user:", error);
    }
  };

  if (loading) {
    return <LoadingScreen message="読み込み中..." />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", flex: 1 }}>
          {type === "followers" ? "フォロワー" : "フォロー中"}
        </Text>
      </View>

      {/* タブ切り替え */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.card,
          padding: 4,
          margin: 16,
          borderRadius: 8,
        }}
      >
        <Pressable
          onPress={() => setType("followers")}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 6,
            backgroundColor: type === "followers" ? colors.accent : "transparent",
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color: type === "followers" ? colors.text : colors.textMuted,
              fontWeight: type === "followers" ? "600" : "400",
            }}
          >
            フォロワー
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType("following")}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 6,
            backgroundColor: type === "following" ? colors.accent : "transparent",
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color: type === "following" ? colors.text : colors.textMuted,
              fontWeight: type === "following" ? "600" : "400",
            }}
          >
            フォロー中
          </Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {users.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted }}>
              {type === "followers" ? "フォロワーはいません" : "フォローしている人はいません"}
            </Text>
          </View>
        ) : (
          users.map((user) => {
            const isCurrentUser = currentUser?.id === user.id.toString();
            const isFollowing = followingIds.has(user.id);

            return (
              <Pressable
                key={user.id}
                onPress={() =>
                  router.push({
                    pathname: "/profile/[id]",
                    params: { id: user.id.toString() },
                  } as any)
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                {getAbsoluteImageUrl(user.icon_url) ? (
                  <Image
                    source={{ uri: getAbsoluteImageUrl(user.icon_url)! }}
                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.accent,
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
                      {user.name?.[0] || "U"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                    {user.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>{user.handle}</Text>
                  {user.bio && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                      {user.bio}
                    </Text>
                  )}
                </View>
                {!isCurrentUser && currentUser && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      isFollowing ? handleUnfollow(user.id) : handleFollow(user.id);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isFollowing ? colors.cardSoft : colors.accent,
                      borderWidth: isFollowing ? 1 : 0,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: isFollowing ? colors.text : "#FFFFFF",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {isFollowing ? "フォロー中" : "フォロー"}
                    </Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
