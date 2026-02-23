import { View, Text, ScrollView, Pressable, Switch, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { apiClient } from "../services/api";
import { STORAGE_KEYS } from "../constants/storageKeys";
import * as ImagePicker from "expo-image-picker";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useApp();
  const [darkMode, setDarkMode] = useState(true); // デフォルトはダークモード
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    handle: user?.handle || "",
    bio: user?.bio || "",
  });
  const [iconUploading, setIconUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        handle: user.handle || "",
        bio: user.bio || "",
      });
    }
  }, [user]);

  const handleLogout = async () => {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          await apiClient.logout();
          await AsyncStorage.setItem(STORAGE_KEYS.guestMode, "true");
          await refreshUser();
          router.replace("/(tabs)/home");
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const normalizedHandle = profileData.handle.startsWith("@")
        ? profileData.handle.trim()
        : `@${profileData.handle.trim()}`;
      await apiClient.updateProfile({
        name: profileData.name.trim(),
        handle: normalizedHandle,
        bio: profileData.bio.trim(),
      });
      Alert.alert("成功", "プロフィールを更新しました");
      setEditingProfile(false);
      await refreshUser();
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      Alert.alert("エラー", error.message || "プロフィールの更新に失敗しました");
    }
  };

  const handleChangeIcon = async () => {
    if (!user) {
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
      await refreshUser();
      Alert.alert("成功", "アイコンを更新しました");
    } catch (error: any) {
      console.error("Failed to update icon:", error);
      Alert.alert("エラー", error.message || "アイコンの更新に失敗しました");
    } finally {
      setIconUploading(false);
    }
  };

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
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>設定</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* プロフィール編集セクション */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              プロフィール編集
            </Text>
            <Pressable
              onPress={() => router.push("/profile/edit" as any)}
              style={{
                backgroundColor: colors.accent,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>編集画面へ</Text>
            </Pressable>
          </View>

          <View>
              <Text style={{ color: colors.text, fontSize: 16, marginBottom: 4 }}>
                {user?.name || "未設定"}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
                {user?.handle || "@未設定"}
              </Text>
              {user?.bio && (
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>{user.bio}</Text>
              )}
          </View>
        </View>

        {/* ダークモード切り替え */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="moon" size={24} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16 }}>ダークモード</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.cardSoft, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* その他の設定 */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => router.push("/notifications" as any)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16 }}>通知設定</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => Alert.alert("準備中", "この機能は準備中です")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="help-circle-outline" size={24} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16 }}>ヘルプ・サポート</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ログアウト */}
        {user && (
          <Pressable
            onPress={handleLogout}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "600" }}>ログアウト</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
