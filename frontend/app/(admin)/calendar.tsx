import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

export default function AdminCalendar() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { setOrders(await api("/admin/calendar")); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  // group by pickup_date
  const groups: Record<string, any[]> = {};
  orders.forEach((o) => {
    const d = o.pickup_date || "Unscheduled";
    (groups[d] = groups[d] || []).push(o);
  });
  const dates = Object.keys(groups);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-calendar-screen">
      <Text style={styles.title}>Job Calendar</Text>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}>
        {dates.length === 0 && <Text style={styles.empty}>No confirmed jobs yet. Approved orders appear here by date.</Text>}
        {dates.map((d) => (
          <View key={d} style={{ marginBottom: spacing.lg }}>
            <View style={styles.dateHeader}>
              <Ionicons name="calendar" size={16} color={colors.gold} />
              <Text style={styles.dateText}>{d}</Text>
              <Text style={styles.countText}>{groups[d].length} job(s)</Text>
            </View>
            {groups[d].map((o) => (
              <Pressable key={o.id} testID={`cal-order-${o.code}`} onPress={() => router.push(`/admin-order/${o.id}`)}>
                <Card style={{ marginBottom: spacing.sm }}>
                  <View style={styles.row}>
                    <Text style={styles.code}>{o.code}</Text>
                    <Badge text={o.status} color={statusColor(o.status)} />
                  </View>
                  <Text style={styles.dim}>{o.student_name} · {o.pickup_window}</Text>
                  {!!o.delivery_window && <Text style={styles.dimGold}>Delivery: {o.delivery_date} {o.delivery_window}</Text>}
                  {o.change_request && <Text style={styles.change}>⚠️ Change requested</Text>}
                </Card>
              </Pressable>
            ))}
          </View>
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
  dateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  dateText: { color: colors.text, fontWeight: "800", fontSize: 15 },
  countText: { color: colors.textDim, fontSize: 12, marginLeft: "auto" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  code: { color: colors.gold, fontWeight: "800", fontSize: 14 },
  dim: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  dimGold: { color: colors.gold, fontSize: 12, marginTop: 4, fontWeight: "600" },
  change: { color: colors.warn, fontSize: 12, marginTop: 4, fontWeight: "700" },
});
