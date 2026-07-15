// components/ErrorState.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/useTheme";
import { PrimaryButton } from "./PrimaryButton";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.container, { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }]}>
      <Text style={[styles.message, { color: colors.error }]} allowFontScaling accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Probeer opnieuw" onPress={onRetry} variant="secondary" />
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
  message: {
    fontSize: 15,
    textAlign: "center",
  },
});
