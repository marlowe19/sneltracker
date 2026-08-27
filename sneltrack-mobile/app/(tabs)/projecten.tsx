// app/(tabs)/projecten.tsx
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { EmptyState } from "../../components/EmptyState";
import { InlineErrorBanner } from "../../components/InlineErrorBanner";
import { Skeleton } from "../../components/Skeleton";
import { ProgressBar } from "../../components/ProgressBar";
import { fetchProjects } from "../../lib/api/endpoints";
import type { Project } from "../../lib/api/types";
import { calculateProjectProgress } from "../../lib/logic/utils/projectProgress";
import { formatDurationHoursMinutes } from "../../lib/format/format";

export default function ProjectenScreen() {
  const { colors, spacing, radii } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchProjects();
      setProjects(res.projects);
    } catch {
      setError("Projecten laden is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]} edges={["bottom"]}>
      {error ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <InlineErrorBanner message={error} onRetry={load} />
        </View>
      ) : null}
      {loading ? (
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={72} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={72} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={72} />
        </View>
      ) : projects.length === 0 ? (
        <EmptyState title="Nog geen projecten" />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
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
          renderItem={({ item }) => {
            const progress = calculateProjectProgress({
              total_hours: item.total_hours ?? 0,
              budget_hours: item.budget_hours,
            });
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/project/[id]", params: { id: item.id } })}
                style={[
                  styles.row,
                  { borderColor: colors.borderMain, borderRadius: radii.card, marginBottom: spacing.sm },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: item.color ?? colors.primary }]} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.name, { color: colors.textMain }]} allowFontScaling numberOfLines={1}>
                      {item.name}
                    </Text>
                    {progress.isOverBudget ? (
                      <View style={[styles.badge, { backgroundColor: colors.errorSoft }]}>
                        <Text style={[styles.badgeLabel, { color: colors.orange }]} allowFontScaling>
                          Over budget
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.client ? (
                    <Text style={[styles.client, { color: colors.textMuted }]} allowFontScaling numberOfLines={1}>
                      {item.client}
                    </Text>
                  ) : null}
                  {item.budget_hours ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <ProgressBar percentage={progress.percentage} statusColor={progress.statusColor} />
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end", marginLeft: spacing.md }}>
                  <Text style={[styles.hours, { color: colors.textMain, fontVariant: ["tabular-nums"] }]} allowFontScaling>
                    {formatDurationHoursMinutes(item.total_hours ?? 0)}
                  </Text>
                  <Text style={{ color: colors.textMuted, marginTop: 2 }}>{">"}</Text>
                </View>
              </Pressable>
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
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  client: { fontSize: 13, marginTop: 2 },
  hours: { fontSize: 15, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeLabel: { fontSize: 11, fontWeight: "700" },
});
