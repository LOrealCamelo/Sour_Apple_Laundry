import React from "react";
import {
  Text, View, StyleSheet, Pressable, TextInput, ActivityIndicator,
  TextInputProps, ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "@/src/theme";

export function Btn({ title, onPress, loading, variant = "primary", testID, disabled }:
  { title: string; onPress: () => void; loading?: boolean; variant?: "primary" | "ghost" | "gold"; testID?: string; disabled?: boolean }) {
  const bg = variant === "primary" ? colors.apple : variant === "gold" ? colors.gold : "transparent";
  const fg = variant === "ghost" ? colors.apple : "#0E1512";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.7 : 1,
          borderWidth: variant === "ghost" ? 1 : 0, borderColor: colors.apple },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> :
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, testID, ...props }: { label: string; testID?: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.textDim}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginVertical: spacing.xs },
  btnText: { fontSize: 16, fontWeight: "700" },
  label: { color: colors.textDim, fontSize: 13, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md,
    height: 50, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: "flex-start" },
});
