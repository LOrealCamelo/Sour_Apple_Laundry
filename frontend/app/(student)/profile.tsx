import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";
import { Card, Btn, Field } from "@/src/components/UI";

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: user?.name || "", phone: user?.phone || "", campus: user?.campus || "", building: user?.building || "", room: user?.room || "" });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await api("/auth/me", { method: "PUT", body: f }); await refreshUser(); setEdit(false); }
    catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const referral = "SOUR-" + (user?.id?.slice(0, 5).toUpperCase() || "VIP");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.refRow}>
            <View>
              <Text style={styles.refLabel}>Your referral code</Text>
              <Text style={styles.refCode} testID="referral-code">{referral}</Text>
            </View>
            <Ionicons name="gift" size={28} color={colors.gold} />
          </View>
          <Text style={styles.refNote}>Share with friends — you both get a discount.</Text>
        </Card>

        {edit ? (
          <Card>
            <Field label="Name" value={f.name} onChangeText={set("name")} testID="edit-name" />
            <Field label="Phone" value={f.phone} onChangeText={set("phone")} testID="edit-phone" />
            <Field label="Campus" value={f.campus} onChangeText={set("campus")} testID="edit-campus" />
            <Field label="Building" value={f.building} onChangeText={set("building")} testID="edit-building" />
            <Field label="Room" value={f.room} onChangeText={set("room")} testID="edit-room" />
            <Btn title="Save" onPress={save} loading={saving} testID="save-profile-button" />
          </Card>
        ) : (
          <Card>
            <Info label="Phone" value={user?.phone} />
            <Info label="Campus" value={user?.campus} />
            <Info label="Building" value={user?.building} />
            <Info label="Room" value={user?.room} />
            <Pressable testID="edit-profile-button" onPress={() => setEdit(true)} style={styles.editRow}>
              <Ionicons name="create-outline" size={18} color={colors.apple} />
              <Text style={styles.editText}>Edit profile</Text>
            </Pressable>
          </Card>
        )}

        <Btn title="Log Out" variant="ghost" onPress={async () => { await logout(); router.replace("/"); }} testID="logout-button" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoVal}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40, alignItems: "stretch" },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.apple, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  avatarText: { fontSize: 36, fontWeight: "800", color: colors.bg },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  email: { color: colors.textDim, textAlign: "center", marginTop: 2 },
  refRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refLabel: { color: colors.textDim, fontSize: 13 },
  refCode: { color: colors.gold, fontSize: 22, fontWeight: "800", marginTop: 2 },
  refNote: { color: colors.textDim, fontSize: 13, marginTop: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textDim },
  infoVal: { color: colors.text, fontWeight: "600" },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  editText: { color: colors.apple, fontWeight: "700" },
});
