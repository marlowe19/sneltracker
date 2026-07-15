// app/(tabs)/_layout.tsx
import React from "react";
import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useTheme } from "../../theme/useTheme";

function TabIcon({ name, color }: { name: string; color: ColorValue }) {
  return <SymbolView name={name as never} tintColor={color} style={{ width: 26, height: 26 }} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        // Native bottom-tabs options don't include headerLargeTitle (that's a
        // Stack-navigator concept); each tab's own screen sets it instead via
        // its own header configuration where supported.
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bgMain, borderTopColor: colors.borderMain },
        headerStyle: { backgroundColor: colors.bgMain },
        headerTintColor: colors.textMain,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Vandaag",
          tabBarLabel: "Vandaag",
          tabBarIcon: ({ color }) => <TabIcon name="timer" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projecten"
        options={{
          title: "Projecten",
          tabBarLabel: "Projecten",
          tabBarIcon: ({ color }) => <TabIcon name="folder" color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarLabel: "Agenda",
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rapporten"
        options={{
          title: "Rapporten",
          tabBarLabel: "Rapporten",
          tabBarIcon: ({ color }) => <TabIcon name="chart.bar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profiel"
        options={{
          title: "Profiel",
          tabBarLabel: "Profiel",
          tabBarIcon: ({ color }) => <TabIcon name="person.circle" color={color} />,
        }}
      />
    </Tabs>
  );
}
