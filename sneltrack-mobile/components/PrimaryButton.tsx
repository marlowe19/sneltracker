// components/PrimaryButton.tsx
import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { useTheme } from "../theme/useTheme";

interface PrimaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "destructive" | "secondary";
  accessibilityHint?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  accessibilityHint,
}: PrimaryButtonProps) {
  const { colors, radii, spacing } = useTheme();

  const backgroundColor =
    variant === "destructive" ? colors.error : variant === "secondary" ? colors.bgInput : colors.primary;
  const textColor = variant === "destructive" ? "#FFFFFF" : colors.textMain;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderRadius: radii.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]} allowFontScaling>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
