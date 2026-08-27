// theme/colors.ts
// InOrbyt ecosystem design tokens — ported 1:1 from the ecosystem source of
// truth at in-orbyt/DESIGN.md (the same palette SnelOfferte ships today).
// No hardcoded hex values are allowed anywhere else in the app — always
// import light/dark from this file.
//
// Correction vs. the original brief: "#80C3FF" is blue-50 (a light tint
// step), not the primary action color. The real primary/CTA color across
// the ecosystem — confirmed by SnelOfferte's DESIGN.md and by SnelTracker's
// own shipped web app (`.btn { background: #008eff }` in app/globals.css)
// — is blue-500 #008EFF. blue-50 is kept below as `accentSoft` for the
// lighter-tint use cases the doc reserves it for (chips, subtle highlights).

export interface ThemeColors {
  bgMain: string;
  bgSurface: string;
  bgSidebar: string;
  bgInput: string;
  textMain: string;
  textMuted: string;
  borderMain: string;
  primary: string; // blue-500 — primary CTA, active indicators
  primaryPressed: string; // blue-600 — pressed/hover
  primarySoft: string; // blue-10 — subtle blue backgrounds, badges, selected rows
  accentSoft: string; // blue-50 (#80C3FF) — lighter accent tint
  purple: string; // purple-400 — premium, community, verification badges
  orange: string; // orange-500 — warnings, pending, unpriced items
  draft: string; // yellow-500 — info, draft status
  draftSoft: string; // yellow-10
  success: string; // aqua-green-500 — success, confirmed, positive revenue
  successSoft: string; // aqua-green-10
  error: string; // cherry-red-500 — error, destructive, overdue, negative
  errorSoft: string;
}

export const light: ThemeColors = {
  bgMain: "#FFFFFF",
  bgSurface: "#FFFFFF",
  bgSidebar: "#F5F5F5",
  bgInput: "#FBFBFB",
  textMain: "#1A1A1A",
  textMuted: "#999999",
  borderMain: "#E6E6E6",
  primary: "#008EFF",
  primaryPressed: "#0079E6",
  primarySoft: "#E5F3FF",
  accentSoft: "#80C3FF",
  purple: "#8C1AFF",
  orange: "#FFA540",
  draft: "#FFC740",
  draftSoft: "#FFF9E5",
  success: "#40A69F",
  successSoft: "#E6F6F5",
  error: "#FF4E64",
  errorSoft: "#FFE3E7",
};

export const dark: ThemeColors = {
  bgMain: "#0F0F0F",
  bgSurface: "#161616",
  bgSidebar: "#161616",
  bgInput: "#222222",
  textMain: "#FFFFFF",
  textMuted: "#A0A0A0",
  borderMain: "#2A2A2A",
  primary: "#008EFF",
  primaryPressed: "#339FFF",
  primarySoft: "#0F2A40",
  accentSoft: "#80C3FF",
  purple: "#B072FF",
  orange: "#FFB768",
  draft: "#FFC740",
  draftSoft: "#3A331A",
  success: "#40A69F",
  successSoft: "#1E3A38",
  error: "#FF6B7D",
  errorSoft: "#3A1E22",
};

// Shape rhythm per in-orbyt/DESIGN.md: cards rounded-2xl, buttons/inputs
// rounded-xl/rounded-lg, icon-only controls fully round.
export const radii = {
  card: 16,
  button: 12,
  input: 8,
  chip: 6,
  pill: 999,
};

// Spacing rhythm: multiples of 4, with 8/12/16/24 as the workhorses.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export type StatusKind = "draft" | "sent" | "success" | "overdue" | "paid" | "credited";

// Status badge color mapping, mirrored from in-orbyt/DESIGN.md's
// `statusColors` convention (bg-soft + text-strong per status).
export function statusColor(colors: ThemeColors, status: StatusKind): { bg: string; fg: string } {
  switch (status) {
    case "draft":
      return { bg: colors.draftSoft, fg: colors.draft };
    case "sent":
      return { bg: colors.primarySoft, fg: colors.primary };
    case "success":
    case "paid":
      return { bg: colors.successSoft, fg: colors.success };
    case "overdue":
      return { bg: colors.errorSoft, fg: colors.orange };
    case "credited":
      return { bg: colors.primarySoft, fg: colors.purple };
    default:
      return { bg: colors.bgInput, fg: colors.textMuted };
  }
}
