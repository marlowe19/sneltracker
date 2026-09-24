// components/Skeleton.tsx
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../theme/useTheme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, style }: SkeletonProps) {
  const { colors, radii } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radii.input,
          backgroundColor: colors.bgInput,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({});
