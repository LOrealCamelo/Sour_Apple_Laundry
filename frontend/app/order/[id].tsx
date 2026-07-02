import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";
import OrderChat from "@/src/components/OrderChat";

const FLOW = ["Request Submitted", "Pending Admin Approval", "Approved", "Pickup Scheduled",
  "Picked Up", "Washing", "Drying", "Folding", "Quality Check", "Ready for Pickup",
  "Out for Delivery", "Delivered"];

export default function OrderTracking() {
  const { id, new: isNew, paid } = useLocalSearchParams<{ id: string; new?: string; paid?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [methods, setMethods] = useState<any>({});
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setOrder(await api(`/orders/${id}`));
      setMethods(await api("/payments/methods", { auth: false }));
    } catch {}
  };
  useFocusEffect(useCallback(() => {
    (async () => {
      if (paid === "1") { try { await api(`/payments/stripe/verify/${id}`, { method: "POST" }); } catch {} }
      await load();
    })();
  }, [id, paid]));

  if (!order) return <View style={styles.center}><ActivityIndicator color={colors.apple} /></View>;

  const doneStatuses = new Set(order.history.map((h: any) => h.status));
  const currentIdx = FLOW.indexOf(order.status);
  const isCollege = order.customer_type === "College Student";
  const act = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); await load(); } catch (e: any) { alert(e.message); } finally { setBusy(false); } };

  const payStripe = async () => {
    setBusy(true);
    try {
      const r: any = await api(`/payments/stripe/checkout/${id}`, { method: "POST" });
      await WebBrowser.openBrowserAsync(r.url);
      await api(`/payments/stripe/verify/${id}`, { method: "POST" }).catch(() => {});
      await load();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  };
  const payManual = (m: string) => act(() => api(`/payments/manual/${id}`, { method: "POST", body: { method: m } }));
  const rate = () => stars && act(() => api(`/orders/${id}/rate`, { method: "POST", body: { stars, feedback: "" } }));
  const reorder = async () => { try { const o: any = await api(`/orders/${id}/reorder`, { method: "POST" }); router.replace(`/order/${o.id}?new=1`); } catch (e: any) { alert(e.message); } };
  const confirmPickup = () => act(() => api(`/orders/${id}/confirm-pickup`, { method: "POST" }));
  const requestChange = () => act(() => api(`/orders/${id}/request-change`, { method: "POST", body: { note: "Customer requested a date/time change" } }));
  const cancel = () => act(() => api(`/orders/${id}/cancel`, { method: "POST" }));

  const canCancel = ["Request Submitted", "Pending Admin Approval", "Approved", "Needs Customer Follow-Up"].includes(order.status);
  const unpaid = order.payment_status === "Unpaid" || order.payment_status === "Processing";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="order-tracking-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
        <Badge text={order.status} color={statusColor(order.status)} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isNew === "1" && (
          <Card style={{ borderColor: colors.warn, backgroundColor: colors.warn + "18" }}>
            <Text style={styles.pendingTitle}>✅ Request submitted!</Text>
            <Text style={styles.pendingText}>Your request is pending Sour Apple VIP approval.</Text>
          </Card>
        )}

        {/* Tracking number */}
        <Card style={{ alignItems: "center", borderColor: colors.gold }}>
          <Text style={styles.trackLabel}>ORDER TRACKING NUMBER</Text>
          <Text style={styles.trackNumber} testID="order-tracking-number">{order.code}</Text>
          <Text style={styles.qrNote}>Show this to Sour Apple VIP for your order</Text>
        </Card>

        {/* Order info */}
        <Card>
          <View style={styles.row}><Text style={styles.svc}>{order.service_type}</Text><Text style={styles.type}>{order.customer_type}</Text></View>
          <Text style={styles.dim}>{order.bags} bag(s){order.rush ? " · RUSH" : ""}{order.bedding_addon ? " · Bedding" : ""}</Text>
          {isCollege && <Text style={styles.dim}>{order.college} · {order.dorm}</Text>}
          {!!order.directions && <Text style={styles.dim}>Directions: {order.directions}</Text>}
          <Text style={styles.dim}>Preferred: {order.pickup_date} · {order.pickup_window}</Text>
          {!!order.delivery_window && <Text style={styles.dimGold}>Delivery set: {order.delivery_date} {order.delivery_window}</Text>}
        </Card>

        {/* Payment */}
        <Card>
          <View style={styles.row}>
            <Text style={styles.price} testID="order-price">${order.price?.toFixed(2)}</Text>
            <Badge text={order.payment_status} color={order.payment_status === "Paid" ? colors.apple : colors.warn} />
          </View>
          {!!order.payment_method && order.payment_status !== "Unpaid" && <Text style={styles.dim}>Method: {order.payment_method}</Text>}
          {unpaid && order.status !== "Pending Admin Approval" && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.payHeader}>Pay now</Text>
              {methods.stripe_enabled && <Btn title="Pay with Card (Stripe)" variant="gold" onPress={payStripe} loading={busy} testID="pay-stripe-button" />}
              <Pressable testID="pay-cashapp" onPress={() => payManual("CashApp")} style={styles.manualBtn}>
                <Ionicons name="cash-outline" size={18} color={colors.apple} /><Text style={styles.manualText}>CashApp  {methods.cashapp}</Text>
              </Pressable>
              <Pressable testID="pay-venmo" onPress={() => payManual("Venmo")} style={styles.manualBtn}>
                <Ionicons name="logo-venmo" size={18} color={colors.info} /><Text style={styles.manualText}>Venmo  {methods.venmo}</Text>
              </Pressable>
              <Text style={styles.smallNote}>For CashApp/Venmo, send to the handle above with your tracking # in the note. We'll confirm it in-app.</Text>
            </View>
          )}
          {order.payment_status === "Pending Confirmation" && <Text style={styles.dimGold}>Waiting for Sour Apple VIP to confirm your {order.payment_method} payment.</Text>}
        </Card>

        {/* Tracking timeline */}
        <Text style={styles.section}>Order tracking</Text>
        <Card>
          {FLOW.map((s, i) => {
            const done = doneStatuses.has(s); const current = i === currentIdx;
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

        {/* Confirm pickup */}
        {order.status === "Ready for Pickup" && !order.pickup_confirmed && (
          <Btn title="Confirm Pickup Time" onPress={confirmPickup} loading={busy} testID="confirm-pickup-button" />
        )}
        {order.pickup_confirmed && <Card><Text style={styles.dimGold}>✅ You confirmed your pickup.</Text></Card>}

        {/* Messaging */}
        <Text style={styles.section}>Messages</Text>
        <Card><OrderChat orderId={id!} myRole={user?.role || "STUDENT"} /></Card>

        {/* Change / cancel */}
        {canCancel && (
          <View style={styles.actionRow}>
            <Pressable testID="request-change-button" onPress={requestChange} style={styles.actionBtn}><Text style={styles.actionText}>Request Change</Text></Pressable>
            <Pressable testID="cancel-order-button" onPress={cancel} style={[styles.actionBtn, { borderColor: colors.danger }]}><Text style={[styles.actionText, { color: colors.danger }]}>Cancel Order</Text></Pressable>
          </View>
        )}

        {/* Rate */}
        {order.status === "Delivered" && order.rating == null && (
          <Card>
            <Text style={styles.section2}>Rate your service</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} testID={`star-${n}`} onPress={() => setStars(n)}><Ionicons name={n <= stars ? "star" : "star-outline"} size={32} color={colors.gold} /></Pressable>
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
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  pendingTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  pendingText: { color: colors.text, marginTop: 4 },
  trackLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  trackNumber: { color: colors.gold, fontWeight: "900", fontSize: 22, marginTop: 8, textAlign: "center" },
  qrNote: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  svc: { color: colors.text, fontWeight: "700", fontSize: 16, flex: 1 },
  type: { color: colors.info, fontSize: 12, fontWeight: "700" },
  dim: { color: colors.textDim, marginTop: 6, fontSize: 13 },
  dimGold: { color: colors.gold, marginTop: 6, fontSize: 13, fontWeight: "600" },
  price: { color: colors.apple, fontWeight: "800", fontSize: 22 },
  payHeader: { color: colors.text, fontWeight: "700", marginBottom: 4 },
  manualBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  manualText: { color: colors.text, fontWeight: "700" },
  smallNote: { color: colors.textDim, fontSize: 12, marginTop: 8, lineHeight: 17 },
  section: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },
  section2: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginRight: 12, alignItems: "center", justifyContent: "center" },
  stepText: { color: colors.textDim, fontSize: 14 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.text, fontWeight: "700" },
  stars: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
});
