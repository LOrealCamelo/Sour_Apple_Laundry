// Sour Apple VIP — EYE-POPPING neon sour-green + hot-pink slime on black
export const colors = {
  bg: "#0A0A0F",
  surface: "#17131F",
  surfaceAlt: "#221A2E",
  border: "#3A2A50",
  apple: "#A8FF1A",     // neon sour-apple green (primary)
  appleDim: "#7BD400",
  gold: "#FF2AA0",      // hot pink VIP accent (key kept for compat)
  pink: "#FF2AA0",
  pinkDim: "#D41F84",
  text: "#FFFFFF",
  textDim: "#A99FBC",
  danger: "#FF5C7A",
  warn: "#FFC24B",
  info: "#3FC6FF",
  white: "#FFFFFF",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const statusColor = (s: string): string => {
  if (["Rejected", "Needs Customer Follow-Up"].includes(s)) return colors.danger;
  if (["Delivered", "Approved", "Completed"].includes(s)) return colors.apple;
  if (s.includes("Pending")) return colors.warn;
  return colors.info;
};

// neon glow shadow for hero elements
export const glow = (c: string) => ({
  shadowColor: c, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 16, elevation: 10,
});

export const font = {
  h1: { fontSize: 28, fontWeight: "800" as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  dim: { fontSize: 13, color: colors.textDim },
};
