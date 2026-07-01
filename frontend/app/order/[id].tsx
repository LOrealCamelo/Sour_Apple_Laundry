import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";

const FLOW = ["Request Submitted", "Pending Admin Approval", "Approved", "Pickup Job Released",
  "Driver Assigned", "Pickup Scheduled", "Picked Up", "Checked In", "Washing", "Drying",
  "Folding", "Quality Check", "Delivery Job Released", "Out for Delivery", "Delivered"];

export default function OrderTracking() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [stars, setStars] = useState(0);
  const [paying, setPaying] = useState(false);

  const load = async () => { try { setOrder(await api(`/orders/${id}`)); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, [id]));

  if (!order) return <View style={styles.center}><ActivityIndicator color={colors.apple} /></View>;

  const doneStatuses = new Set(order.history.map((h: any) => h.status));
  const currentIdx = FLOW.indexOf(order.status);

  const pay = async () => {
    setPaying(true);
    try { await api(`/payments/checkout/${id}`, { method: "POST" }); await load(); }
    catch (e: any) { alert(e.message); } finally { setPaying(false); }
  };
  const rate = async () => {
    if (!stars) return;
    try { await api(`/orders/${id}/rate`, { method: "POST", body: { stars, feedback: "" } }); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const reorder = async () => {
    try { const o: any = await api(`/orders/${id}/reorder`, { method: "POST" }); router.replace(`/order/${o.id}?new=1`); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="order-tracking-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
        <Text style={styles.hTitle}>{order.code}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isNew === "1" && (
          <Card style={{ borderColor: colors.warn, backgroundColor: colors.warn + "18" }}>
            <Text style={styles.pendingTitle}>✅ Request submitted!</Text>
            <Text style={styles.pendingText}>Your request is pending Sour Apple VIP approval.</Text>
          </Card>
        )}

        <Card style={{ alignItems: "center" }}>
          <QRCode value={order.qr_code} size={140} backgroundColor={colors.surface} color={colors.text} />
          <Text style={styles.qrCode} testID="order-qr-code">{order.qr_code}</Text>
          <Text style={styles.qrNote}>Attach to your laundry bag</Text>
        </Card>

        <Card>
          <View style={styles.row}><Text style={styles.svc}>{order.service_type}</Text><Badge text={order.status} color={statusColor(order.status)} /></View>
          <Text style={styles.dim}>{order.bags} bag(s) · Pickup {order.pickup_date} {order.pickup_window}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price} testID="order-price">${order.price?.toFixed(2)}</Text>
            <Badge text={order.payment_status} color={order.payment_status === "Paid" ? colors.apple : colors.warn} />
          </View>
          {order.payment_status !== "Paid" && order.status === "Approved" && (
            <Btn title="Pay Now" variant="gold" onPress={pay} loading={paying} testID="pay-button" />
          )}
        </Card>

        <Text style={styles.section}>Order tracking</Text>
        <Card>
          {FLOW.map((s, i) => {
            const done = doneStatuses.has(s);
            const current = i === currentIdx;
            return (
              <View key={s} style={styles.stepRow}>
                <View style={[styles.dot, done && { backgroundColor: colors.apple, borderColor: colors.apple }, current && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                  {done && <Ionicons name="checkmark" size={12} color={colors.bg} />}
                </View>
                <Text style={[styles.stepText, (done || current) && { color: colors.text, fontWeight: "700" }]}>{s}</Text>
              </View>
            );
          })}
        </Card>

        {order.status === "Delivered" && order.rating == null && (
          <Card>
            <Text style={styles.section2}>Rate your service</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} testID={`star-${n}`} onPress={() => setStars(n)}>
                  <Ionicons name={n <= stars ? "star" : "star-outline"} size={32} color={colors.gold} />
                </Pressable>
              ))}
            </View>
            <Btn title="Submit Rating" onPress={rate} testID="submit-rating-button" />
          </Card>
        )}
        {order.rating != null && <Card><Text style={styles.dim}>You rated this order {order.rating} ★</Text></Card>}

        <Btn title="Reorder this service" variant="ghost" onPress={reorder} testID="reorder-button" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  hTitle: { color: colors.gold, fontWeight: "800", fontSize: 18 },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  pendingTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  pendingText: { color: colors.text, marginTop: 4 },
  qrCode: { color: colors.gold, fontWeight: "800", fontSize: 18, marginTop: spacing.md },
  qrNote: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  svc: { color: colors.text, fontWeight: "700", fontSize: 16 },
  dim: { color: colors.textDim, marginTop: 6, fontSize: 13 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  price: { color: colors.apple, fontWeight: "800", fontSize: 22 },
  section: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },
  section2: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginRight: 12, alignItems: "center", justifyContent: "center" },
  stepText: { color: colors.textDim, fontSize: 14 },
  stars: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
});
