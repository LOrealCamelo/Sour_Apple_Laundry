import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api/client";
import { colors, spacing, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { setOrders(await api("/orders/my")); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="orders-screen">
      <Text style={styles.title}>My Orders</Text>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.apple} />}>
        {orders.length === 0 && <Text style={styles.empty}>No orders yet.</Text>}
        {orders.map((o) => (
          <Pressable key={o.id} testID={`history-order-${o.code}`} onPress={() => router.push(`/order/${o.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.code}>{o.code}</Text>
                <Badge text={o.status} color={statusColor(o.status)} />
              </View>
              <Text style={styles.svc}>{o.service_type} · {o.bags} bag(s) · ${o.price?.toFixed(2)}</Text>
              <Text style={styles.dim}>Pickup {o.pickup_date} · {o.pickup_window}</Text>
              {o.status === "Delivered" && o.rating == null && (
                <Text style={styles.rate}>Tap to rate this order →</Text>
              )}
            </Card>
          </Pressable>
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
  svc: { color: colors.text, fontWeight: "600" },
  dim: { color: colors.textDim, marginTop: 4, fontSize: 13 },
  rate: { color: colors.apple, marginTop: 8, fontWeight: "600" },
});
