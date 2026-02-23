import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { apiClient } from "../../services/api";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { isFirebaseConfigured, GOOGLE_WEB_CLIENT_ID } from "../../lib/firebase";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleGoogleLogin = async () => {
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
            throw new Error("Googleログインがキャンセルされました");
          }
          const idToken = result.params.id_token ?? result.authentication?.idToken;
          if (!idToken) {
            throw new Error("IDトークンを取得できませんでした");
          }
          await apiClient.loginWithGoogleIdToken(idToken);
          router.replace("/(tabs)/home");
        } catch (expoErr) {
          Alert.alert(
            "ログインエラー",
            expoErr instanceof Error ? expoErr.message : "Googleログインに失敗しました"
          );
        }
      } else {
        Alert.alert("ログインエラー", msg || "Googleログインに失敗しました");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
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

    if (!password.trim()) {
      Alert.alert("入力エラー", "パスワードを入力してください");
      return;
    }

    setLoading(true);
    try {
      console.log("Starting login...", { email: email.trim() });
      
      await apiClient.login(email.trim(), password);
      
      console.log("Login successful!");
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Login error:", error);
      const message = error instanceof Error ? error.message : String(error);
      let displayMessage = message;

      if (message.includes("operation-not-allowed")) {
        displayMessage = "Firebase ConsoleでEmail/Password認証を有効化してください\n\nURL: https://console.firebase.google.com/project/stockspace-76437/authentication/providers";
      } else if (message.includes("メールアドレスまたはパスワード") || message.includes("user-not-found") || message.includes("wrong-password") || message.includes("invalid-credential")) {
        displayMessage = "メールアドレスまたはパスワードが正しくありません\n\n• メールアドレスを確認してください\n• パスワードを確認してください";
      } else if (message.includes("INVALID_CREDENTIALS") || message.includes("メールアドレスまたはパスワードが正しくありません")) {
        displayMessage = "メールアドレスまたはパスワードが正しくありません。\n\nまだアカウントがない場合は「新規登録」から作成してください。";
      } else if (message.includes("invalid-email")) {
        displayMessage = "メールアドレスの形式が正しくありません";
      } else if (message.includes("too-many-requests")) {
        displayMessage = "ログイン試行回数が多すぎます\n\nしばらく待ってから再度お試しください";
      } else if (message.includes("Network") || message.includes("Failed to fetch") || message.includes("ネットワーク")) {
        displayMessage = "ネットワークエラー\n\nバックエンドのURLと接続を確認してください。";
      } else if (message.includes("FIREBASE_NOT_CONFIGURED")) {
        displayMessage = "サーバーでFirebaseが設定されていません。\n\nAzure ポータル → App Service → 設定 → 環境変数 で FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY を追加し、保存してから App を再起動してください。";
      } else if (message.includes("Invalid or expired Firebase token") || message.includes("Firebase token") || message.includes("Firebase ID token")) {
        displayMessage = "Firebaseトークンの検証に失敗しました。\n\n・Azure の環境変数（FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY）が正しく設定されているか確認してください。\n・FIREBASE_PRIVATE_KEY は改行を \\n にした1行で入力してください。\n・設定変更後は App Service を再起動し、1〜2分待ってから再度お試しください。";
      } else if (message.includes("FIREBASE_SYNC_404") || message.includes("firebase-sync がありません") || message.includes("Not Found")) {
        displayMessage = "ログイン用のAPIがサーバーにありません。\n\nAzure にデプロイしているバックエンドを、このリポジトリの最新版（main.py と backend/routers/auth.py を含む）で再デプロイしてください。";
      } else if (message.includes("同期に失敗") || message.includes("サーバーが応答")) {
        displayMessage = message;
      } else if (!message || message === "ログインに失敗しました") {
        displayMessage = "ログインに失敗しました。\n\nメール・パスワードを確認するか、ネットワークとサーバー設定を確認してください。";
      }

      Alert.alert("ログインエラー", displayMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: "center" }}>
      <View style={{ marginBottom: 32, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>
          StockSpace
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>
          ログイン
        </Text>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
          メールアドレス
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

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 8 }}>
          パスワード
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="6文字以上"
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

      <Pressable
        onPress={handleLogin}
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
            ログイン
          </Text>
        )}
      </Pressable>

      {/* Googleログインボタン（Firebase設定時のみ表示） */}
      {isFirebaseConfigured && (
      <>
      <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textMuted, marginHorizontal: 12, fontSize: 12 }}>または</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <Pressable
        onPress={handleGoogleLogin}
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
          marginBottom: 16,
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
              Googleでログイン
            </Text>
          </>
        )}
      </Pressable>
      </>
      )}

      <Pressable
        onPress={() => router.push("/auth/register")}
        style={{
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 14 }}>
          アカウントをお持ちでない方はこちら
        </Text>
      </Pressable>
    </View>
  );
}



