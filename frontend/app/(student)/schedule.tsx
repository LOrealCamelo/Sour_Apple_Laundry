import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";
import { Btn, Field, Card } from "@/src/components/UI";

const SERVICES = ["Wash & Fold", "Dry Cleaning", "Bedding", "Towels", "Rush Laundry", "Subscription Laundry Plan"];
const PREFS = ["Cold wash only", "Hang dry items", "Separate whites/colors", "Extra fabric softener", "No detergent scent"];

export default function Schedule() {
  const router = useRouter();
  const [service, setService] = useState("Wash & Fold");
  const [bags, setBags] = useState(1);
  const [rush, setRush] = useState(false);
  const [bedding, setBedding] = useState(false);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [stain, setStain] = useState("");
  const [pickupDate, setPickupDate] = useState("2026-06-25");
  const [pickupWindow, setPickupWindow] = useState("9am - 12pm");
  const [deliveryDate, setDeliveryDate] = useState("2026-06-27");
  const [deliveryWindow, setDeliveryWindow] = useState("3pm - 6pm");
  const [estimate, setEstimate] = useState(0);
  const [aiTips, setAiTips] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api("/orders/estimate", { method: "POST", auth: false, body: { service_type: service, bags, rush, bedding_addon: bedding } })
      .then((r: any) => setEstimate(r.estimate)).catch(() => {});
  }, [service, bags, rush, bedding]);

  const togglePref = (p: string) => setPrefs((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);

  const getAiTips = async () => {
    if (!stain.trim()) return;
    setAiLoading(true);
    try { const r: any = await api("/ai/stain-tips", { method: "POST", body: { notes: stain, service_type: service } }); setAiTips(r.tips); }
    catch { setAiTips("Could not load tips right now."); } finally { setAiLoading(false); }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const order: any = await api("/orders", { method: "POST", body: {
        service_type: service, pickup_date: pickupDate, pickup_window: pickupWindow,
        delivery_date: deliveryDate, delivery_window: deliveryWindow, bags, rush,
        bedding_addon: bedding, preferences: prefs, stain_notes: stain, photos: [],
      }});
      router.replace(`/order/${order.id}?new=1`);
    } catch (e: any) { alert(e.message); } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="schedule-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Schedule Pickup</Text>

          <Text style={styles.label}>Service</Text>
          <View style={styles.chipsWrap}>
            {SERVICES.map((s) => (
              <Pressable key={s} testID={`service-${s}`} onPress={() => setService(s)} style={[styles.chip, service === s && styles.chipActive]}>
                <Text style={[styles.chipText, service === s && { color: colors.bg }]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Card>
            <View style={styles.stepRow}>
              <Text style={styles.rowLabel}>Bags</Text>
              <View style={styles.stepper}>
                <Pressable testID="bags-minus" onPress={() => setBags((b) => Math.max(1, b - 1))} style={styles.stepBtn}><Ionicons name="remove" size={20} color={colors.text} /></Pressable>
                <Text style={styles.stepVal}>{bags}</Text>
                <Pressable testID="bags-plus" onPress={() => setBags((b) => b + 1)} style={styles.stepBtn}><Ionicons name="add" size={20} color={colors.text} /></Pressable>
              </View>
            </View>
            <Toggle label="Rush service (+$10)" value={rush} onToggle={() => setRush(!rush)} testID="rush-toggle" />
            <Toggle label="Bedding add-on (+$8)" value={bedding} onToggle={() => setBedding(!bedding)} testID="bedding-toggle" />
          </Card>

          <Text style={styles.label}>Laundry preferences</Text>
          <View style={styles.chipsWrap}>
            {PREFS.map((p) => (
              <Pressable key={p} testID={`pref-${p}`} onPress={() => togglePref(p)} style={[styles.chip, prefs.includes(p) && styles.chipActive]}>
                <Text style={[styles.chipText, prefs.includes(p) && { color: colors.bg }]}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <Field label="Stain / special notes" testID="stain-input" value={stain} onChangeText={setStain} placeholder="e.g. coffee stain on white shirt" multiline />
          <Pressable testID="ai-tips-button" onPress={getAiTips} style={styles.aiBtn}>
            <Ionicons name="sparkles" size={16} color={colors.gold} />
            <Text style={styles.aiBtnText}>Get AI stain-care tips</Text>
          </Pressable>
          {aiLoading && <ActivityIndicator color={colors.gold} style={{ marginVertical: 8 }} />}
          {!!aiTips && <Card style={{ borderColor: colors.gold }}><Text style={styles.aiTips} testID="ai-tips-result">{aiTips}</Text></Card>}

          <Field label="Pickup date" testID="pickup-date-input" value={pickupDate} onChangeText={setPickupDate} />
          <Field label="Pickup window" testID="pickup-window-input" value={pickupWindow} onChangeText={setPickupWindow} />
          <Field label="Delivery date" testID="delivery-date-input" value={deliveryDate} onChangeText={setDeliveryDate} />
          <Field label="Delivery window" testID="delivery-window-input" value={deliveryWindow} onChangeText={setDeliveryWindow} />

          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <View style={styles.stepRow}>
              <Text style={styles.rowLabel}>Estimated total</Text>
              <Text style={styles.estimate} testID="price-estimate">${estimate.toFixed(2)}</Text>
            </View>
          </Card>

          <Btn title="Submit Request" onPress={submit} loading={submitting} testID="submit-order-button" />
          <Text style={styles.note}>Your request goes to Sour Apple VIP for approval before pickup.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Toggle({ label, value, onToggle, testID }: { label: string; value: boolean; onToggle: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onToggle} style={styles.toggleRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.switch, value && { backgroundColor: colors.apple, alignItems: "flex-end" }]}>
        <View style={styles.knob} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },
  label: { color: colors.textDim, fontSize: 13, marginBottom: 8, fontWeight: "600" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.apple, borderColor: colors.apple },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  stepRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepVal: { color: colors.text, fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  aiBtnText: { color: colors.gold, fontWeight: "700" },
  aiTips: { color: colors.text, lineHeight: 22 },
  estimate: { color: colors.apple, fontSize: 24, fontWeight: "800" },
  note: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
});
