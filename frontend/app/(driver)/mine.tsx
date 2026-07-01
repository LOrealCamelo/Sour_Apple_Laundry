import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

const ACTIONS = ["On the way", "Arrived", "Picked up", "Dropped off", "Out for delivery", "Delivered"];

export default function MyJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { setJobs(await api("/driver/jobs/mine")); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const update = async (id: string, status: string) => {
    try { await api(`/driver/jobs/${id}/status`, { method: "POST", body: { status } }); await load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-myjobs-screen">
      <Text style={styles.title}>My Jobs</Text>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.apple} />}>
        {jobs.length === 0 && <Text style={styles.empty}>No jobs yet. Claim one from Available.</Text>}
        {jobs.map((j) => (
          <Card key={j.id} testID={`myjob-${j.order_code}`}>
            <View style={styles.row}>
              <Text style={styles.code}>{j.order_code}</Text>
              <Badge text={j.status} color={statusColor(j.status === "Completed" ? "Delivered" : "Approved")} />
            </View>
            <Text style={styles.dim}>{j.job_type} · {j.campus} · {j.building} · ${j.payout}</Text>
            {j.status === "Requested" && <Text style={styles.pending}>Waiting for admin approval…</Text>}
            {(j.status === "Assigned" || j.status === "In Progress") && (
              <View style={styles.chipsRow}>
                {ACTIONS.map((a) => (
                  <Pressable key={a} testID={`action-${a}`} onPress={() => update(j.id, a)} style={styles.chip}>
                    <Text style={styles.chipText}>{a}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  dim: { color: colors.textDim, fontSize: 13 },
  pending: { color: colors.warn, marginTop: 8, fontWeight: "600" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.apple },
  chipText: { color: colors.apple, fontSize: 13, fontWeight: "600" },
});
