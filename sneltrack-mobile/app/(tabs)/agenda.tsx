// app/(tabs)/agenda.tsx
// Week list view (not a custom month grid in MVP, per MOBILE-SPEC.md §3).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { PrimaryButton } from "../../components/PrimaryButton";
import { fetchAgenda, generateAgendaPlanning } from "../../lib/api/endpoints";
import type { AgendaPlanningDay, AgendaProject, AgendaResponse } from "../../lib/api/types";
import { formatDateLong } from "../../lib/format/format";
import { formatTime } from "../../lib/logic/dateRangeUtils";
import { daysBetween } from "../../lib/logic/time";

export default function AgendaScreen() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [planningDays, setPlanningDays] = useState<AgendaPlanningDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchAgenda();
      setData(res);
    } catch {
      setError("Agenda laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const projectById = useMemo(() => {
    const map = new Map<string, AgendaProject>();
    for (const p of data?.projects ?? []) map.set(p.id, p);
    return map;
  }, [data]);

  const days = useMemo(() => {
    if (!data) return [];
    return daysBetween(data.dateRange.start, data.dateRange.end);
  }, [data]);

  const handleGeneratePlanning = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await generateAgendaPlanning();
      setPlanningDays(res.planning.days);
    } catch {
      setGenerateError("Planning maken is niet gelukt. Probeer het opnieuw.");
    } finally {
      setGenerating(false);
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={80} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={80} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
        <ErrorState message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

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
            tintColor={colors.primaryDeep}
          />
        }
      >
        <View style={{ marginBottom: spacing.lg }}>
          <PrimaryButton
            label={generating ? "Planning maken…" : "Genereer weekplanning"}
            onPress={handleGeneratePlanning}
            loading={generating}
          />
          {generateError ? <ErrorState message={generateError} onRetry={handleGeneratePlanning} /> : null}
        </View>

        {days.length === 0 ? (
          <EmptyState title="Geen agenda-items gevonden" />
        ) : (
          days.map((day) => {
            const dateStr = day.toISOString().slice(0, 10);
            const planningItems = planningDays?.find((d) => d.date === dateStr)?.items ?? [];
            const calendarItems = (data?.calendarEvents ?? []).filter(
              (e) => e.start && e.start.slice(0, 10) === dateStr
            );
            const isHoliday = data?.holidays.includes(dateStr) ?? false;
            const hasItems = planningItems.length > 0 || calendarItems.length > 0;

            return (
              <Card key={dateStr} style={{ marginBottom: spacing.md }}>
                <Text style={[styles.dayTitle, { color: colors.textMain }]} allowFontScaling>
                  {formatDateLong(day)}
                  {isHoliday ? " · feestdag" : ""}
                </Text>
                {!hasItems ? (
                  <Text style={{ color: colors.textMuted, marginTop: spacing.xs }} allowFontScaling>
                    Geen items gepland
                  </Text>
                ) : (
                  <>
                    {planningItems.map((item) => (
                      <View key={item.id} style={[styles.itemRow, { borderColor: colors.borderMain }]}>
                        <View
                          style={[
                            styles.itemDot,
                            { backgroundColor: item.projectId ? projectById.get(item.projectId)?.color ?? colors.primaryDeep : colors.purple },
                          ]}
                        />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={{ color: colors.textMain }} allowFontScaling>
                            {item.title}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }} allowFontScaling>
                            {formatTime(item.start)} – {formatTime(item.end)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {calendarItems.map((event, index) => (
                      <View key={event.id ?? `${dateStr}-${index}`} style={[styles.itemRow, { borderColor: colors.borderMain }]}>
                        <View style={[styles.itemDot, { backgroundColor: colors.textMuted }]} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={{ color: colors.textMain }} allowFontScaling>
                            {event.title ?? "Agenda-item"}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }} allowFontScaling>
                            {formatTime(event.start)} – {formatTime(event.end)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dayTitle: { fontSize: 15, fontWeight: "700" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
});
