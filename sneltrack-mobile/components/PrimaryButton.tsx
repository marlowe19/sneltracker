// components/PrimaryButton.tsx
// Button treatment ported from in-orbyt/DESIGN.md's real convention:
// primary = bg-blue-500 text-white font-bold, active:scale-[0.98];
// secondary = bg-input + text-main; destructive = bg-error + text-white.
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
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
  const scale = useRef(new Animated.Value(1)).current;

  const backgroundColor =
    variant === "destructive" ? colors.error : variant === "secondary" ? colors.bgInput : colors.primary;
  const textColor = variant === "secondary" ? colors.textMain : "#FFFFFF";

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled || loading) }}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled || loading}
        style={[
          styles.base,
          {
            backgroundColor,
            borderRadius: radii.button,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            opacity: disabled ? 0.5 : 1,
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
    </Animated.View>
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
    fontWeight: "700",
  },
});
