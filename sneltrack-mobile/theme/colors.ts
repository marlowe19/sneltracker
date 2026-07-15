// theme/colors.ts
// InOrbyt Foundation design tokens. No hardcoded hex values are allowed
// anywhere else in the app — always import light/dark from this file.

export interface ThemeColors {
  bgMain: string;
  bgSurface: string;
  bgInput: string;
  textMain: string;
  textMuted: string;
  borderMain: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  purple: string;
  orange: string;
  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;
  draft: string;
}

export const light: ThemeColors = {
  bgMain: "#FFFFFF",
  bgSurface: "#F7F8FA",
  bgInput: "#F1F3F5",
  textMain: "#1A1A1A",
  textMuted: "#999999",
  borderMain: "#E6E6E6",
  primary: "#80C3FF", // fill with dark text, never as text on white
  primaryDeep: "#008EFF", // tinted text / links / selected tab
  primarySoft: "#E5F3FF", // blue-10: selected/hover rows
  purple: "#8C1AFF", // community, badges, verification
  orange: "#FFA540", // warnings, unpriced (0.00) items
  success: "#40A69F",
  successSoft: "#E1F3F1",
  error: "#FF4E64",
  errorSoft: "#FFE3E7",
  draft: "#FFC740",
};

export const dark: ThemeColors = {
  bgMain: "#121212",
  bgSurface: "#1C1C1E",
  bgInput: "#242426",
  textMain: "#F2F2F2",
  textMuted: "#8E8E93",
  borderMain: "#2C2C2E",
  primary: "#80C3FF",
  primaryDeep: "#5AB4FF",
  primarySoft: "#1B3652",
  purple: "#B072FF",
  orange: "#FFB768",
  success: "#40A69F",
  successSoft: "#1E3A38",
  error: "#FF6B7D",
  errorSoft: "#3A1E22",
  draft: "#FFC740",
};

export const radii = {
  card: 16,
  button: 12,
  input: 10,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
