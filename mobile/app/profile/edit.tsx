import { View, Text, TextInput, Pressable, ScrollView, Alert, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../../context/AppContext";
import { colors } from "../../theme/colors";
import { apiClient } from "../../services/api";
import { Ionicons } from "@expo/vector-icons";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useApp();
  const [name, setName] = useState(user?.name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [iconUploading, setIconUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(user?.iconUrl ?? undefined);

  useEffect(() => {
    if (!user) {
      Alert.alert("ログインが必要です", "プロフィールを編集するにはログインしてください。", [
        { text: "OK", onPress: () => router.replace("/auth/login" as any) },
      ]);
    }
  }, [user, router]);

  const handleChangeIcon = async () => {
    if (!user) {
      Alert.alert("ログインが必要です", "アイコンを変更するにはログインしてください。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // 正方形にクロップ
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setIconUploading(true);
      const uri = result.assets[0].uri;
      const uploaded = await apiClient.uploadImage(uri);
      await apiClient.updateIcon(uploaded);
      setAvatar(uploaded);
      await refreshUser();
      Alert.alert("成功", "アイコンを更新しました");
    } catch (error: any) {
      console.error("Failed to update icon:", error);
      Alert.alert("エラー", error.message || "アイコンの更新に失敗しました");
    } finally {
      setIconUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert("ログインが必要です", "プロフィールを編集するにはログインしてください。");
      return;
    }
    if (!name.trim()) {
      Alert.alert("エラー", "表示名を入力してください");
      return;
    }
    if (!handle.trim()) {
      Alert.alert("エラー", "ハンドルを入力してください");
      return;
    }

    setSaving(true);
    try {
      const normalizedHandle = handle.startsWith("@") ? handle.trim() : `@${handle.trim()}`;
      await apiClient.updateProfile({
        name: name.trim(),
        handle: normalizedHandle,
        bio: bio.trim(),
      });
      await refreshUser();
      Alert.alert("成功", "プロフィールを更新しました");
      router.back();
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      Alert.alert("エラー", error.message || "プロフィールの更新に失敗しました");
    } finally {
      setSaving(false);
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
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", flex: 1 }}>プロフィール編集</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.accent,
            opacity: saving ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 14 }}>保存</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* アイコン */}
        <View
          style={{
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Pressable onPress={handleChangeIcon} style={{ position: "relative" }}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 32, fontWeight: "600" }}>
                  {user?.name?.[0] || "U"}
                </Text>
              </View>
            )}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 6,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="camera" size={18} color={colors.text} />
            </View>
          </Pressable>
          {iconUploading && (
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>アイコンを更新中...</Text>
            </View>
          )}
        </View>

        {/* フォーム */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>表示名</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={{
              backgroundColor: colors.card,
              borderRadius: 8,
              padding: 12,
              color: colors.text,
              fontSize: 16,
            }}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>ハンドル (@handle)</Text>
          <TextInput
            value={handle}
            onChangeText={setHandle}
            style={{
              backgroundColor: colors.card,
              borderRadius: 8,
              padding: 12,
              color: colors.text,
              fontSize: 16,
            }}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>自己紹介</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: colors.card,
              borderRadius: 8,
              padding: 12,
              color: colors.text,
              fontSize: 16,
              minHeight: 100,
              textAlignVertical: "top",
            }}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

