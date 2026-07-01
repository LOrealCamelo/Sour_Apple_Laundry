import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";

export default function DriverProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-profile-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={{ alignItems: "center", marginTop: 8 }}><Badge text="Approved Driver" color={colors.apple} /></View>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.h}>Earnings</Text>
          <Text style={styles.earn}>$0.00</Text>
          <Text style={styles.dim}>Payout tracking placeholder — connects to Stripe payouts later.</Text>
        </Card>
        <Card>
          <Text style={styles.h}>Onboarding Documents</Text>
          <Doc label="Driver's license" /><Doc label="Insurance" /><Doc label="W-9" /><Doc label="Background check consent" />
          <Text style={styles.dim}>Document upload & verification are placeholders.</Text>
        </Card>
        <Btn title="Log Out" variant="ghost" onPress={async () => { await logout(); router.replace("/"); }} testID="driver-logout-button" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Doc({ label }: { label: string }) {
  return <View style={styles.docRow}><Ionicons name="document-text-outline" size={18} color={colors.textDim} /><Text style={styles.docText}>{label}</Text><Ionicons name="ellipse" size={10} color={colors.warn} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.apple, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  avatarText: { fontSize: 36, fontWeight: "800", color: colors.bg },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  email: { color: colors.textDim, textAlign: "center", marginTop: 2 },
  h: { color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 6 },
  earn: { color: colors.apple, fontSize: 28, fontWeight: "800", marginBottom: 4 },
  dim: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 19 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  docText: { color: colors.text, flex: 1 },
});
