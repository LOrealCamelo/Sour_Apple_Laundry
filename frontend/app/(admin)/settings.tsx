import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme";
import { Card, Btn } from "@/src/components/UI";

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-settings-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Admin</Text>
        <Card>
          <View style={styles.row}><Ionicons name="shield-checkmark" size={24} color={colors.gold} /><View style={{ marginLeft: 12 }}><Text style={styles.name}>{user?.name}</Text><Text style={styles.dim}>{user?.email}</Text></View></View>
        </Card>
        <Card>
          <Text style={styles.h}>Business Settings</Text>
          <Info label="Pricing rules" value="Managed in code (SERVICE_PRICES)" />
          <Info label="Campuses / service areas" value="State University" />
          <Info label="Time slots" value="9am-12pm, 12pm-3pm, 3pm-6pm" />
          <Info label="Job payout" value="Set per release ($ amount)" />
        </Card>
        <Card>
          <Text style={styles.h}>Placeholders</Text>
          <Text style={styles.dim}>Stripe payments · SMS/Email/Push · Driver document verification · AI route/matching — wired as placeholders, ready for production keys.</Text>
        </Card>
        <Btn title="Log Out" variant="ghost" onPress={async () => { await logout(); router.replace("/"); }} testID="admin-logout-button" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoVal}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center" },
  name: { color: colors.text, fontWeight: "700", fontSize: 16 },
  dim: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  h: { color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: spacing.sm },
  infoRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textDim, fontSize: 12 },
  infoVal: { color: colors.text, fontWeight: "600", marginTop: 2 },
});
