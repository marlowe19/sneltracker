// app/(tabs)/profiel.tsx
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { useAuthStore } from "../../lib/stores/authStore";
import { usePreferencesStore } from "../../lib/stores/preferencesStore";
import { fetchXp } from "../../lib/api/endpoints";
import { API_URL } from "../../lib/api/config";
import type { XpResponse } from "../../lib/api/types";

export default function ProfielScreen() {
  const { colors, spacing, radii } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const showDashboardWidgets = usePreferencesStore((s) => s.showDashboardWidgets);
  const hydratePreferences = usePreferencesStore((s) => s.hydrate);
  const setShowDashboardWidgets = usePreferencesStore((s) => s.setShowDashboardWidgets);

  const [xp, setXp] = useState<XpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchXp("month");
      setXp(res);
    } catch {
      setError("XP laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydratePreferences();
    load();
  }, [hydratePreferences, load]);

  const initials = (user?.display_name ?? user?.user_name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = useCallback(() => {
    Alert.alert("Uitloggen?", undefined, [
      { text: "Annuleren", style: "cancel" },
      {
        text: "Uitloggen",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API_URL}/auth/logout`, { credentials: "include" });
          } catch {
            // Ignore network errors on logout — clear local state regardless.
          }
          setUnauthenticated();
        },
      },
    ]);
  }, [setUnauthenticated]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg }}>
        <Card style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={{ color: colors.primaryDeep, fontWeight: "700", fontSize: 20 }} allowFontScaling>
              {initials}
            </Text>
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={[styles.name, { color: colors.textMain }]} allowFontScaling numberOfLines={1}>
              {user?.display_name ?? user?.user_name ?? "Gebruiker"}
            </Text>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: colors.textMain, marginBottom: spacing.sm }]} allowFontScaling>
            XP dit maand
          </Text>
          {loading ? (
            <Skeleton height={48} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <View style={styles.xpRow}>
              <Text style={[styles.xpTotal, { color: colors.purple }]} allowFontScaling>
                {xp?.totalXP ?? 0} XP
              </Text>
              <Text style={{ color: colors.textMuted }} allowFontScaling>
                Streak: {xp?.streak.daily ?? 0} dagen · {xp?.streak.weekly ?? 0} weken
              </Text>
            </View>
          )}
        </Card>

        <View style={[styles.settingsGroup, { marginTop: spacing.lg, borderRadius: radii.card, backgroundColor: colors.bgSurface, borderColor: colors.borderMain }]}>
          <View style={[styles.settingsRow, { borderColor: colors.borderMain }]}>
            <Text style={{ color: colors.textMain, flex: 1 }} allowFontScaling>
              Dashboard-widgets tonen
            </Text>
            <Switch value={showDashboardWidgets} onValueChange={setShowDashboardWidgets} />
          </View>
          <View style={[styles.settingsRow, { borderColor: colors.borderMain }]}>
            <Text style={{ color: colors.textMain, flex: 1 }} allowFontScaling>
              Donker/licht
            </Text>
            <Text style={{ color: colors.textMuted }} allowFontScaling>
              Volgt systeem
            </Text>
          </View>
          <View style={styles.settingsRowLast}>
            <Text
              style={{ color: colors.error, fontWeight: "600" }}
              allowFontScaling
              accessibilityRole="button"
              onPress={handleLogout}
            >
              Uitloggen
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  userCard: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  xpRow: { gap: 4 },
  xpTotal: { fontSize: 24, fontWeight: "700" },
  settingsGroup: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsRowLast: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center" },
});
