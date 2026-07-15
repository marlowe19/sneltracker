// app/_layout.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans";
import { useAuthStore } from "../lib/stores/authStore";
import { fetchCurrentUser } from "../lib/api/endpoints";
import { ApiError } from "../lib/api/client";
import { light, dark } from "../theme/colors";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const status = useAuthStore((s) => s.status);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const scheme = useColorScheme() === "dark" ? dark : light;
  const [checkedOnce, setCheckedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetchCurrentUser();
        if (!cancelled) setAuthenticated(res.user);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUnauthenticated();
        } else {
          // Network/other error at boot: fall back to login screen rather
          // than getting stuck on a spinner forever.
          setUnauthenticated();
        }
      } finally {
        if (!cancelled) setCheckedOnce(true);
      }
    }
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [setAuthenticated, setUnauthenticated]);

  if (!fontsLoaded || !checkedOnce || status === "unknown") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: scheme.bgMain }}>
        <ActivityIndicator size="large" color={scheme.primaryDeep} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShadowVisible: false }}>
        {status === "authenticated" ? (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="project/[id]" options={{ title: "Project" }} />
            <Stack.Screen name="day/[date]" options={{ title: "Registraties" }} />
            <Stack.Screen
              name="entry-new"
              options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 1], title: "Nieuwe registratie" }}
            />
            <Stack.Screen
              name="expense-new"
              options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 1], title: "Nieuwe uitgave" }}
            />
          </>
        ) : (
          <Stack.Screen name="login" options={{ headerShown: false }} />
        )}
      </Stack>
    </SafeAreaProvider>
  );
}
