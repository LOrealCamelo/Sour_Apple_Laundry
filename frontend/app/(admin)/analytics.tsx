import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";
import { Card } from "@/src/components/UI";

export default function Analytics() {
  const [a, setA] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { setA(await api("/admin/analytics")); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const stats = a ? [
    { label: "Total Orders", value: a.total_orders, icon: "cube", color: colors.info },
    { label: "Revenue Est.", value: `$${a.revenue_estimate}`, icon: "cash", color: colors.apple },
    { label: "Active Students", value: a.active_students, icon: "school", color: colors.gold },
    { label: "Active Drivers", value: a.active_drivers, icon: "car", color: colors.info },
    { label: "Pending Requests", value: a.pending_requests, icon: "time", color: colors.warn },
    { label: "Open Driver Jobs", value: a.open_driver_jobs, icon: "briefcase", color: colors.apple },
    { label: "Completed Pickups", value: a.completed_pickups, icon: "checkmark-done", color: colors.info },
    { label: "Completed Deliveries", value: a.completed_deliveries, icon: "flag", color: colors.apple },
  ] : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="analytics-screen">
      <Text style={styles.title}>Analytics</Text>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}>
        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard} testID={`stat-${s.label}`}>
              <Ionicons name={s.icon as any} size={22} color={s.color} />
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
        {a && (
          <Card>
            <Text style={styles.cardTitle}>Most requested service</Text>
            <Text style={styles.big}>{a.most_requested_service}</Text>
          </Card>
        )}
        {a && (
          <Card>
            <Text style={styles.cardTitle}>Orders by campus</Text>
            {Object.entries(a.orders_by_campus).map(([k, v]) => (
              <View key={k} style={styles.campusRow}><Text style={styles.campusName}>{k}</Text><Text style={styles.campusVal}>{v as number}</Text></View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, padding: spacing.lg, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  statCard: { width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statVal: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 8 },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  cardTitle: { color: colors.textDim, fontSize: 13, marginBottom: 6 },
  big: { color: colors.apple, fontSize: 20, fontWeight: "800" },
  campusRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  campusName: { color: colors.text },
  campusVal: { color: colors.gold, fontWeight: "700" },
});
