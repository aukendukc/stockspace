import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/colors";
import { apiClient } from "../services/api";
import { STORAGE_KEYS } from "../constants/storageKeys";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>("/login");

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
        const guestMode = await AsyncStorage.getItem(STORAGE_KEYS.guestMode);

        if (token) {
          await apiClient.setToken(token);
          try {
            await apiClient.getMe();
            setInitialRoute("/(tabs)/home");
          } catch {
            await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
            await apiClient.setToken(null);
            setInitialRoute(guestMode === "true" ? "/(tabs)/home" : "/login");
          }
        } else if (guestMode === "true") {
          setInitialRoute("/(tabs)/home");
        } else {
          setInitialRoute("/login");
        }
      } catch (error) {
        setInitialRoute("/login");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={initialRoute} />;
}
