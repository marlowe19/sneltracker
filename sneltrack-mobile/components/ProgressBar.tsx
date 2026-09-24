// components/ProgressBar.tsx
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/useTheme";
import type { StatusColor } from "../lib/logic/utils/projectProgress";

interface ProgressBarProps {
  percentage: number;
  statusColor: StatusColor;
}

export function ProgressBar({ percentage, statusColor }: ProgressBarProps) {
  const { colors, radii } = useTheme();
  const clamped = Math.max(0, Math.min(100, percentage));

  const fillColor: Record<StatusColor, string> = {
    gray: colors.borderMain,
    green: colors.success,
    yellow: colors.draft,
    orange: colors.orange,
    red: colors.error,
  };

  return (
    <View style={[styles.track, { backgroundColor: colors.bgInput, borderRadius: radii.input }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped}%`, backgroundColor: fillColor[statusColor], borderRadius: radii.input },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    height: 8,
  },
});
