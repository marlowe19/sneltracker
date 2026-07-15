// app/entry-new.tsx
// formSheet: "Nieuwe registratie" — grabber, Annuleer left, primary action
// right, disabled until valid (MOBILE-SPEC.md §Navigation).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/useTheme";
import { fetchProjects, createEntry } from "../lib/api/endpoints";
import type { Project } from "../lib/api/types";
import { formatLocalDate } from "../lib/logic/dateRangeUtils";

export default function EntryNewSheet() {
  const { colors, spacing, radii } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setProjectId(res.projects[0].id);
          setHourlyRate(res.projects[0].hourly_rate ? String(res.projects[0].hourly_rate) : "");
        }
      })
      .catch(() => setError("Projecten laden is niet gelukt."));
  }, []);

  const durationMs = useMemo(() => {
    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;
    return (h * 60 + m) * 60 * 1000;
  }, [hours, minutes]);

  const isValid = projectId !== null && durationMs > 0;

  const handleSave = useCallback(async () => {
    if (!isValid || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      await createEntry({
        dayDate: formatLocalDate(new Date()),
        duration_ms: durationMs,
        hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
        project_id: projectId,
      });
      router.back();
    } catch {
      setError("Registratie opslaan is niet gelukt. Probeer het opnieuw.");
      setSaving(false);
    }
  }, [isValid, projectId, durationMs, hourlyRate]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button">
              <Text style={{ color: colors.primaryDeep }} allowFontScaling>
                Annuleer
              </Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={!isValid || saving} accessibilityRole="button">
              <Text style={{ color: isValid ? colors.primaryDeep : colors.textMuted, fontWeight: "600" }} allowFontScaling>
                {saving ? "Bezig…" : "Voeg toe"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {error ? (
          <Text style={{ color: colors.error, marginBottom: spacing.md }} allowFontScaling>
            {error}
          </Text>
        ) : null}

        <Text style={[styles.label, { color: colors.textMuted }]} allowFontScaling>
          Project
        </Text>
        <View style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          {projects.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                setProjectId(p.id);
                if (p.hourly_rate) setHourlyRate(String(p.hourly_rate));
              }}
              style={[
                styles.projectOption,
                {
                  borderColor: p.id === projectId ? colors.primaryDeep : colors.borderMain,
                  backgroundColor: p.id === projectId ? colors.primarySoft : colors.bgSurface,
                  borderRadius: radii.input,
                },
              ]}
            >
              <Text style={{ color: colors.textMain }} allowFontScaling>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]} allowFontScaling>
          Duur
        </Text>
        <View style={[styles.durationRow, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
          <TextInput
            value={hours}
            onChangeText={setHours}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.borderMain, borderRadius: radii.input, color: colors.textMain }]}
            accessibilityLabel="Uren"
          />
          <Text style={{ color: colors.textMuted, marginHorizontal: spacing.sm }} allowFontScaling>
            u
          </Text>
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.borderMain, borderRadius: radii.input, color: colors.textMain }]}
            accessibilityLabel="Minuten"
          />
          <Text style={{ color: colors.textMuted, marginLeft: spacing.sm }} allowFontScaling>
            m
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]} allowFontScaling>
          Uurtarief (optioneel)
        </Text>
        <TextInput
          value={hourlyRate}
          onChangeText={setHourlyRate}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { marginTop: spacing.sm, borderColor: colors.borderMain, borderRadius: radii.input, color: colors.textMain, width: "100%" },
          ]}
          accessibilityLabel="Uurtarief"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600" },
  projectOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  durationRow: { flexDirection: "row", alignItems: "center" },
  input: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, width: 72, fontSize: 16 },
});
