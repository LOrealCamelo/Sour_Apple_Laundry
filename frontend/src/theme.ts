// Sour Apple VIP — premium dark + sour-green + gold VIP accents
export const colors = {
  bg: "#0E1512",
  surface: "#16211C",
  surfaceAlt: "#1E2C25",
  border: "#2A3B32",
  apple: "#7CFC5A", // sour apple green
  appleDim: "#5BC63E",
  gold: "#E7C463", // VIP gold
  text: "#F2F7F3",
  textDim: "#9DB0A5",
  danger: "#FF6B6B",
  warn: "#FFB454",
  info: "#5AB8FF",
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

export const font = {
  h1: { fontSize: 28, fontWeight: "800" as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  dim: { fontSize: 13, color: colors.textDim },
};
