// components/SwipeToDeleteRow.tsx
// Minimal swipe-to-delete built on core React Native Animated/PanResponder —
// deliberately avoids adding react-native-gesture-handler since the spec's
// dependency list doesn't name it (see MOBILE-SPEC.md "Location & stack").
import React, { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/useTheme";

const ACTION_WIDTH = 96;

interface SwipeToDeleteRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeToDeleteRow({ children, onDelete }: SwipeToDeleteRowProps) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.min(0, Math.max(-ACTION_WIDTH, currentOffset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const shouldOpen = gesture.dx < -ACTION_WIDTH / 2;
        const target = shouldOpen ? -ACTION_WIDTH : 0;
        currentOffset.current = target;
        Animated.spring(translateX, { toValue: target, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.actionContainer, { backgroundColor: colors.error }]}>
        <Text
          style={styles.actionLabel}
          allowFontScaling
          accessibilityRole="button"
          accessibilityLabel="Verwijder registratie"
          onPress={onDelete}
        >
          Verwijder
        </Text>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  actionContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: "#FFFFFF", fontWeight: "600", padding: 12 },
});
