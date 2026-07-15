// app/day/[date].tsx
// Pushed screen listing a single day's time entries with swipe-to-delete.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme/useTheme";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { SwipeToDeleteRow } from "../../components/SwipeToDeleteRow";
import { fetchDayEntries, deleteEntry, fetchProjects } from "../../lib/api/endpoints";
import type { Project, TimeEntry } from "../../lib/api/types";
import { formatDateLong, formatCurrency, formatMsAsHoursMinutes } from "../../lib/format/format";
import { formatTime } from "../../lib/logic/dateRangeUtils";

export default function DayEntriesScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const dateStr = params.date ?? "";
  const { colors, spacing } = useTheme();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [entriesRes, projectsRes] = await Promise.all([fetchDayEntries(dateStr), fetchProjects()]);
      setEntries(entriesRes.entries);
      setProjects(projectsRes.projects);
    } catch {
      setError("Registraties laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const handleDelete = useCallback((entry: TimeEntry) => {
    Alert.alert("Registratie verwijderen?", undefined, [
      { text: "Annuleren", style: "cancel" },
      {
        text: "Verwijder registratie",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEntry(entry.id);
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert("Verwijderen is niet gelukt", "Probeer het opnieuw.");
          }
        },
      },
    ]);
  }, []);

  const title = dateStr ? formatDateLong(new Date(dateStr)) : "Registraties";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      <Stack.Screen options={{ title }} />
      {loading ? (
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={56} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={56} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState title="Nog geen registraties op deze dag" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => {
            const project = item.project_id ? projectById.get(item.project_id) : undefined;
            const durationMs = item.duration_ms ?? 0;
            const amount = (durationMs / (1000 * 60 * 60)) * Number(item.hourly_rate ?? 0);
            return (
              <SwipeToDeleteRow onDelete={() => handleDelete(item)}>
                <View style={[styles.row, { borderColor: colors.borderMain, backgroundColor: colors.bgMain }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.textMain }]} allowFontScaling>
                      {project?.name ?? "Onbekend project"}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textMuted }]} allowFontScaling>
                      {formatTime(item.start_time)}
                      {item.end_time ? ` – ${formatTime(item.end_time)}` : " – loopt"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.rowValue, { color: colors.textMain, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                      {formatMsAsHoursMinutes(durationMs)}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textMuted, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                      {formatCurrency(amount)}
                    </Text>
                  </View>
                </View>
              </SwipeToDeleteRow>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  rowValue: { fontSize: 16, fontWeight: "600" },
  deleteAction: { justifyContent: "center", alignItems: "center", width: 96 },
  deleteActionLabel: { color: "#FFFFFF", fontWeight: "600", padding: 12 },
});
