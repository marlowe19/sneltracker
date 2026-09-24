// theme/useTheme.ts
import { useColorScheme } from "react-native";
import { dark, light, radii, spacing, ThemeColors } from "./colors";

export interface Theme {
  colors: ThemeColors;
  scheme: "light" | "dark";
  radii: typeof radii;
  spacing: typeof spacing;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return {
    colors: scheme === "dark" ? dark : light,
    scheme,
    radii,
    spacing,
  };
}
