import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { Btn, Field } from "@/src/components/UI";
import { colors, spacing } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role === "ADMIN") router.replace("/(admin)");
      else if (u.role === "DRIVER") router.replace("/(driver)");
      else router.replace("/(student)");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Log in to your Sour Apple VIP account</Text>
          <View style={{ height: spacing.lg }} />
          <Field label="Email" testID="login-email-input" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@school.edu" />
          <Field label="Password" testID="login-password-input" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          {!!err && <Text style={styles.err} testID="login-error">{err}</Text>}
          <Btn title="Log In" onPress={submit} loading={loading} testID="login-submit-button" />
          <Pressable onPress={() => router.replace("/register")} style={styles.linkRow}>
            <Text style={styles.link}>New here? <Text style={{ color: colors.apple }}>Create account</Text></Text>
          </Pressable>
          <Text style={styles.demo}>Demo — Admin: admin@sourapple.com / Admin123!{"\n"}Student: student@sourapple.com / Student123!{"\n"}Driver: driver@sourapple.com / Driver123!</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  back: { marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  sub: { color: colors.textDim, marginTop: 6, fontSize: 15 },
  err: { color: colors.danger, marginBottom: spacing.sm },
  linkRow: { marginTop: spacing.md, alignItems: "center" },
  link: { color: colors.textDim, fontSize: 15 },
  demo: { color: colors.textDim, fontSize: 12, marginTop: spacing.xl, lineHeight: 18, textAlign: "center" },
});
