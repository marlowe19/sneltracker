// components/WeekBarChart.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../theme/useTheme";

export interface DayBar {
  label: string;
  hours: number;
  isToday?: boolean;
}

interface WeekBarChartProps {
  days: DayBar[];
  height?: number;
}

export function WeekBarChart({ days, height = 96 }: WeekBarChartProps) {
  const { colors, spacing } = useTheme();
  const maxHours = Math.max(1, ...days.map((d) => d.hours));
  const barWidth = 24;
  const gap = 12;
  const chartWidth = days.length * barWidth + (days.length - 1) * gap;

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        {days.map((day, index) => {
          const barHeight = Math.max(2, (day.hours / maxHours) * (height - 4));
          const x = index * (barWidth + gap);
          const y = height - barHeight;
          return (
            <Rect
              key={day.label + index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={6}
              fill={day.isToday ? colors.primaryDeep : colors.primary}
            />
          );
        })}
      </Svg>
      <View style={[styles.labelRow, { width: chartWidth, marginTop: spacing.xs }]}>
        {days.map((day, index) => (
          <Text
            key={day.label + index}
            style={[
              styles.label,
              { width: barWidth + (index < days.length - 1 ? gap : 0), color: day.isToday ? colors.primaryDeep : colors.textMuted },
            ]}
            allowFontScaling
          >
            {day.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
  },
  label: {
    fontSize: 11,
    textAlign: "center",
  },
});
