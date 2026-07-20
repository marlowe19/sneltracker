// app/project/[id].tsx
// Read-only project detail (MVP scope per MOBILE-SPEC.md §2: writes still
// ride the Firestore path on the backend — this screen only reads).
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { Card } from "../../components/Card";
import { InlineErrorBanner } from "../../components/InlineErrorBanner";
import { Skeleton } from "../../components/Skeleton";
import { ProgressBar } from "../../components/ProgressBar";
import { fetchProjectEntries, fetchProjectStatistics, fetchProjects } from "../../lib/api/endpoints";
import type { Project, TimeEntry } from "../../lib/api/types";
import type { ProjectStatisticsResponse } from "../../lib/api/types";
import { calculateProjectProgress } from "../../lib/logic/utils/projectProgress";
import { formatCurrency, formatDurationHoursMinutes, formatDateShort } from "../../lib/format/format";

export default function ProjectDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = params.id ?? "";
  const { colors, spacing } = useTheme();
  const [project, setProject] = useState<Project | null>(null);
  const [statistics, setStatistics] = useState<ProjectStatisticsResponse["statistics"] | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectsRes, statsRes, entriesRes] = await Promise.all([
        fetchProjects(),
        fetchProjectStatistics(projectId),
        fetchProjectEntries(projectId),
      ]);
      setProject(projectsRes.projects.find((p) => p.id === projectId) ?? null);
      setStatistics(statsRes.statistics);
      setEntries(entriesRes.timeEntries.slice(0, 20));
    } catch {
      setError("Projectgegevens laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const progress = project
    ? calculateProjectProgress({ total_hours: statistics?.totalHours ?? project.total_hours ?? 0, budget_hours: project.budget_hours })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      <Stack.Screen options={{ title: project?.name ?? "Project" }} />
      {loading ? (
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={120} style={{ marginBottom: spacing.lg }} />
          <Skeleton height={200} />
        </View>
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg }}>
          {error ? <InlineErrorBanner message={error} onRetry={load} /> : null}

          <Card style={{ marginBottom: spacing.lg }}>
            <View style={styles.statsRow}>
              <View>
                <Text style={[styles.statValue, { color: colors.textMain, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                  {formatDurationHoursMinutes(statistics?.totalHours ?? 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]} allowFontScaling>
                  Totaal uren
                </Text>
              </View>
              <View>
                <Text style={[styles.statValue, { color: colors.textMain, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                  {formatCurrency(statistics?.totalMoney ?? 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]} allowFontScaling>
                  Verdiend
                </Text>
              </View>
            </View>
            {progress && project?.budget_hours ? (
              <View style={{ marginTop: spacing.lg }}>
                <ProgressBar percentage={progress.percentage} statusColor={progress.statusColor} />
                <Text style={[styles.progressLabel, { color: colors.textMuted, marginTop: spacing.xs }]} allowFontScaling>
                  {progress.formattedPercentage} van budget · {progress.formattedRemaining}
                </Text>
              </View>
            ) : null}
          </Card>

          {project?.members && project.members.length > 0 ? (
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: colors.textMain, marginBottom: spacing.sm }]} allowFontScaling>
                Teamleden
              </Text>
              {project.members.map((m) => (
                <View key={m.user_name} style={styles.memberRow}>
                  <Text style={{ color: colors.textMain }} allowFontScaling>
                    {m.user_name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontVariant: ["tabular-nums"] }} allowFontScaling>
                    {formatDurationHoursMinutes(m.billableHours ?? 0)}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textMain, marginBottom: spacing.sm }]} allowFontScaling>
              Recente registraties
            </Text>
            {entries.length === 0 ? (
              <Text style={{ color: colors.textMuted }} allowFontScaling>
                Nog geen registraties.
              </Text>
            ) : (
              <FlatList
                data={entries}
                scrollEnabled={false}
                keyExtractor={(e) => e.id}
                renderItem={({ item }) => (
                  <View style={[styles.entryRow, { borderColor: colors.borderMain }]}>
                    <Text style={{ color: colors.textMain }} allowFontScaling>
                      {formatDateShort(item.start_time)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontVariant: ["tabular-nums"] }} allowFontScaling>
                      {formatDurationHoursMinutes((item.duration_ms ?? 0) / (1000 * 60 * 60))}
                    </Text>
                  </View>
                )}
              />
            )}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 32 },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 2 },
  progressLabel: { fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  memberRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
