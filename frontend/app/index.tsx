import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, glow } from "@/src/theme";

export default function Index() {
  const { user, loading, isGuest, continueAsGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === "ADMIN") router.replace("/(admin)");
      else if (user.role === "DRIVER") router.replace("/(driver)");
      else router.replace("/(student)");
    } else if (isGuest) {
      router.replace("/(student)");
    }
  }, [user, loading, isGuest]);

  if (loading || user || isGuest) {
    return (
      <View style={styles.center} testID="splash-loading">
        <ActivityIndicator color={colors.apple} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="welcome-screen">
      <LinearGradient
        colors={["#141018", "#0A0A0F", "#160A14"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.hero}>
        <View style={styles.logoGlow}>
          <Image
            source={require("../assets/images/logo-hero.jpg")}
            style={styles.logo}
            contentFit="contain"
            testID="hero-logo"
          />
        </View>
        <View style={styles.taglinePill}>
          <Text style={styles.tagline}>WE TAKE THE <Text style={{ color: colors.apple }}>STINK</Text> OUT OF LAUNDRY</Text>
        </View>
        <View style={styles.badges}>
          <Text style={styles.badge}>✓ WE PICK UP</Text>
          <Text style={styles.badge}>✓ WE WASH</Text>
          <Text style={styles.badge}>✓ WE FOLD</Text>
          <Text style={styles.badge}>✓ WE DELIVER</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable testID="get-started-button" style={[styles.primary, glow(colors.apple)]} onPress={() => router.push("/register")}>
          <Text style={styles.primaryText}>SCHEDULE IN THE APP →</Text>
        </Pressable>
        <Pressable testID="login-link-button" style={styles.pinkBtn} onPress={() => router.push("/login")}>
          <Text style={styles.pinkText}>I already have an account</Text>
        </Pressable>
        <Pressable testID="guest-button" style={styles.guest} onPress={() => { continueAsGuest(); router.replace("/(student)"); }}>
          <Text style={styles.guestText}>Continue as guest →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "space-between", padding: spacing.lg, paddingBottom: 44, paddingTop: 60 },
  hero: { alignItems: "center", flex: 1, justifyContent: "center" },
  logoGlow: { borderRadius: 200, ...glow(colors.apple) },
  logo: { width: 300, height: 300 },
  taglinePill: { backgroundColor: "#000", borderColor: colors.apple, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8, marginTop: spacing.sm },
  tagline: { color: colors.white, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: spacing.lg },
  badge: { color: colors.apple, fontWeight: "800", fontSize: 12, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, overflow: "hidden" },
  actions: { gap: spacing.sm },
  primary: { backgroundColor: colors.apple, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#0A0A0F", fontWeight: "900", fontSize: 17, letterSpacing: 0.5 },
  pinkBtn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.pink },
  pinkText: { color: colors.pink, fontWeight: "800", fontSize: 15 },
  guest: { height: 42, alignItems: "center", justifyContent: "center" },
  guestText: { color: colors.textDim, fontWeight: "700", fontSize: 14, textDecorationLine: "underline" },
});
