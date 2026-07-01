import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";

export default function AvailableJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const load = async () => { try { setJobs(await api("/driver/jobs/open")); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const claim = async (id: string) => {
    setBusy(id);
    try { await api(`/driver/jobs/${id}/claim`, { method: "POST" }); await load(); }
    catch (e: any) { alert(e.message); } finally { setBusy(""); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-available-screen">
      <Text style={styles.title}>Available Jobs</Text>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.apple} />}>
        {jobs.length === 0 && <Text style={styles.empty}>No open jobs right now. Pull to refresh.</Text>}
        {jobs.map((j) => (
          <Card key={j.id} testID={`job-card-${j.order_code}`}>
            <View style={styles.row}>
              <Text style={styles.code}>{j.order_code}</Text>
              <Badge text={j.job_type} color={colors.info} />
            </View>
            <View style={styles.metaRow}><Ionicons name="location" size={15} color={colors.textDim} /><Text style={styles.dim}>{j.campus} · {j.building}</Text></View>
            <View style={styles.metaRow}><Ionicons name="time" size={15} color={colors.textDim} /><Text style={styles.dim}>Pickup {j.pickup_window} · Delivery {j.delivery_window}</Text></View>
            {!!j.special_instructions && <Text style={styles.dim}>Note: {j.special_instructions}</Text>}
            <View style={styles.payRow}>
              <Text style={styles.payout}>${j.payout} payout</Text>
              <Text style={styles.dist}>~1.2 mi</Text>
            </View>
            <Btn title={j.auto_assign_first_claim ? "Claim Job" : "Request Job"} onPress={() => claim(j.id)} loading={busy === j.id} testID={`claim-${j.order_code}`} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, padding: spacing.lg, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  empty: { color: colors.textDim },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  code: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dim: { color: colors.textDim, fontSize: 13 },
  payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: spacing.sm },
  payout: { color: colors.apple, fontWeight: "800", fontSize: 18 },
  dist: { color: colors.textDim, fontSize: 13 },
});
