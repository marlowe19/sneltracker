// components/EmptyState.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/useTheme";
import { PrimaryButton } from "./PrimaryButton";

interface EmptyStateProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.container, { paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg }]}>
      <Text style={[styles.title, { color: colors.textMuted }]} allowFontScaling>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    textAlign: "center",
  },
});
