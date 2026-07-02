import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { Btn, Field } from "@/src/components/UI";
import { colors, spacing } from "@/src/theme";

const ROLES = [
  { key: "STUDENT", label: "Student", icon: "school" as const },
  { key: "NEIGHBOR", label: "Neighbor", icon: "home" as const },
  { key: "DRIVER", label: "Driver", icon: "car" as const },
];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState("STUDENT");
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", campus: "", building: "", room: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const u = await register({ ...f, email: f.email.trim(), role });
      if (u.role === "DRIVER") router.replace("/(driver)");
      else router.replace("/(student)");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} testID="register-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
          <Text style={styles.title}>Create account</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <Pressable key={r.key} testID={`role-${r.key.toLowerCase()}-button`} onPress={() => setRole(r.key)}
                style={[styles.roleCard, role === r.key && styles.roleActive]}>
                <Ionicons name={r.icon} size={22} color={role === r.key ? colors.bg : colors.textDim} />
                <Text style={[styles.roleLabel, role === r.key && { color: colors.bg }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          {role === "NEIGHBOR" && (
            <Text style={{ color: colors.textDim, fontSize: 13, marginBottom: spacing.md, marginTop: -8 }}>
              Neighborhood service is drop-off & self-pickup — no driver pickup/delivery.
            </Text>
          )}
          <Field label="Full name" testID="reg-name-input" value={f.name} onChangeText={set("name")} placeholder="Jamie Doe" />
          <Field label="Email" testID="reg-email-input" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" placeholder="you@school.edu" />
          <Field label="Password" testID="reg-password-input" value={f.password} onChangeText={set("password")} secureTextEntry placeholder="Create a password" />
          <Field label="Phone" testID="reg-phone-input" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="555-0100" />
          {role !== "DRIVER" && (<>
            <Field label={role === "NEIGHBOR" ? "Neighborhood" : "Campus"} testID="reg-campus-input" value={f.campus} onChangeText={set("campus")} placeholder={role === "NEIGHBOR" ? "Maple Grove" : "State University"} />
            <Field label={role === "NEIGHBOR" ? "Street address" : "Dorm / Building"} testID="reg-building-input" value={f.building} onChangeText={set("building")} placeholder={role === "NEIGHBOR" ? "123 Main St" : "West Hall"} />
            <Field label={role === "NEIGHBOR" ? "Apt / Unit (optional)" : "Room / Apt #"} testID="reg-room-input" value={f.room} onChangeText={set("room")} placeholder={role === "NEIGHBOR" ? "Unit B" : "204"} />
          </>)}
          {!!err && <Text style={styles.err} testID="register-error">{err}</Text>}
          <Btn title="Create Account" onPress={submit} loading={loading} testID="register-submit-button" />
          <Pressable onPress={() => router.replace("/login")} style={styles.linkRow}>
            <Text style={styles.link}>Have an account? <Text style={{ color: colors.apple }}>Log in</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  back: { marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  roleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  roleCard: { flex: 1, height: 64, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 4 },
  roleActive: { backgroundColor: colors.apple, borderColor: colors.apple },
  roleLabel: { color: colors.textDim, fontWeight: "700" },
  err: { color: colors.danger, marginBottom: spacing.sm },
  linkRow: { marginTop: spacing.md, alignItems: "center" },
  link: { color: colors.textDim, fontSize: 15 },
});
