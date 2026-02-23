import { Stack, useRouter, useSegments } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../context/AppContext";
import { MessageProvider } from "../context/MessageContext";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/storageKeys";

WebBrowser.maybeCompleteAuthSession();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const { user, loading } = useApp();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (hasCheckedAuth || loading) return;
      
      const guestMode = await AsyncStorage.getItem(STORAGE_KEYS.guestMode);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
      
      // ログインもゲストモードもない場合、ログイン画面にリダイレクト
      if (!guestMode && !token && !user) {
        const inAuthGroup = segments[0] === "login" || segments[0] === "auth";
        if (!inAuthGroup) {
          router.replace("/login");
        }
      }
      setHasCheckedAuth(true);
    };
    
    checkAuth();
  }, [user, loading, segments, hasCheckedAuth]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MessageProvider>
          <RootLayoutNav />
        </MessageProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
