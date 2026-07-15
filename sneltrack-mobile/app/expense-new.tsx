// app/expense-new.tsx
// formSheet: "Nieuwe uitgave" (project-scoped day expense, POST /my/expenses)
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/useTheme";
import { fetchProjects, createProjectExpense } from "../lib/api/endpoints";
import type { Project } from "../lib/api/types";
import { PREDEFINED_EXPENSE_TYPES } from "../lib/logic/expenseTypes";
import { formatLocalDate } from "../lib/logic/dateRangeUtils";

export default function ExpenseNewSheet() {
  const { colors, spacing, radii } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [expenseType, setExpenseType] = useState<string>(PREDEFINED_EXPENSE_TYPES[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0) setProjectId(res.projects[0].id);
      })
      .catch(() => setError("Projecten laden is niet gelukt."));
  }, []);

  const priceNumber = Number(price.replace(",", "."));
  const isValid = projectId !== null && name.trim().length > 0 && Number.isFinite(priceNumber) && priceNumber >= 0;

  const handleSave = useCallback(async () => {
    if (!isValid || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      await createProjectExpense({
        dayDate: formatLocalDate(new Date()),
        project: projectId,
        name: name.trim(),
        price: priceNumber,
        expense_type: expenseType,
      });
      router.back();
    } catch {
      setError("Uitgave opslaan is niet gelukt. Probeer het opnieuw.");
      setSaving(false);
    }
  }, [isValid, projectId, name, priceNumber, expenseType]);

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
              onPress={() => setProjectId(p.id)}
              style={[
                styles.option,
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
          Omschrijving
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Bijv. verf en materiaal"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { marginTop: spacing.sm, marginBottom: spacing.lg, borderColor: colors.borderMain, borderRadius: radii.input, color: colors.textMain },
          ]}
          accessibilityLabel="Omschrijving"
        />

        <Text style={[styles.label, { color: colors.textMuted }]} allowFontScaling>
          Bedrag
        </Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { marginTop: spacing.sm, marginBottom: spacing.lg, borderColor: colors.borderMain, borderRadius: radii.input, color: colors.textMain },
          ]}
          accessibilityLabel="Bedrag"
        />

        <Text style={[styles.label, { color: colors.textMuted }]} allowFontScaling>
          Type
        </Text>
        <View style={{ marginTop: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PREDEFINED_EXPENSE_TYPES.filter((t) => t.value !== "__custom__").map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setExpenseType(t.value)}
              style={[
                styles.chip,
                {
                  borderColor: t.value === expenseType ? colors.primaryDeep : colors.borderMain,
                  backgroundColor: t.value === expenseType ? colors.primarySoft : colors.bgSurface,
                },
              ]}
            >
              <Text style={{ color: colors.textMain }} allowFontScaling>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600" },
  option: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  input: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 },
  chip: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
});
