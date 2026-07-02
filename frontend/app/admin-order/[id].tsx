import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius, statusColor } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";
import OrderChat from "@/src/components/OrderChat";

const NEXT_STATUS = ["Picked Up", "Checked In", "Washing", "Drying", "Folding", "Quality Check", "Ready for Pickup", "Out for Delivery", "Delivered", "Cancelled"];
const JOB_TYPES = ["Pickup", "Delivery", "Pickup + Delivery"];

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [jobType, setJobType] = useState("Pickup");
  const [payout, setPayout] = useState("12");
  const [autoAssign, setAutoAssign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [schedPickup, setSchedPickup] = useState("");
  const [schedDelDate, setSchedDelDate] = useState("");
  const [schedDelTime, setSchedDelTime] = useState("");

  const load = async () => {
    try {
      const o: any = await api(`/orders/${id}`); setOrder(o); setPrice(String(o.price));
      const allJobs: any[] = await api("/admin/jobs");
      setJobs(allJobs.filter((j) => j.order_id === id));
      setDrivers(await api("/admin/drivers"));
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, [id]));
  if (!order) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  const act = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); await load(); } catch (e: any) { alert(e.message); } finally { setBusy(false); } };
  const approve = () => act(() => api(`/admin/orders/${id}/approve`, { method: "POST", body: { price: parseFloat(price), admin_note: note } }));
  const reject = () => act(() => api(`/admin/orders/${id}/reject`, { method: "POST", body: { reason: note || "Rejected" } }));
  const release = () => act(() => api(`/admin/orders/${id}/release`, { method: "POST", body: { job_type: jobType, payout: parseFloat(payout), auto_assign_first_claim: autoAssign } }));
  const setStatus = (s: string) => act(() => api(`/admin/orders/${id}/status`, { method: "POST", body: { status: s } }));
  const markPaid = () => act(() => api(`/admin/orders/${id}/payment`, { method: "POST", body: { status: order.payment_status === "Paid" ? "Unpaid" : "Paid" } }));
  const assign = (jobId: string, driverId: string) => act(() => api(`/admin/jobs/${jobId}/assign`, { method: "POST", body: { status: driverId } }));
  const saveSchedule = () => act(() => api(`/admin/orders/${id}/schedule`, { method: "POST", body: { pickup_window: schedPickup || undefined, delivery_date: schedDelDate || undefined, delivery_window: schedDelTime || undefined } }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-order-detail">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
        <Text style={styles.hTitle}>{order.code}</Text>
        <Badge text={order.status} color={statusColor(order.status)} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.h}>Customer</Text>
          <Text style={styles.txt}>{order.student_name} · {order.phone}</Text>
          <Text style={styles.dim}>{order.customer_type}{order.college ? ` · ${order.college}` : ""}</Text>
          {!!order.dorm && <Text style={styles.dim}>Dorm/Building: {order.dorm}</Text>}
          {!!order.directions && <Text style={styles.dim}>Directions: {order.directions}</Text>}
        </Card>
        {order.change_request && (
          <Card style={{ borderColor: colors.warn, backgroundColor: colors.warn + "18" }}>
            <Text style={styles.txt}>⚠️ Customer requested a change</Text>
            <Text style={styles.dim}>{order.change_request.note}</Text>
          </Card>
        )}
        {order.pickup_confirmed && (
          <Card style={{ borderColor: colors.apple }}><Text style={styles.txt}>✅ Customer confirmed pickup</Text></Card>
        )}
        <Card>
          <Text style={styles.h}>Order</Text>
          <Text style={styles.txt}>{order.service_type} · {order.bags} bag(s){order.rush ? " · RUSH" : ""}{order.bedding_addon ? " · Bedding" : ""}</Text>
          <Text style={styles.dim}>Preferred: {order.pickup_date} {order.pickup_window}</Text>
          {!!order.delivery_window && <Text style={styles.dim}>Delivery set: {order.delivery_date} {order.delivery_window}</Text>}
          {order.preferences?.length > 0 && <Text style={styles.dim}>Prefs: {order.preferences.join(", ")}</Text>}
          {!!order.stain_notes && <Text style={styles.dim}>Notes: {order.stain_notes}</Text>}
          <View style={styles.payRow}>
            <Badge text={order.payment_status + (order.payment_method ? ` · ${order.payment_method}` : "")} color={order.payment_status === "Paid" ? colors.apple : colors.warn} />
            <Pressable testID="toggle-payment" onPress={markPaid}><Text style={styles.link}>Mark {order.payment_status === "Paid" ? "Unpaid" : "Paid"}</Text></Pressable>
          </View>
        </Card>
        <Card>
          <Text style={styles.h}>Set Times (you control scheduling)</Text>
          <Text style={styles.label}>Confirmed pickup time</Text>
          <TextInput testID="sched-pickup" value={schedPickup} onChangeText={setSchedPickup} style={styles.input} placeholder="e.g. Wed 06/25 10:00 AM EST" placeholderTextColor={colors.textDim} />
          <Text style={styles.label}>Delivery date (mm/dd/yyyy)</Text>
          <TextInput testID="sched-deldate" value={schedDelDate} onChangeText={setSchedDelDate} style={styles.input} placeholder="06/27/2026" placeholderTextColor={colors.textDim} />
          <Text style={styles.label}>Delivery time</Text>
          <TextInput testID="sched-deltime" value={schedDelTime} onChangeText={setSchedDelTime} style={styles.input} placeholder="e.g. 4:00 PM EST" placeholderTextColor={colors.textDim} />
          <Btn title="Save Schedule" onPress={saveSchedule} loading={busy} testID="save-schedule-button" />
        </Card>
        <Card>
          <Text style={styles.h}>Messages</Text>
          <OrderChat orderId={id!} myRole="ADMIN" />
        </Card>

        {order.status === "Pending Admin Approval" && (
          <Card>
            <Text style={styles.h}>Review & Decide</Text>
            <Text style={styles.label}>Adjust price ($)</Text>
            <TextInput testID="price-input" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textDim} />
            <Text style={styles.label}>Note (optional / rejection reason)</Text>
            <TextInput testID="admin-note-input" value={note} onChangeText={setNote} style={styles.input} placeholder="Internal / customer note" placeholderTextColor={colors.textDim} />
            <Btn title="Approve Request" onPress={approve} loading={busy} testID="approve-button" />
            <Btn title="Reject" variant="ghost" onPress={reject} testID="reject-button" />
          </Card>
        )}

        {["Approved", "Pickup Job Released", "Delivery Job Released", "Quality Check", "Driver Assigned"].includes(order.status) && (
          <Card>
            <Text style={styles.h}>Release Driver Job</Text>
            <View style={styles.chipsRow}>
              {JOB_TYPES.map((t) => (
                <Pressable key={t} testID={`jobtype-${t}`} onPress={() => setJobType(t)} style={[styles.chip, jobType === t && styles.chipActive]}>
                  <Text style={[styles.chipText, jobType === t && { color: colors.bg }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Driver payout ($)</Text>
            <TextInput testID="payout-input" value={payout} onChangeText={setPayout} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textDim} />
            <Pressable testID="auto-assign-toggle" onPress={() => setAutoAssign(!autoAssign)} style={styles.toggleRow}>
              <Text style={styles.txt}>Auto-assign first driver who claims</Text>
              <View style={[styles.switch, autoAssign && { backgroundColor: colors.apple, alignItems: "flex-end" }]}><View style={styles.knob} /></View>
            </Pressable>
            <Btn title="Release to Driver Marketplace" onPress={release} loading={busy} testID="release-job-button" />
          </Card>
        )}

        {jobs.map((j) => (
          <Card key={j.id} testID={`job-${j.id}`}>
            <View style={styles.row}><Text style={styles.h}>{j.job_type} Job</Text><Badge text={j.status} color={statusColor(j.status === "Open" ? "Pending" : "Approved")} /></View>
            <Text style={styles.dim}>Payout ${j.payout} {j.driver_name ? `· Driver: ${j.driver_name}` : ""}</Text>
            {j.requests?.length > 0 && j.status !== "Assigned" && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Driver requests</Text>
                {j.requests.map((r: any) => (
                  <View key={r.driver_id} style={styles.reqRow}>
                    <Text style={styles.txt}>{r.driver_name}</Text>
                    <Pressable testID={`assign-${r.driver_id}`} onPress={() => assign(j.id, r.driver_id)} style={styles.assignBtn}><Text style={styles.assignText}>Assign</Text></Pressable>
                  </View>
                ))}
              </View>
            )}
            {j.status === "Open" && j.requests?.length === 0 && drivers.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Assign manually</Text>
                {drivers.map((d) => (
                  <View key={d.id} style={styles.reqRow}>
                    <Text style={styles.txt}>{d.name}</Text>
                    <Pressable testID={`manual-assign-${d.id}`} onPress={() => assign(j.id, d.id)} style={styles.assignBtn}><Text style={styles.assignText}>Assign</Text></Pressable>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ))}

        <Card>
          <Text style={styles.h}>Update Laundry Status</Text>
          <View style={styles.chipsRow}>
            {NEXT_STATUS.map((s) => (
              <Pressable key={s} testID={`status-${s}`} onPress={() => setStatus(s)} style={[styles.chip, order.status === s && styles.chipActive]}>
                <Text style={[styles.chipText, order.status === s && { color: colors.bg }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
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
  h: { color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 6 },
  txt: { color: colors.text, fontSize: 15 },
  dim: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  label: { color: colors.textDim, fontSize: 13, marginBottom: 6, marginTop: 8, fontWeight: "600" },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, height: 46, paddingHorizontal: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: spacing.sm },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  link: { color: colors.apple, fontWeight: "700" },
  reqRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  assignBtn: { backgroundColor: colors.apple, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm },
  assignText: { color: colors.bg, fontWeight: "700" },
});
