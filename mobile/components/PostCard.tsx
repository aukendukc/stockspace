import { View, Text, Pressable, Image, Alert, Modal, TextInput } from "react-native";
import { Post } from "../data/mockData";
import { colors } from "../theme/colors";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ja";
import { useApp } from "../context/AppContext";
import { getAbsoluteImageUrl } from "../config/api";

dayjs.extend(relativeTime);
dayjs.locale("ja");

export const PostCard = ({ post, hideActions = false }: { post: Post; hideActions?: boolean }) => {
  const router = useRouter();
  const { likePost, retweetPost, deletePost, user, refreshPosts } = useApp();
  const isBot = post.type === "bot";
  const isPurchase = post.type === "purchase";
  const isSale = post.type === "sale";
  const timestamp = post.createdAt ? dayjs(post.createdAt).format("M月D日 HH:mm") : "";
  const badgeLabel = isBot ? "BOT" : isPurchase ? "購入" : isSale ? "売却" : undefined;
  
  const [isLiking, setIsLiking] = useState(false);
  const [isRetweeting, setIsRetweeting] = useState(false);
  const [retweetModalVisible, setRetweetModalVisible] = useState(false);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [deleteMenuVisible, setDeleteMenuVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  
  // サーバーからの状態を使用
  const liked = post.isLiked || false;
  const retweeted = post.isRetweeted || false;
  const likes = post.likes || 0;
  const retweets = post.retweets || 0;
  
  const promptLogin = () => {
    Alert.alert(
      "ログインが必要です",
      "この機能を使うにはログインしてください",
      [
        { text: "キャンセル", style: "cancel" },
        { text: "ログイン", onPress: () => router.push("/auth/login") },
      ]
    );
  };
  
  const handleLike = useCallback(async () => {
    if (!user) {
      promptLogin();
      return;
    }
    if (isLiking) return;
    setIsLiking(true);
    try {
      await likePost(post.id);
    } catch (error) {
      console.error("Failed to like post:", error);
    } finally {
      setIsLiking(false);
    }
  }, [isLiking, user, likePost, post.id]);
  
  const handleRetweet = useCallback(() => {
    if (!user) {
      promptLogin();
      return;
    }
    // 既にリツイート済みの場合は削除
    if (retweeted) {
      Alert.alert(
        "リツイートを削除",
        "このリツイートを削除しますか？",
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "削除",
            style: "destructive",
            onPress: async () => {
              setIsRetweeting(true);
              try {
                await retweetPost(post.id);
                await refreshPosts();
              } catch (error) {
                console.error("Failed to delete retweet:", error);
                Alert.alert("エラー", "リツイートの削除に失敗しました");
              } finally {
                setIsRetweeting(false);
              }
            },
          },
        ]
      );
      return;
    }
    // リツイート選択モーダルを表示
    setRetweetModalVisible(true);
  }, [user, retweeted, retweetPost, post.id, refreshPosts]);

  const handleRepost = useCallback(async () => {
    if (!user) return;
    setRetweetModalVisible(false);
    setIsRetweeting(true);
    try {
      await retweetPost(post.id);
      await refreshPosts();
    } catch (error) {
      console.error("Failed to retweet post:", error);
      Alert.alert("エラー", "リツイートに失敗しました");
    } finally {
      setIsRetweeting(false);
    }
  }, [user, retweetPost, post.id, refreshPosts]);

  const handleQuote = useCallback(() => {
    if (!user) return;
    setRetweetModalVisible(false);
    setQuoteModalVisible(true);
  }, [user]);

  const handleQuoteSubmit = useCallback(async () => {
    if (!user || !quoteText.trim()) return;
    setIsRetweeting(true);
    try {
      const { apiClient } = await import("../../services/api");
      await apiClient.quotePost(parseInt(post.id), {
        text: quoteText.trim(),
        post_type: "user",
      });
      setQuoteModalVisible(false);
      setQuoteText("");
      await refreshPosts();
    } catch (error) {
      console.error("Failed to quote post:", error);
      Alert.alert("エラー", "引用リツイートに失敗しました");
    } finally {
      setIsRetweeting(false);
    }
  }, [user, quoteText, post.id, refreshPosts]);
  
  const handleComment = () => {
    router.push({
      pathname: "/post/[id]",
      params: { id: post.id },
    } as any);
  };

  // 削除メニューが表示されているとき、外側をタップしたら閉じる
  useEffect(() => {
    if (!deleteMenuVisible) return;
    
    const timeout = setTimeout(() => {
      // 5秒後に自動的に閉じる
      setDeleteMenuVisible(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [deleteMenuVisible]);

  return (
    <View>
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setImageModalVisible(false)}
        >
          {post.chartImage && (() => {
            const imageUri = getAbsoluteImageUrl(post.chartImage) ?? post.chartImage;
            return (
              <>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    (async () => {
                      try {
                        const FileSystem = (await import("expo-file-system")).default;
                        const dest = `${FileSystem.cacheDirectory}stockspace_${Date.now()}.jpg`;
                        await FileSystem.downloadAsync(imageUri, dest);
                        try {
                          const MediaLibrary = (await import("expo-media-library")).default;
                          const { status } = await MediaLibrary.requestPermissionsAsync();
                          if (status !== "granted") {
                            Alert.alert("保存しました", "画像をキャッシュに保存しました");
                            return;
                          }
                          await MediaLibrary.saveToLibraryAsync(dest);
                          Alert.alert("保存しました", "画像をフォトライブラリに保存しました");
                        } catch {
                          Alert.alert("保存しました", "画像をキャッシュに保存しました");
                        }
                      } catch (err: any) {
                        Alert.alert("保存に失敗しました", err?.message ?? String(err));
                      }
                    })();
                  }}
                  style={{
                    position: "absolute",
                    top: 48,
                    right: 16,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    padding: 12,
                    borderRadius: 24,
                  }}
                >
                  <Ionicons name="download-outline" size={24} color="#fff" />
                </Pressable>
              </>
            );
          })()}
        </Pressable>
      </Modal>

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
        }}
      >
      {/* リツイート表示 */}
      {post.retweetedBy && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/[id]",
              params: { id: post.retweetedBy!.id },
            } as any)
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Ionicons name="repeat" size={14} color="#00BA7C" style={{ marginRight: 6 }} />
          <Text style={{ color: "#00BA7C", fontSize: 12, fontWeight: "500" }}>
            {post.retweetedBy.name} がリツイート
          </Text>
        </Pressable>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/[id]",
              params: { id: post.user.id },
            } as any)
          }
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          {(getAbsoluteImageUrl(post.user.iconUrl) ?? post.user.iconUrl) ? (
            <Image
              source={{ uri: getAbsoluteImageUrl(post.user.iconUrl) ?? post.user.iconUrl! }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>
                {post.user.name?.[0] || "?"}
              </Text>
            </View>
          )}
          <View>
            <Text style={{ color: colors.text, fontSize: 14 }}>
              {post.user.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              {post.user.handle}
            </Text>
          </View>
        </Pressable>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
          <View style={{ alignItems: "flex-end" }}>
            {badgeLabel && (
              <View
                style={{
                  backgroundColor: colors.cardSoft,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  marginBottom: 4,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{badgeLabel}</Text>
              </View>
            )}
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timestamp}</Text>
          </View>
          {user && post.user.id === user.id && (
            <View style={{ position: "relative" }}>
              <Pressable
                onPress={() => setDeleteMenuVisible(!deleteMenuVisible)}
                style={{ padding: 4 }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
              <Modal
                visible={deleteMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteMenuVisible(false)}
              >
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => setDeleteMenuVisible(false)}
                >
                  <View style={{ flex: 1 }} />
                </Pressable>
              </Modal>
              {deleteMenuVisible && (
                <View
                  style={{
                    position: "absolute",
                    top: 28,
                    right: 0,
                    backgroundColor: colors.card,
                    borderRadius: 8,
                    padding: 4,
                    minWidth: 120,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                    zIndex: 1000,
                  }}
                >
                  <Pressable
                    onPress={async () => {
                      setDeleteMenuVisible(false);
                      Alert.alert(
                        "投稿を削除",
                        "この投稿を削除しますか？",
                        [
                          { text: "キャンセル", style: "cancel" },
                          {
                            text: "削除",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await deletePost(post.id);
                                await refreshPosts();
                              } catch (error) {
                                Alert.alert("エラー", "投稿の削除に失敗しました");
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      gap: 8,
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 14 }}>削除</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => {
          router.push({
            pathname: "/post/[id]",
            params: { id: post.id.toString() },
          } as any);
        }}
      >
        {/* 複数銘柄報告 */}
        {post.stockItems && post.stockItems.length > 0 && (
          <View style={{ marginBottom: 6, gap: 6 }}>
            {post.stockItems.map((item, idx) => (
              <Pressable
                key={`${item.stock.symbol}-${idx}`}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({
                    pathname: "/stock/[symbol]",
                    params: { symbol: item.stock.symbol },
                  } as any);
                }}
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  backgroundColor: colors.cardSoft,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{item.stock.name}</Text>
                <Text style={{ color: colors.accent, fontSize: 11 }}>{item.stock.symbol}</Text>
                {typeof item.stock.price === "number" && item.stock.price > 0 && (
                  <>
                    <Text style={{ color: colors.text, fontSize: 11 }}>¥{item.stock.price.toLocaleString()}</Text>
                    <Text style={{ color: (item.stock.changePct ?? 0) >= 0 ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                      {(item.stock.changePct ?? 0) >= 0 ? "+" : ""}{(item.stock.changePct ?? 0).toFixed(2)}%
                    </Text>
                  </>
                )}
                {(item.shares != null || item.price != null) && (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {item.shares != null && `${item.shares}株`}
                    {item.shares != null && item.price != null && " "}
                    {item.price != null && `¥${Number(item.price).toLocaleString()}`}
                  </Text>
                )}
                <Text style={{ color: colors.accent, fontSize: 10 }}>→ 株詳細</Text>
              </Pressable>
            ))}
          </View>
        )}
        {/* 単一銘柄（stockItems がない場合）・株名・株価・株詳細リンク */}
        {(!post.stockItems || post.stockItems.length === 0) && post.stock && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/stock/[symbol]",
                params: { symbol: post.stock!.symbol },
              } as any);
            }}
            style={{
              alignSelf: "flex-start",
              marginBottom: 6,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: colors.cardSoft,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{post.stock.name}</Text>
            <Text style={{ color: colors.accent, fontSize: 11 }}>{post.stock.symbol}</Text>
            {typeof post.stock.price === "number" && post.stock.price > 0 && (
              <>
                <Text style={{ color: colors.text, fontSize: 11 }}>¥{post.stock.price.toLocaleString()}</Text>
                <Text style={{ color: (post.stock.changePct ?? 0) >= 0 ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                  {(post.stock.changePct ?? 0) >= 0 ? "+" : ""}{(post.stock.changePct ?? 0).toFixed(2)}%
                </Text>
                {post.stock.high != null && (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>高値 ¥{(post.stock.high as number).toLocaleString()}</Text>
                )}
              </>
            )}
            <Text style={{ color: colors.accent, fontSize: 10 }}>→ 株詳細</Text>
          </Pressable>
        )}

        <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>
          {post.text}
        </Text>

        {post.chartImage && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setImageModalVisible(true);
            }}
          >
            <Image
              source={{ uri: getAbsoluteImageUrl(post.chartImage) ?? post.chartImage }}
              style={{
                width: "100%",
                height: 200,
                borderRadius: 12,
                marginBottom: 8,
                backgroundColor: colors.cardSoft,
              }}
              resizeMode="cover"
            />
          </Pressable>
        )}
      </Pressable>

      {/* 引用された投稿 */}
      {post.quotedPost && (
        <View
          style={{
            borderRadius: 12,
            backgroundColor: colors.cardSoft,
            padding: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            {(getAbsoluteImageUrl(post.quotedPost.user.iconUrl) ?? post.quotedPost.user.iconUrl) ? (
              <Image
                source={{ uri: getAbsoluteImageUrl(post.quotedPost.user.iconUrl) ?? post.quotedPost.user.iconUrl! }}
                style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8 }}
              />
            ) : (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 8,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 10 }}>
                  {post.quotedPost.user.name?.[0] || "?"}
                </Text>
              </View>
            )}
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
              {post.quotedPost.user.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 6 }}>
              {post.quotedPost.user.handle}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 13 }}>{post.quotedPost.text}</Text>
          {post.quotedPost.stock && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/stock/[symbol]",
                  params: { symbol: post.quotedPost!.stock!.symbol },
                } as any)
              }
              style={{ marginTop: 4 }}
            >
              <Text style={{ color: colors.accent, fontSize: 11 }}>
                {post.quotedPost.stock.name} {post.quotedPost.stock.symbol}
                {typeof post.quotedPost.stock.price === "number" && post.quotedPost.stock.price > 0 && (
                  <Text style={{ color: colors.textMuted }}> ¥{post.quotedPost.stock.price.toLocaleString()}</Text>
                )}
                {" → 株詳細"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 複数銘柄ブロック（下部） */}
      {post.stockItems && post.stockItems.length > 0 && (
        <View style={{ marginBottom: 6, gap: 8 }}>
          {post.stockItems.map((item, idx) => (
            <Pressable
              key={`${item.stock.symbol}-${idx}`}
              onPress={() =>
                router.push({
                  pathname: "/stock/[symbol]",
                  params: { symbol: item.stock.symbol },
                } as any)
              }
              style={{
                borderRadius: 12,
                backgroundColor: colors.cardSoft,
                padding: 10,
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{item.stock.name}</Text>
              <Text style={{ color: colors.accent, fontSize: 11 }}>{item.stock.symbol}</Text>
              {typeof item.stock.price === "number" && item.stock.price > 0 && (
                <>
                  <Text style={{ color: colors.text, fontSize: 11 }}>¥{item.stock.price.toLocaleString()}</Text>
                  <Text style={{ color: (item.stock.changePct ?? 0) >= 0 ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                    {(item.stock.changePct ?? 0) >= 0 ? "+" : ""}{(item.stock.changePct ?? 0).toFixed(2)}%
                  </Text>
                </>
              )}
              {(item.shares != null || item.price != null) && (
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {item.shares != null && `${item.shares}株`}
                  {item.shares != null && item.price != null && " "}
                  {item.price != null && `¥${Number(item.price).toLocaleString()}`}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
      {(!post.stockItems || post.stockItems.length === 0) && post.stock && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/stock/[symbol]",
              params: { symbol: post.stock!.symbol },
            } as any)
          }
          style={{
            borderRadius: 12,
            backgroundColor: colors.cardSoft,
            padding: 10,
            marginBottom: 6,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{post.stock.name}</Text>
          <Text style={{ color: colors.accent, fontSize: 11 }}>{post.stock.symbol}</Text>
          {typeof post.stock.price === "number" && post.stock.price > 0 && (
            <>
              <Text style={{ color: colors.text, fontSize: 11 }}>¥{post.stock.price.toLocaleString()}</Text>
              <Text style={{ color: (post.stock.changePct ?? 0) >= 0 ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                {(post.stock.changePct ?? 0) >= 0 ? "+" : ""}{(post.stock.changePct ?? 0).toFixed(2)}%
              </Text>
              {post.stock.high != null && (
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>高値 ¥{(post.stock.high as number).toLocaleString()}</Text>
              )}
            </>
          )}
        </Pressable>
      )}

      {/* アクションバー */}
      {!hideActions && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-start",
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 24,
          }}
        >
          {/* コメント */}
          <Pressable
            onPress={handleComment}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {post.comments || 0}
            </Text>
          </Pressable>

          {/* リツイート */}
          <Pressable
            onPress={handleRetweet}
            disabled={isRetweeting}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: isRetweeting ? 0.5 : 1 }}
          >
            <Ionicons
              name="repeat"
              size={18}
              color={retweeted ? "#00BA7C" : colors.textMuted}
            />
            <Text style={{ color: retweeted ? "#00BA7C" : colors.textMuted, fontSize: 13 }}>
              {retweets}
            </Text>
          </Pressable>

          {/* いいね */}
          <Pressable
            onPress={handleLike}
            disabled={isLiking}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: isLiking ? 0.5 : 1 }}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={18}
              color={liked ? "#F91880" : colors.textMuted}
            />
            <Text style={{ color: liked ? "#F91880" : colors.textMuted, fontSize: 13 }}>
              {likes}
            </Text>
          </Pressable>

        </View>
      )}
      </View>

      {/* リツイート選択モーダル */}
      <Modal
        visible={retweetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRetweetModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setRetweetModalVisible(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 24,
              width: "80%",
              maxWidth: 400,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 20 }}>
              リツイート
            </Text>
            <Pressable
              onPress={handleRepost}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons name="repeat" size={24} color="#00BA7C" style={{ marginRight: 12 }} />
              <Text style={{ color: colors.text, fontSize: 16 }}>リポスト</Text>
            </Pressable>
            <Pressable
              onPress={handleQuote}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
              }}
            >
              <Ionicons name="create-outline" size={24} color={colors.accent} style={{ marginRight: 12 }} />
              <Text style={{ color: colors.text, fontSize: 16 }}>引用</Text>
            </Pressable>
            <Pressable
              onPress={() => setRetweetModalVisible(false)}
              style={{
                marginTop: 12,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.cardSoft,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>キャンセル</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 引用リツイートモーダル */}
      <Modal
        visible={quoteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setQuoteModalVisible(false);
          setQuoteText("");
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => {
                setQuoteModalVisible(false);
                setQuoteText("");
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>キャンセル</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>引用リツイート</Text>
            <Pressable
              onPress={handleQuoteSubmit}
              disabled={!quoteText.trim() || isRetweeting}
              style={{
                backgroundColor: colors.accent,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                opacity: !quoteText.trim() || isRetweeting ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>投稿</Text>
            </Pressable>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              multiline
              value={quoteText}
              onChangeText={setQuoteText}
              placeholder="いま何を考えている？"
              placeholderTextColor={colors.textMuted}
              style={{
                minHeight: 100,
                borderRadius: 16,
                backgroundColor: colors.card,
                color: colors.text,
                padding: 16,
                fontSize: 16,
                marginBottom: 16,
              }}
            />
            {/* 引用される元の投稿 */}
            <View
              style={{
                borderRadius: 12,
                backgroundColor: colors.cardSoft,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                {post.user.iconUrl ? (
                  <Image
                    source={{ uri: post.user.iconUrl }}
                    style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.accent,
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 10 }}>
                      {post.user.name?.[0] || "?"}
                    </Text>
                  </View>
                )}
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {post.user.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 6 }}>
                  {post.user.handle}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 13 }}>{post.text}</Text>
              {post.stock && (
                <Text style={{ color: colors.accent, fontSize: 11, marginTop: 4 }}>
                  {post.stock.symbol}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
