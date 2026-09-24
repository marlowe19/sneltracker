// app/(tabs)/index.tsx
// "Vandaag" — the dashboard/timer heart of the app. Structure mirrors the
// web homepage 1:1 (sneltrack/app/my/WeekEntriesClient.js +
// TimerSectionWrapperClient.js): week-nav header, 7-day strip, collapsible
// week summary, then the timer card + quick actions below.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWeek } from "date-fns";
import { useTheme } from "../../theme/useTheme";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { InlineErrorBanner } from "../../components/InlineErrorBanner";
import { Skeleton } from "../../components/Skeleton";
import { useTimerStore } from "../../lib/stores/timerStore";
import { fetchProjects, fetchWeekEntries, fetchWeekExpenses } from "../../lib/api/endpoints";
import type { Project, TimeEntry, WeekExpense } from "../../lib/api/types";
import { getWeekBounds, formatHMS, computeEntryDurationMsClipped } from "../../lib/logic/time";
import { formatCurrency, formatTodayPill } from "../../lib/format/format";
import { formatLocalDate, formatHoursMinutes } from "../../lib/logic/dateRangeUtils";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const DAY_MS = 24 * 60 * 60 * 1000;

interface UserWeekTotal {
  userName: string;
  displayName: string;
  timeMs: number;
  money: number;
  expenses: number;
}

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
  const { colors, spacing, radii } = useTheme();
  const activeEntry = useTimerStore((s) => s.activeEntry);
  const timerLoading = useTimerStore((s) => s.loading);
  const timerError = useTimerStore((s) => s.error);
  const refreshActiveEntry = useTimerStore((s) => s.refreshActiveEntry);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);

  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [weekExpenses, setWeekExpenses] = useState<WeekExpense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const elapsedMs = useElapsedSeconds(activeEntry?.start_time);

  const weekBounds = useMemo(() => {
    const reference = new Date(Date.now() + weekOffset * 7 * DAY_MS);
    return getWeekBounds(reference);
  }, [weekOffset]);

  const weekNumber = useMemo(() => getWeek(weekBounds.start, { weekStartsOn: 1 }), [weekBounds]);

  const loadWeek = useCallback(async (offset: number) => {
    setWeekLoading(true);
    setWeekError(null);
    try {
      const reference = new Date(Date.now() + offset * 7 * DAY_MS);
      const bounds = getWeekBounds(reference);
      const [weekRes, expensesRes] = await Promise.all([
        fetchWeekEntries(bounds.start.toISOString(), bounds.end.toISOString()),
        fetchWeekExpenses(bounds.start.toISOString(), bounds.end.toISOString()),
      ]);
      setEntries(weekRes.entries);
      setWeekExpenses(expensesRes.expenses);
    } catch {
      setWeekError("Week laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setWeekLoading(false);
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWeek(weekOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const loadProjectsAndTimer = useCallback(async () => {
    try {
      const projectsRes = await fetchProjects();
      setProjects(projectsRes.projects);
    } catch {
      // Projects failure surfaces through the start-timer flow; the rest of
      // the dashboard keeps rendering regardless.
    }
    await refreshActiveEntry();
  }, [refreshActiveEntry]);

  useEffect(() => {
    loadProjectsAndTimer();
  }, [loadProjectsAndTimer]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWeek(weekOffset);
    loadProjectsAndTimer();
  }, [loadWeek, weekOffset, loadProjectsAndTimer]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  // Per-day hours/money/expenses — ported 1:1 from WeekEntriesClient.js.
  const { perDay, perDayMoney, perDayExpenses } = useMemo(() => {
    const hours = Array(7).fill(0);
    const money = Array(7).fill(0);
    const expenses = Array(7).fill(0);

    for (const e of entries) {
      const duration = computeEntryDurationMsClipped(
        e.start_time,
        e.end_time,
        weekBounds.start,
        weekBounds.end,
        e.duration_ms ?? null
      );
      if (duration === 0) continue;

      let dayIndex = -1;
      if (e.duration_ms !== null && e.duration_ms !== undefined && e.start_time) {
        const entryStart = new Date(e.start_time);
        dayIndex = (entryStart.getDay() + 6) % 7; // Monday = 0
      } else if (e.start_time) {
        const entryStart = new Date(e.start_time);
        const clippedStart = entryStart > weekBounds.start ? entryStart : weekBounds.start;
        dayIndex = (clippedStart.getDay() + 6) % 7;
      }

      if (dayIndex >= 0 && dayIndex < 7) {
        hours[dayIndex] += duration;
        if (e.hourly_rate) {
          money[dayIndex] += (duration / (1000 * 60 * 60)) * Number(e.hourly_rate);
        }
      }
    }

    for (const expense of weekExpenses) {
      if (!expense.date) continue;
      const expenseDate = new Date(expense.date);
      const dayIndex = (expenseDate.getDay() + 6) % 7;
      if (dayIndex >= 0 && dayIndex < 7) {
        expenses[dayIndex] += expense.price || 0;
      }
    }

    return { perDay: hours, perDayMoney: money, perDayExpenses: expenses };
  }, [entries, weekExpenses, weekBounds]);

  const weekTotalTime = useMemo(() => perDay.reduce((sum: number, v: number) => sum + v, 0), [perDay]);
  const weekTotalMoney = useMemo(() => perDayMoney.reduce((sum: number, v: number) => sum + v, 0), [perDayMoney]);
  const weekTotalExpenses = useMemo(
    () => perDayExpenses.reduce((sum: number, v: number) => sum + v, 0),
    [perDayExpenses]
  );

  const perUserWeekTotals = useMemo<UserWeekTotal[]>(() => {
    const map = new Map<string, UserWeekTotal>();

    for (const e of entries) {
      const duration = computeEntryDurationMsClipped(
        e.start_time,
        e.end_time,
        weekBounds.start,
        weekBounds.end,
        e.duration_ms ?? null
      );
      if (duration === 0) continue;

      const userName = e.user_name || "Onbekend";
      if (!map.has(userName)) {
        map.set(userName, {
          userName,
          displayName: e.user_display_name || userName,
          timeMs: 0,
          money: 0,
          expenses: 0,
        });
      }
      const totals = map.get(userName)!;
      totals.timeMs += duration;
      if (e.hourly_rate) {
        totals.money += (duration / (1000 * 60 * 60)) * Number(e.hourly_rate);
      }
    }

    for (const expense of weekExpenses) {
      const userName = expense.user_name;
      if (!userName || !map.has(userName)) continue;
      map.get(userName)!.expenses += expense.price || 0;
    }

    return Array.from(map.values()).sort((a, b) => b.timeMs - a.timeMs);
  }, [entries, weekExpenses, weekBounds]);

  const dayColumns = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    return WEEKDAY_LABELS.map((label, i) => {
      const date = new Date(weekBounds.start.getTime() + i * DAY_MS);
      const dateStr = formatLocalDate(date);
      return {
        label,
        dateStr,
        dayNumber: date.getDate(),
        isToday: dateStr === todayStr,
        hours: perDay[i] as number,
        money: perDayMoney[i] as number,
        expenses: perDayExpenses[i] as number,
      };
    });
  }, [weekBounds, perDay, perDayMoney, perDayExpenses]);

  const activeProjectName = activeEntry?.project_id ? projectById.get(activeEntry.project_id)?.name : null;

  const toggleSummary = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setSummaryExpanded((prev) => !prev);
  }, []);

  const handleStartPress = useCallback(() => {
    if (projects.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Geen projecten gevonden", "Maak eerst een project aan op sneltrack.vercel.app.");
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
    loadWeek(weekOffset);
  }, [stopTimer, loadWeek, weekOffset]);

  const weekSummaryGridStyle = styles.weekSummaryCols;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {weekError ? <InlineErrorBanner message={weekError} onRetry={() => loadWeek(weekOffset)} /> : null}
        {timerError ? <InlineErrorBanner message={timerError} onRetry={refreshActiveEntry} /> : null}

        {/* Week navigation header */}
        <View style={styles.weekNavRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vorige week"
            onPress={() => setWeekOffset((o) => o - 1)}
            style={styles.navButton}
            hitSlop={8}
          >
            <Text style={[styles.navChevron, { color: colors.textMuted }]} allowFontScaling>
              ‹
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ga naar deze week"
            onPress={() => setWeekOffset(0)}
            style={[styles.todayPill, { borderColor: colors.borderMain }]}
          >
            <Text style={{ color: colors.textMain, fontSize: 13, fontWeight: "600" }} allowFontScaling>
              Vandaag: {formatTodayPill(new Date())}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volgende week"
            onPress={() => setWeekOffset((o) => o + 1)}
            style={styles.navButton}
            hitSlop={8}
          >
            <Text style={[styles.navChevron, { color: colors.textMuted }]} allowFontScaling>
              ›
            </Text>
          </Pressable>
        </View>

        {/* 7-day strip */}
        <View style={[styles.weekStrip, { opacity: weekLoading ? 0.5 : 1, marginTop: spacing.sm }]}>
          {initialLoading
            ? dayColumns.map((day) => (
                <View key={day.dateStr} style={styles.dayColumn}>
                  <Skeleton height={60} />
                </View>
              ))
            : dayColumns.map((day) => (
                <Pressable
                  key={day.dateStr}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.label} ${day.dayNumber}, ${formatHoursMinutes(day.hours)} uur`}
                  onPress={() => router.push({ pathname: "/day/[date]", params: { date: day.dateStr } })}
                  style={styles.dayColumn}
                  hitSlop={4}
                >
                  <Text style={[styles.dayLabel, { color: colors.textMuted }]} allowFontScaling>
                    {day.label}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      {
                        backgroundColor: day.isToday ? colors.primary : colors.bgInput,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.dayNumber, { color: day.isToday ? "#FFFFFF" : colors.textMain }]}
                      allowFontScaling
                    >
                      {day.dayNumber}
                    </Text>
                  </View>
                  <Text
                    style={[styles.dayHours, { color: colors.textMain, fontVariant: ["tabular-nums"] }]}
                    allowFontScaling
                  >
                    {day.hours ? formatHoursMinutes(day.hours) : "0:00"}
                  </Text>
                  <Text
                    style={[
                      styles.dayMoney,
                      { color: colors.success, fontVariant: ["tabular-nums"], opacity: day.money > 0 ? 1 : 0 },
                    ]}
                    allowFontScaling
                  >
                    {day.money > 0 ? formatCurrency(day.money) : "​"}
                  </Text>
                  <Text
                    style={[
                      styles.dayExpenses,
                      { color: colors.error, fontVariant: ["tabular-nums"], opacity: day.expenses > 0 ? 1 : 0 },
                    ]}
                    allowFontScaling
                  >
                    {day.expenses > 0 ? formatCurrency(day.expenses) : "​"}
                  </Text>
                </Pressable>
              ))}
        </View>

        {/* Week summary bar */}
        <View
          style={[
            styles.weekSummary,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderMain, borderRadius: radii.card, marginTop: spacing.md },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: summaryExpanded }}
            onPress={toggleSummary}
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
          >
            <View style={weekSummaryGridStyle}>
              <View style={styles.weekSummaryLeftCol}>
                <Text style={[styles.weekSummaryLabel, { color: colors.textMain }]} allowFontScaling>
                  Week {weekNumber}
                </Text>
                <Text style={[styles.weekSummaryLabel, { color: colors.textMain }]} allowFontScaling>
                  Totaal
                </Text>
              </View>
              <View style={styles.weekSummaryCol}>
                <Text style={[styles.weekSummaryHeading, { color: colors.textMuted }]} allowFontScaling>
                  Tijd
                </Text>
                <Text
                  style={[styles.weekSummaryValue, { color: colors.textMain, fontVariant: ["tabular-nums"] }]}
                  allowFontScaling
                >
                  {formatHoursMinutes(weekTotalTime)}
                </Text>
              </View>
              <View style={styles.weekSummaryCol}>
                <Text style={[styles.weekSummaryHeading, { color: colors.textMuted }]} allowFontScaling>
                  Euro&apos;s
                </Text>
                <Text
                  style={[styles.weekSummaryValue, { color: colors.success, fontVariant: ["tabular-nums"] }]}
                  allowFontScaling
                >
                  {formatCurrency(weekTotalMoney)}
                </Text>
              </View>
              <View style={styles.weekSummaryCol}>
                <Text style={[styles.weekSummaryHeading, { color: colors.textMuted }]} allowFontScaling>
                  Uitgaven
                </Text>
                <Text
                  style={[styles.weekSummaryValue, { color: colors.error, fontVariant: ["tabular-nums"] }]}
                  allowFontScaling
                >
                  {formatCurrency(weekTotalExpenses)}
                </Text>
              </View>
              <Text
                style={[
                  styles.weekSummaryChevron,
                  { color: colors.textMuted, transform: [{ rotate: summaryExpanded ? "180deg" : "0deg" }] },
                ]}
                allowFontScaling
              >
                ▼
              </Text>
            </View>
          </Pressable>

          {summaryExpanded ? (
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
              {perUserWeekTotals.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, paddingVertical: 4 }} allowFontScaling>
                  Geen uren gelogd deze week.
                </Text>
              ) : (
                perUserWeekTotals.map((u) => (
                  <View key={u.userName} style={weekSummaryGridStyle}>
                    <Text
                      style={[styles.weekSummaryUserName, { color: colors.textMuted }]}
                      allowFontScaling
                      numberOfLines={1}
                    >
                      {u.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.weekSummaryUserValue,
                        { color: colors.textMain, fontVariant: ["tabular-nums"] },
                      ]}
                      allowFontScaling
                    >
                      {formatHoursMinutes(u.timeMs)}
                    </Text>
                    <Text
                      style={[
                        styles.weekSummaryUserValue,
                        { color: colors.success, fontVariant: ["tabular-nums"] },
                      ]}
                      allowFontScaling
                    >
                      {formatCurrency(u.money)}
                    </Text>
                    <Text
                      style={[
                        styles.weekSummaryUserValue,
                        { color: colors.error, fontVariant: ["tabular-nums"] },
                      ]}
                      allowFontScaling
                    >
                      {formatCurrency(u.expenses)}
                    </Text>
                    <View />
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>

        {/* Quick actions */}
        <View style={[styles.quickActionsRow, { marginTop: spacing.lg }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/entry-new")}
            style={[styles.quickAction, { borderColor: colors.borderMain }]}
          >
            <Text style={{ color: colors.primary }} allowFontScaling>
              Voeg registratie toe
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/expense-new")}
            style={[styles.quickAction, { borderColor: colors.borderMain }]}
          >
            <Text style={{ color: colors.primary }} allowFontScaling>
              Voeg uitgave toe
            </Text>
          </Pressable>
        </View>

        {/* Timer card */}
        <Card style={{ marginTop: spacing.lg }}>
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
  weekNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  navChevron: { fontSize: 28, fontWeight: "600" },
  todayPill: { flex: 1, marginHorizontal: 8, minHeight: 32, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  weekStrip: { flexDirection: "row" },
  dayColumn: { flex: 1, alignItems: "center", minHeight: 44 },
  dayLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  dayNumber: { fontSize: 13, fontWeight: "700" },
  dayHours: { fontSize: 12, fontWeight: "700", marginTop: 4 },
  dayMoney: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  dayExpenses: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  weekSummary: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  weekSummaryCols: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekSummaryLeftCol: { flex: 1.2 },
  weekSummaryCol: { flex: 1, alignItems: "flex-end" },
  weekSummaryLabel: { fontSize: 12, fontWeight: "700" },
  weekSummaryHeading: { fontSize: 11, fontWeight: "700" },
  weekSummaryValue: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  weekSummaryChevron: { fontSize: 11, fontWeight: "700", width: 16, textAlign: "center" },
  weekSummaryUserName: { flex: 1.2, fontSize: 12, fontWeight: "600" },
  weekSummaryUserValue: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "right" },
  quickActionsRow: { flexDirection: "row", gap: 8 },
  quickAction: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 10 },
  timerProject: { fontSize: 14, fontWeight: "600" },
  timerClock: { fontSize: 48, fontWeight: "700", marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  projectRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
});
