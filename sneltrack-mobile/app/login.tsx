// app/login.tsx
import React, { useCallback, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { WebViewNavigation } from "react-native-webview";
import { useTheme } from "../theme/useTheme";
import { PrimaryButton } from "../components/PrimaryButton";
import { ErrorState } from "../components/ErrorState";
import { API_URL } from "../lib/api/config";
import { fetchCurrentUser } from "../lib/api/endpoints";
import { useAuthStore } from "../lib/stores/authStore";

export default function LoginScreen() {
  const { colors, spacing } = useTheme();
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleNavigationChange = useCallback(
    async (navState: WebViewNavigation) => {
      // Auth0 Universal Login runs inside the WebView. Once it redirects
      // back to `/my*`, the appSession cookie is in the shared native cookie
      // jar and we can close the WebView and re-fetch /my/api/user.
      if (navState.url.startsWith(`${API_URL}/my`)) {
        setWebviewVisible(false);
        try {
          const res = await fetchCurrentUser();
          setAuthenticated(res.user);
        } catch {
          setError("Inloggen is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
        }
      }
    },
    [setAuthenticated]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <View style={[styles.content, { padding: spacing.xl }]}>
        <Text style={[styles.title, { color: colors.textMain }]} allowFontScaling>
          SnelTracker
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, marginTop: spacing.sm }]} allowFontScaling>
          Log in om je uren en projecten bij te houden.
        </Text>
        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton label="Inloggen" onPress={() => setWebviewVisible(true)} />
        </View>
        {error ? (
          <View style={{ marginTop: spacing.lg }}>
            <ErrorState message={error} onRetry={() => setWebviewVisible(true)} />
          </View>
        ) : null}
      </View>

      <Modal visible={webviewVisible} animationType="slide" onRequestClose={() => setWebviewVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgMain }}>
          <WebView
            source={{ uri: `${API_URL}/auth/login` }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            onNavigationStateChange={handleNavigationChange}
            startInLoadingState
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
  },
});
