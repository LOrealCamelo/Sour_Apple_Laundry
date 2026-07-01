import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === "ADMIN") router.replace("/(admin)");
      else if (user.role === "DRIVER") router.replace("/(driver)");
      else router.replace("/(student)");
    }
  }, [user, loading]);

  if (loading || user) {
    return (
      <View style={styles.center} testID="splash-loading">
        <ActivityIndicator color={colors.apple} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Ionicons name="shirt" size={44} color={colors.bg} />
        </View>
        <Text style={styles.brand}>Sour Apple</Text>
        <View style={styles.vipRow}>
          <View style={styles.vipPill}><Text style={styles.vipText}>VIP</Text></View>
          <Text style={styles.sub}>Laundry Services</Text>
        </View>
        <Text style={styles.tag}>Campus laundry, picked up & delivered.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable testID="get-started-button" style={styles.primary} onPress={() => router.push("/register")}>
          <Text style={styles.primaryText}>Get Started</Text>
        </Pressable>
        <Pressable testID="login-link-button" style={styles.ghost} onPress={() => router.push("/login")}>
          <Text style={styles.ghostText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "space-between", padding: spacing.lg, paddingBottom: 48, paddingTop: 120 },
  hero: { alignItems: "center", flex: 1, justifyContent: "center" },
  logoCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.apple, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  brand: { fontSize: 40, fontWeight: "900", color: colors.text, letterSpacing: -1 },
  vipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  vipPill: { backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.sm },
  vipText: { color: colors.bg, fontWeight: "900", fontSize: 14 },
  sub: { color: colors.textDim, fontSize: 18, fontWeight: "600" },
  tag: { color: colors.textDim, marginTop: spacing.md, fontSize: 15 },
  actions: { gap: spacing.sm },
  primary: { backgroundColor: colors.apple, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.bg, fontWeight: "800", fontSize: 17 },
  ghost: { height: 50, alignItems: "center", justifyContent: "center" },
  ghostText: { color: colors.apple, fontWeight: "600", fontSize: 15 },
});
