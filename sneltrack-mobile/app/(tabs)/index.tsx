// app/(tabs)/index.tsx
// "Vandaag" — the dashboard/timer heart of the app.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { WeekBarChart } from "../../components/WeekBarChart";
import { useTimerStore } from "../../lib/stores/timerStore";
import { fetchProjects, fetchWeekEntries } from "../../lib/api/endpoints";
import type { Project, TimeEntry } from "../../lib/api/types";
import { getWeekBounds, formatHMS } from "../../lib/logic/time";
import { formatCurrency, formatDurationHoursMinutes } from "../../lib/format/format";
import { formatLocalDate } from "../../lib/logic/dateRangeUtils";

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function useElapsedSeconds(startIso: string | null | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startIso) {
      setElapsed(0);
      return;
    }
    const start = new Date(startIso).getTime();
    const tick = () => setElapsed(Math.max(0, Date.now() - start));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return elapsed;
}

export default function VandaagScreen() {
  const { colors, spacing } = useTheme();
  const activeEntry = useTimerStore((s) => s.activeEntry);
  const timerLoading = useTimerStore((s) => s.loading);
  const timerError = useTimerStore((s) => s.error);
  const refreshActiveEntry = useTimerStore((s) => s.refreshActiveEntry);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);

  const [projects, setProjects] = useState<Project[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const weekBounds = useMemo(() => getWeekBounds(new Date()), []);
  const elapsedMs = useElapsedSeconds(activeEntry?.start_time);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectsRes, weekRes] = await Promise.all([
        fetchProjects(),
        fetchWeekEntries(weekBounds.start.toISOString(), weekBounds.end.toISOString()),
      ]);
      setProjects(projectsRes.projects);
      setWeekEntries(weekRes.entries);
      await refreshActiveEntry();
    } catch (err) {
      setError("Uren laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekBounds, refreshActiveEntry]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const dayBars = useMemo(() => {
    const days: { label: string; hours: number; isToday: boolean; dateStr: string }[] = [];
    const cursor = new Date(weekBounds.start);
    const todayStr = formatLocalDate(new Date());
    for (let i = 0; i < 7; i++) {
      const dateStr = formatLocalDate(cursor);
      const hoursForDay = weekEntries
        .filter((e) => e.start_time && formatLocalDate(new Date(e.start_time)) === dateStr)
        .reduce((sum, e) => sum + (e.duration_ms ?? 0) / (1000 * 60 * 60), 0);
      days.push({ label: WEEKDAY_LABELS[i], hours: hoursForDay, isToday: dateStr === todayStr, dateStr });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [weekEntries, weekBounds]);

  const weekTotalHours = dayBars.reduce((sum, d) => sum + d.hours, 0);
  const weekTotalEarnings = weekEntries.reduce((sum, e) => {
    const hours = (e.duration_ms ?? 0) / (1000 * 60 * 60);
    const rate = Number(e.hourly_rate ?? 0);
    return sum + hours * rate;
  }, 0);

  const activeProjectName = activeEntry?.project_id ? projectById.get(activeEntry.project_id)?.name : null;

  const handleStartPress = useCallback(() => {
    if (projects.length === 0) {
      setError("Geen projecten gevonden. Maak eerst een project aan op sneltrack.vercel.app.");
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...projects.map((p) => p.name), "Annuleren"],
          cancelButtonIndex: projects.length,
        },
        async (index) => {
          if (index === projects.length) return;
          const project = projects[index];
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await startTimer({ project: project.id, rate: project.hourly_rate ?? undefined });
        }
      );
    } else {
      setPickerVisible(true);
    }
  }, [projects, startTimer]);

  const handleSelectProject = useCallback(
    async (project: Project) => {
      setPickerVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await startTimer({ project: project.id, rate: project.hourly_rate ?? undefined });
    },
    [startTimer]
  );

  const handleStop = useCallback(async () => {
    await stopTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    load();
  }, [stopTimer, load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ padding: spacing.lg }}>
          <Skeleton height={140} style={{ marginBottom: spacing.lg }} />
          <Skeleton height={160} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDeep} />}
      >
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {timerError ? <ErrorState message={timerError} onRetry={refreshActiveEntry} /> : null}

        <View style={[styles.quickActionsRow, { marginBottom: spacing.lg }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/entry-new")}
            style={[styles.quickAction, { borderColor: colors.borderMain }]}
          >
            <Text style={{ color: colors.primaryDeep }} allowFontScaling>
              Voeg registratie toe
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/expense-new")}
            style={[styles.quickAction, { borderColor: colors.borderMain }]}
          >
            <Text style={{ color: colors.primaryDeep }} allowFontScaling>
              Voeg uitgave toe
            </Text>
          </Pressable>
        </View>

        <Card style={{ marginBottom: spacing.lg }}>
          {activeEntry ? (
            <View>
              <Text style={[styles.timerProject, { color: colors.textMuted }]} allowFontScaling>
                {activeProjectName ?? "Actieve timer"}
              </Text>
              <Text
                style={[styles.timerClock, { color: colors.textMain, fontVariant: ["tabular-nums"] }]}
                allowFontScaling
                accessibilityLabel={`Timer loopt: ${formatHMS(elapsedMs)}`}
              >
                {formatHMS(elapsedMs)}
              </Text>
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton label="Stop timer" onPress={handleStop} variant="destructive" loading={timerLoading} />
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.timerProject, { color: colors.textMuted }]} allowFontScaling>
                Geen actieve timer
              </Text>
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton label="Start timer" onPress={handleStartPress} loading={timerLoading} />
              </View>
            </View>
          )}
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textMain }]} allowFontScaling>
            Deze week
          </Text>
          {weekTotalHours === 0 ? (
            <EmptyState title="Nog geen uren deze week" actionLabel="Start je eerste timer" onAction={handleStartPress} />
          ) : (
            <>
              <View style={{ marginTop: spacing.md }}>
                <WeekBarChart days={dayBars} />
              </View>
              <View style={[styles.weekTotalsRow, { marginTop: spacing.lg }]}>
                <View>
                  <Text style={[styles.totalValue, { color: colors.textMain, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                    {formatDurationHoursMinutes(weekTotalHours)}
                  </Text>
                  <Text style={[styles.totalLabel, { color: colors.textMuted }]} allowFontScaling>
                    Uren
                  </Text>
                </View>
                <View>
                  <Text style={[styles.totalValue, { color: colors.textMain, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                    {formatCurrency(weekTotalEarnings)}
                  </Text>
                  <Text style={[styles.totalLabel, { color: colors.textMuted }]} allowFontScaling>
                    Verdiend
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {dayBars.map((day) => (
                  <Pressable
                    key={day.dateStr}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/day/[date]", params: { date: day.dateStr } })}
                    style={[styles.dayChip, { borderColor: colors.borderMain }]}
                  >
                    <Text style={{ color: colors.primaryDeep }} allowFontScaling>
                      {day.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Card>
      </ScrollView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerVisible(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.bgMain }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMain, marginBottom: spacing.md }]} allowFontScaling>
              Kies een project
            </Text>
            <FlatList
              data={projects}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSelectProject(item)}
                  style={[styles.projectRow, { borderColor: colors.borderMain }]}
                >
                  <Text style={{ color: colors.textMain }} allowFontScaling>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  quickActionsRow: { flexDirection: "row", gap: 8 },
  quickAction: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 10 },
  timerProject: { fontSize: 14, fontWeight: "600" },
  timerClock: { fontSize: 48, fontWeight: "700", marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  weekTotalsRow: { flexDirection: "row", gap: 32 },
  totalValue: { fontSize: 20, fontWeight: "700" },
  totalLabel: { fontSize: 12, marginTop: 2 },
  dayChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, minHeight: 44, justifyContent: "center" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  projectRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
});
