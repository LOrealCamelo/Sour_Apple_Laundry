import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [qr, setQr] = useState("");
  const [lookupErr, setLookupErr] = useState("");

  const load = async () => { try { setOrders(await api("/admin/orders?status_filter=All")); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const lookup = async () => {
    setLookupErr("");
    try { const o: any = await api(`/admin/qr/${qr.trim()}`); router.push(`/admin-order/${o.id}`); }
    catch { setLookupErr("Order not found"); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-orders-screen">
      <View style={styles.head}>
        <Text style={styles.title}>All Orders</Text>
        <View style={styles.qrRow}>
          <TextInput testID="qr-lookup-input" value={qr} onChangeText={setQr} placeholder="Enter QR / order code (SA-XXXX)"
            placeholderTextColor={colors.textDim} autoCapitalize="characters" style={styles.qrInput} />
          <Pressable testID="qr-lookup-button" onPress={lookup} style={styles.qrBtn}><Ionicons name="search" size={20} color={colors.bg} /></Pressable>
        </View>
        {!!lookupErr && <Text style={styles.err}>{lookupErr}</Text>}
      </View>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}>
        {orders.map((o) => (
          <Pressable key={o.id} testID={`admin-allorder-${o.code}`} onPress={() => router.push(`/admin-order/${o.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.code}>{o.code}</Text>
                <Badge text={o.status} color={statusColor(o.status)} />
              </View>
              <Text style={styles.dim}>{o.student_name} · {o.service_type} · ${o.price?.toFixed(2)}</Text>
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
  qrRow: { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  qrInput: { flex: 1, height: 46, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  qrBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  err: { color: colors.danger, marginBottom: spacing.sm },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  dim: { color: colors.textDim, fontSize: 13 },
});
