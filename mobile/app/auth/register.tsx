import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { apiClient } from "../../services/api";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { isFirebaseConfigured, GOOGLE_WEB_CLIENT_ID } from "../../lib/firebase";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  const [, , promptAsync] = useIdTokenAuthRequest(
    {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_WEB_CLIENT_ID,
    },
    { useProxy: true }
  );

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await apiClient.loginWithGoogle();
      router.replace("/(tabs)/home");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "USE_EXPO_GO_GOOGLE") {
        try {
          const result = await promptAsync();
          if (result.type !== "success") {
            if (result.type === "cancel") return;
            throw new Error("Google登録がキャンセルされました");
          }
          const idToken = result.params.id_token ?? result.authentication?.idToken;
          if (!idToken) {
            throw new Error("IDトークンを取得できませんでした");
          }
          await apiClient.loginWithGoogleIdToken(idToken);
          router.replace("/(tabs)/home");
        } catch (expoErr) {
          Alert.alert(
            "登録エラー",
            expoErr instanceof Error ? expoErr.message : "Google登録に失敗しました"
          );
        }
      } else {
        Alert.alert("登録エラー", msg || "Google登録に失敗しました");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async () => {
    // 必須項目チェック
    if (!email.trim()) {
      Alert.alert("入力エラー", "メールアドレスを入力してください");
      return;
    }
    
    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("入力エラー", "有効なメールアドレスを入力してください");
      return;
    }

    if (!handle.trim()) {
      Alert.alert("入力エラー", "ハンドル（@で始まるユーザーID）を入力してください");
      return;
    }

    if (!password.trim()) {
      Alert.alert("入力エラー", "パスワードを入力してください");
      return;
    }

    if (password.length < 6) {
      Alert.alert("入力エラー", "パスワードは6文字以上で入力してください");
      return;
    }

    const finalHandle = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;
    const name = email.split("@")[0];

    setLoading(true);
    
    try {
      console.log("=== 登録開始 ===");
      console.log("Email:", email.trim());
      console.log("Handle:", finalHandle);
      console.log("Name:", name);
      
      const result = await apiClient.register({
        email: email.trim(),
        name: name,
        handle: finalHandle,
        password,
        bio: bio.trim() || undefined,
      });
      
      console.log("=== 登録成功 ===", result);
      Alert.alert("登録成功", "アカウントが作成されました！", [
        { text: "OK", onPress: () => router.replace("/(tabs)/home") },
      ]);
    } catch (error: any) {
      console.error("=== 登録エラー詳細 ===");
      console.error("Error type:", typeof error);
      console.error("Error:", error);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error stack:", error?.stack);
      
      let displayMessage = "登録に失敗しました";
      
      if (error?.message) {
        const msg = error.message;
        
        if (msg.includes("auth/operation-not-allowed")) {
          displayMessage = "❌ Firebase設定エラー\n\nFirebase ConsoleでEmail/Password認証を有効化してください\n\n手順:\n1. https://console.firebase.google.com を開く\n2. Authentication > Sign-in method\n3. Email/Password を有効化";
        } else if (msg.includes("auth/email-already-in-use") || msg.includes("既に登録")) {
          displayMessage = "❌ このメールアドレスは既に使用されています\n\n別のメールアドレスを使用するか、ログイン画面からログインしてください";
        } else if (msg.includes("auth/weak-password") || msg.includes("6文字以上")) {
          displayMessage = "❌ パスワードが短すぎます\n\nパスワードは6文字以上で入力してください";
        } else if (msg.includes("auth/invalid-email")) {
          displayMessage = "❌ メールアドレスの形式が正しくありません\n\n正しいメールアドレスを入力してください";
        } else if (msg.includes("Network") || msg.includes("network") || msg.includes("fetch")) {
          displayMessage = "❌ ネットワークエラー\n\nバックエンドサーバーが起動しているか確認してください\n\n確認方法:\n・ターミナルで uvicorn が起動しているか\n・http://localhost:8000 にアクセスできるか";
        } else if (msg.includes("Firebase is not configured")) {
          displayMessage = "❌ Firebase設定エラー\n\nFirebaseの設定が正しくありません";
        } else if (msg.includes("Failed to get Firebase token")) {
          displayMessage = "❌ Firebase認証エラー\n\nFirebaseトークンの取得に失敗しました";
        } else {
          displayMessage = `❌ エラー\n\n${msg}\n\nこのエラーメッセージをスクリーンショットして開発者に共有してください`;
        }
      } else {
        displayMessage = "❌ 不明なエラー\n\nエラーの詳細がありません。コンソールログを確認してください";
      }
      
      Alert.alert("登録失敗", displayMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ marginBottom: 32, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>
          StockSpace
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>
          新規登録
        </Text>
      </View>

      {isFirebaseConfigured && (
        <Pressable
          onPress={handleGoogleSignUp}
          disabled={googleLoading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 24,
            opacity: googleLoading ? 0.6 : 1,
          }}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="logo-google" size={18} color="#4285F4" />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
                Googleで登録
              </Text>
            </>
          )}
        </Pressable>
      )}

      {isFirebaseConfigured && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textMuted, marginHorizontal: 12, fontSize: 12 }}>または</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      )}

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
          メールアドレス *
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          placeholderTextColor={colors.textMuted}
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

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
          ハンドル（ユーザーID） *
        </Text>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          placeholder="@your_handle"
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            color: colors.text,
            fontSize: 16,
          }}
          autoCapitalize="none"
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
          例: @tanaka_taro
        </Text>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
          パスワード *
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          placeholderTextColor={colors.textMuted}
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

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
          自己紹介（任意）
        </Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Bio"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            color: colors.text,
            fontSize: 16,
            minHeight: 80,
          }}
        />
      </View>

      <Pressable
        onPress={handleRegister}
        disabled={loading}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
          marginBottom: 16,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
            登録
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 14 }}>
          既にアカウントをお持ちの方はこちら
        </Text>
      </Pressable>
    </ScrollView>
  );
}
