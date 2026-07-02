import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

const FILTERS = ["Pending Admin Approval", "Approved", "All"];

export default function AdminRequests() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>({ total: 0, pending: 0, changes: 0 });
  const [filter, setFilter] = useState("Pending Admin Approval");
  const [refreshing, setRefreshing] = useState(false);

  const load = async (f = filter) => {
    try { setOrders(await api(`/admin/orders?status_filter=${encodeURIComponent(f)}`)); } catch {}
    try { setAlerts(await api("/admin/alerts")); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, [filter]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-requests-screen">
      <View style={styles.head}>
        <Text style={styles.title}>Booking Requests</Text>
        {alerts.total > 0 && (
          <View style={styles.alertBanner} testID="alerts-banner">
            <Ionicons name="notifications" size={18} color={colors.bg} />
            <Text style={styles.alertText}>{alerts.pending} new request(s){alerts.changes > 0 ? ` · ${alerts.changes} change request(s)` : ""}</Text>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {FILTERS.map((f) => (
            <Pressable key={f} testID={`filter-${f}`} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
              <Text style={[styles.chipText, filter === f && { color: colors.bg }]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}>
        {orders.length === 0 && <Text style={styles.empty}>No requests here.</Text>}
        {orders.map((o) => (
          <Pressable key={o.id} testID={`admin-order-${o.code}`} onPress={() => router.push(`/admin-order/${o.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.code}>{o.code}</Text>
                <Badge text={o.status} color={statusColor(o.status)} />
              </View>
              <Text style={styles.name}>{o.student_name} · {o.campus}</Text>
              <Text style={styles.dim}>{o.service_type} · {o.bags} bag(s) · {o.building} {o.room}</Text>
              <Text style={styles.price}>${o.price?.toFixed(2)}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.gold, borderRadius: 12, padding: 12, marginBottom: spacing.md },
  alertText: { color: colors.bg, fontWeight: "800", fontSize: 13, flex: 1 },
  chipsRow: { gap: 8, paddingBottom: spacing.md },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  empty: { color: colors.textDim },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  name: { color: colors.text, fontWeight: "700" },
  dim: { color: colors.textDim, marginTop: 4, fontSize: 13 },
  price: { color: colors.apple, fontWeight: "800", fontSize: 18, marginTop: 8 },
});
