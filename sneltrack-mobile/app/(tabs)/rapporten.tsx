// app/(tabs)/rapporten.tsx
// Rapporten (MVP-light) per MOBILE-SPEC.md §4: period segmented control,
// totals cards reusing the ported finance logic, simple SVG bar chart.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { Card } from "../../components/Card";
import { InlineErrorBanner } from "../../components/InlineErrorBanner";
import { Skeleton } from "../../components/Skeleton";
import { SegmentedControl } from "../../components/SegmentedControl";
import { WeekBarChart } from "../../components/WeekBarChart";
import { fetchDashboardStats, fetchWeekEntries } from "../../lib/api/endpoints";
import { buildDashboardStatsPayload } from "../../lib/api/buildDashboardStatsPayload";
import type { DashboardStatsResponse, TimeEntry } from "../../lib/api/types";
import { computeMonthFinance } from "../../lib/logic/finance/monthFinance";
import { getMonthBounds, getQuarterBounds, getWeekBounds, daysBetween } from "../../lib/logic/time";
import { formatCurrency, formatDurationHoursMinutes } from "../../lib/format/format";
import { formatLocalDate } from "../../lib/logic/dateRangeUtils";

type Period = "week" | "month" | "quarter";

const WEEKS_PER_MONTH = 52 / 12 / 1; // ~4.345 average weeks in a month

export default function RapportenScreen() {
  const { colors, spacing } = useTheme();
  const [period, setPeriod] = useState<Period>("month");
  const [dashboard, setDashboard] = useState<DashboardStatsResponse | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => {
    const now = new Date();
    if (period === "week") return getWeekBounds(now);
    if (period === "quarter") return getQuarterBounds(now);
    return getMonthBounds(now);
  }, [period]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dashboardRes, entriesRes] = await Promise.all([
        fetchDashboardStats(buildDashboardStatsPayload(new Date())),
        fetchWeekEntries(bounds.start.toISOString(), bounds.end.toISOString()),
      ]);
      setDashboard(dashboardRes);
      setEntries(entriesRes.entries);
    } catch {
      setError("Rapporten laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bounds]);

  useEffect(() => {
    load();
  }, [load]);

  const periodHours = entries.reduce((sum, e) => sum + (e.duration_ms ?? 0) / (1000 * 60 * 60), 0);
  const periodRevenue = entries.reduce((sum, e) => {
    const hours = (e.duration_ms ?? 0) / (1000 * 60 * 60);
    return sum + hours * Number(e.hourly_rate ?? 0);
  }, 0);

  // Scale the authoritative monthly business/private costs down (week) or up
  // (quarter) to line up with the selected period, then reuse the ported
  // monthFinance waterfall for the netto figure — same formula the web app
  // and the dashboard-stats route use, just re-run client-side for the
  // period the user picked.
  const periodFinance = useMemo(() => {
    if (!dashboard) return null;
    const factor = period === "week" ? 1 / WEEKS_PER_MONTH : period === "quarter" ? 3 : 1;
    return computeMonthFinance({
      earnings: periodRevenue,
      businessCostsMonthly: dashboard.monthFinance.businessCostsMonthly * factor,
      privateCostsMonthly: dashboard.monthFinance.privateCostsMonthly * factor,
      taxReservePct: dashboard.monthFinance.taxReservePct,
    });
  }, [dashboard, period, periodRevenue]);

  const dayBars = useMemo(() => {
    const days = daysBetween(bounds.start, bounds.end).slice(0, 31);
    const todayStr = formatLocalDate(new Date());
    return days.map((d) => {
      const dateStr = formatLocalDate(d);
      const hours = entries
        .filter((e) => e.start_time && formatLocalDate(new Date(e.start_time)) === dateStr)
        .reduce((sum, e) => sum + (e.duration_ms ?? 0) / (1000 * 60 * 60), 0);
      return { label: String(d.getDate()), hours, isToday: dateStr === todayStr };
    });
  }, [bounds, entries]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {error ? <InlineErrorBanner message={error} onRetry={load} /> : null}

        <SegmentedControl
          segments={[
            { value: "week", label: "Week" },
            { value: "month", label: "Maand" },
            { value: "quarter", label: "Kwartaal" },
          ]}
          value={period}
          onChange={setPeriod}
        />

        {loading ? (
          <View style={{ marginTop: spacing.lg }}>
            <Skeleton height={40} style={{ marginBottom: spacing.lg }} />
            <Skeleton height={140} />
          </View>
        ) : (
          <>
            <View style={[styles.totalsGrid, { marginTop: spacing.lg }]}>
              <TotalCard label="Uren" value={formatDurationHoursMinutes(periodHours)} color={colors.textMain} />
              <TotalCard label="Omzet" value={formatCurrency(periodRevenue)} color={colors.textMain} />
              <TotalCard
                label="Kosten"
                value={formatCurrency((periodFinance?.profit !== undefined ? periodRevenue - periodFinance.profit : 0))}
                color={colors.error}
              />
              <TotalCard label="Netto" value={formatCurrency(periodFinance?.netAfterTax ?? 0)} color={colors.success} />
            </View>

            <Card style={{ marginTop: spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: colors.textMain, marginBottom: spacing.md }]} allowFontScaling>
                Uren per dag
              </Text>
              {dayBars.length === 0 || periodHours === 0 ? (
                <Text style={{ color: colors.textMuted }} allowFontScaling>
                  Geen uren in deze periode.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <WeekBarChart days={dayBars} />
                </ScrollView>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TotalCard({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      style={[
        styles.totalCard,
        { backgroundColor: colors.bgSurface, borderRadius: radii.card, padding: spacing.md, borderColor: colors.borderMain },
      ]}
    >
      <Text style={[styles.totalValue, { color, fontVariant: ["tabular-nums"] }]} allowFontScaling numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: colors.textMuted }]} allowFontScaling>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  totalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  totalCard: { width: "47%", borderWidth: StyleSheet.hairlineWidth },
  totalValue: { fontSize: 18, fontWeight: "700" },
  totalLabel: { fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
});
