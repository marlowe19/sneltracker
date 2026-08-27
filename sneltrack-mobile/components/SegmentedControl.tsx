// components/SegmentedControl.tsx
// A lightweight segmented control built on core Pressable/View — the spec
// calls for a "native segmented control" but names no extra dependency, so
// this stays dependency-free rather than pulling in
// @react-native-segmented-control/segmented-control.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/useTheme";

interface SegmentedControlProps<T extends string> {
  segments: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  const { colors, radii } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgInput, borderRadius: radii.button }]}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.value)}
            style={[
              styles.segment,
              { borderRadius: radii.button, backgroundColor: active ? colors.bgMain : "transparent" },
            ]}
          >
            <Text style={{ color: active ? colors.textMain : colors.textMuted, fontWeight: active ? "700" : "500" }} allowFontScaling>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", padding: 4 },
  segment: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
});
