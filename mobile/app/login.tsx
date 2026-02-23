import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { apiClient } from "../services/api";
import { useApp } from "../context/AppContext";
import { STORAGE_KEYS } from "../constants/storageKeys";

export default function LoginScreen() {
  const router = useRouter();
  const { refreshUser } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    name: "",
    handle: "",
    bio: "",
  });

  const handleSubmit = async () => {
    if (isLogin) {
      // ログイン
      if (!formData.username || !formData.password) {
        Alert.alert("エラー", "ユーザー名とパスワードを入力してください");
        return;
      }

      setLoading(true);
      try {
        await apiClient.login(formData.username, formData.password);
        await AsyncStorage.removeItem(STORAGE_KEYS.guestMode);
        await refreshUser();
        router.replace("/(tabs)/home");
      } catch (error: any) {
        const errorMessage = error.message || "ユーザー名またはパスワードが正しくありません";
        console.error("Login error:", error);
        Alert.alert("ログイン失敗", errorMessage);
      } finally {
        setLoading(false);
      }
    } else {
      // 登録
      if (!formData.username || !formData.password || !formData.email || !formData.name || !formData.handle) {
        Alert.alert("エラー", "すべての必須項目を入力してください");
        return;
      }

      setLoading(true);
      try {
        await apiClient.register({
          username: formData.username,
          password: formData.password,
          email: formData.email,
          name: formData.name,
          handle: formData.handle,
          bio: formData.bio || undefined,
        });
        // 登録後、自動ログイン（Supabaseはemail必須のためemailで試行）
        await apiClient.login(formData.email, formData.password);
        await AsyncStorage.removeItem(STORAGE_KEYS.guestMode);
        await refreshUser();
        router.replace("/(tabs)/home");
      } catch (error: any) {
        const errorMessage = error.message || "登録に失敗しました";
        console.error("Registration error:", error);
        Alert.alert("登録失敗", errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSkip = async () => {
    try {
      await apiClient.logout();
      await AsyncStorage.setItem(STORAGE_KEYS.guestMode, "true");
      refreshUser().catch(() => null);
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Failed to enter guest mode:", error);
      router.replace("/(tabs)/home");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        {/* ヘッダー */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <Ionicons name="trending-up" size={64} color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: "bold", marginTop: 16 }}>
            StockSpace
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 8 }}>
            {isLogin ? "アカウントにログイン" : "新規アカウント作成"}
          </Text>
        </View>

        {/* フォーム */}
        <View style={{ gap: 16 }}>
          {!isLogin && (
            <View>
              <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>メールアドレス</Text>
              <TextInput
                placeholder="example@email.com"
                placeholderTextColor={colors.textMuted}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  color: colors.text,
                  fontSize: 16,
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          )}

          <View>
            <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>ユーザー名</Text>
            <TextInput
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                color: colors.text,
                fontSize: 16,
              }}
              autoCapitalize="none"
            />
          </View>

          {!isLogin && (
            <>
              <View>
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>表示名</Text>
                <TextInput
                  placeholder="表示名"
                  placeholderTextColor={colors.textMuted}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
              </View>

              <View>
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>ハンドル (@handle)</Text>
                <TextInput
                  placeholder="@handle"
                  placeholderTextColor={colors.textMuted}
                  value={formData.handle}
                  onChangeText={(text) => setFormData({ ...formData, handle: text })}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    color: colors.text,
                    fontSize: 16,
                  }}
                  autoCapitalize="none"
                />
              </View>

              <View>
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>自己紹介（任意）</Text>
                <TextInput
                  placeholder="自己紹介を入力..."
                  placeholderTextColor={colors.textMuted}
                  value={formData.bio}
                  onChangeText={(text) => setFormData({ ...formData, bio: text })}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    color: colors.text,
                    fontSize: 16,
                    minHeight: 80,
                  }}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </>
          )}

          <View>
            <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>パスワード</Text>
            <TextInput
              placeholder="パスワード"
              placeholderTextColor={colors.textMuted}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                {isLogin ? "ログイン" : "登録"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* 切り替え */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {isLogin ? "アカウントをお持ちでないですか？" : "すでにアカウントをお持ちですか？"}
          </Text>
          <Pressable
            onPress={() => {
              setIsLogin(!isLogin);
              setFormData({
                username: "",
                password: "",
                email: "",
                name: "",
                handle: "",
                bio: "",
              });
            }}
            style={{ marginLeft: 8 }}
          >
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>
              {isLogin ? "登録" : "ログイン"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSkip}
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
            登録せずに使ってみる
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: "center" }}>
            後からプロフィール画面でログイン / 登録できます
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}


