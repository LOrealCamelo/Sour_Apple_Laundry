import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

export default function StudentHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setOrders(await api("/orders/my")); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const active = orders.filter((o) => !["Delivered", "Rejected"].includes(o.status));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="student-home">
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.apple} />}>
        <Text style={styles.hi}>Hi, {user?.name?.split(" ")[0]} 👋</Text>
        <Text style={styles.sub}>{user?.campus || "Your campus"} · {user?.building}</Text>

        <Pressable testID="schedule-cta" style={styles.cta} onPress={() => router.push("/(student)/schedule")}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Schedule a pickup</Text>
            <Text style={styles.ctaSub}>Wash & Fold, Dry Cleaning & more</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={40} color={colors.bg} />
        </Pressable>

        <Text style={styles.section}>Active orders</Text>
        {active.length === 0 && <Text style={styles.empty}>No active orders. Schedule your first pickup!</Text>}
        {active.map((o) => (
          <Pressable key={o.id} testID={`order-card-${o.code}`} onPress={() => router.push(`/order/${o.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.code}>{o.code}</Text>
                <Badge text={o.status} color={statusColor(o.status)} />
              </View>
              <Text style={styles.svc}>{o.service_type} · {o.bags} bag(s)</Text>
              <Text style={styles.dim}>Pickup {o.pickup_date} · {o.pickup_window}</Text>
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
  content: { padding: spacing.lg, paddingBottom: 40 },
  hi: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { color: colors.textDim, marginTop: 2, marginBottom: spacing.lg },
  cta: { backgroundColor: colors.apple, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  ctaTitle: { fontSize: 20, fontWeight: "800", color: colors.bg },
  ctaSub: { color: colors.bg, opacity: 0.8, marginTop: 4 },
  section: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  empty: { color: colors.textDim },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  code: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  svc: { color: colors.text, fontWeight: "600", fontSize: 15 },
  dim: { color: colors.textDim, marginTop: 4, fontSize: 13 },
  price: { color: colors.apple, fontWeight: "800", fontSize: 18, marginTop: 8 },
});
