// components/Card.tsx
import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { useTheme } from "../theme/useTheme";

export function Card({ style, ...rest }: ViewProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderMain,
          borderRadius: radii.card,
          padding: spacing.lg,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
