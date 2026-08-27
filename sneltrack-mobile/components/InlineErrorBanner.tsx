// components/InlineErrorBanner.tsx
// Compact inline error banner used at the top of a screen while the rest of
// the layout keeps rendering underneath (zeros/stale data included) — the
// "always render the full UI" principle. Never replaces the whole screen.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/useTheme";

interface InlineErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function InlineErrorBanner({ message, onRetry }: InlineErrorBannerProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.errorSoft,
          borderRadius: radii.card,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={[styles.message, { color: colors.error }]} allowFontScaling numberOfLines={2}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry} hitSlop={8}>
          <Text style={[styles.retryLabel, { color: colors.error }]} allowFontScaling>
            Probeer opnieuw
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  retry: {
    minHeight: 32,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  retryLabel: {
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
