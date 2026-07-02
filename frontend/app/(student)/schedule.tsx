import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";
import { Btn, Field, Card } from "@/src/components/UI";

const SERVICES = ["Wash & Fold", "Dry Cleaning", "Bedding", "Towels", "Rush Laundry", "Subscription Laundry Plan"];
const PREFS = ["Cold wash only", "Hang dry items", "Separate whites/colors", "Extra fabric softener", "No detergent scent"];
const BAG_SIZES = [
  { key: "small", label: "Small", price: 5 },
  { key: "medium", label: "Medium", price: 8 },
  { key: "large", label: "Large", price: 12 },
];

export default function Schedule() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const isNeighbor = user?.role === "NEIGHBOR";

  const [services, setServices] = useState<string[]>(["Wash & Fold"]);
  const [bags, setBags] = useState(1);
  const [rush, setRush] = useState(false);
  const [bedding, setBedding] = useState(false);
  const [brandedBags, setBrandedBags] = useState<Record<string, number>>({ small: 0, medium: 0, large: 0 });
  const [prefs, setPrefs] = useState<string[]>([]);
  const [stain, setStain] = useState("");
  const [pickupDate, setPickupDate] = useState("2026-06-25");
  const [pickupWindow, setPickupWindow] = useState("9am - 12pm");
  const [deliveryDate, setDeliveryDate] = useState("2026-06-27");
  const [deliveryWindow, setDeliveryWindow] = useState("3pm - 6pm");
  const [dropDate, setDropDate] = useState("2026-06-25");
  const [estimate, setEstimate] = useState(0);
  const [aiTips, setAiTips] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api("/orders/estimate", { method: "POST", auth: false, body: { services, bags, rush, bedding_addon: bedding, branded_bags: brandedBags } })
      .then((r: any) => setEstimate(r.estimate)).catch(() => {});
  }, [services, bags, rush, bedding, brandedBags]);

  const toggleService = (s: string) => setServices((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const togglePref = (p: string) => setPrefs((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);
  const setBag = (size: string, delta: number) => setBrandedBags((b) => ({ ...b, [size]: Math.max(0, (b[size] || 0) + delta) }));

  const getAiTips = async () => {
    if (!stain.trim()) return;
    setAiLoading(true);
    try { const r: any = await api("/ai/stain-tips", { method: "POST", body: { notes: stain, service_type: services.join(", ") } }); setAiTips(r.tips); }
    catch { setAiTips("Could not load tips right now."); } finally { setAiLoading(false); }
  };

  const submit = async () => {
    if (isGuest) { router.push("/register"); return; }
    if (services.length === 0) { alert("Select at least one service"); return; }
    setSubmitting(true);
    try {
      const body: any = {
        services, order_type: isNeighbor ? "Neighborhood Drop-off" : "Pickup & Delivery",
        branded_bags: brandedBags, bags, rush, bedding_addon: bedding,
        preferences: prefs, stain_notes: stain, photos: [],
        pickup_date: isNeighbor ? dropDate : pickupDate,
        pickup_window: isNeighbor ? "Self drop-off" : pickupWindow,
        delivery_date: isNeighbor ? dropDate : deliveryDate,
        delivery_window: isNeighbor ? "Self pickup" : deliveryWindow,
      };
      const order: any = await api("/orders", { method: "POST", body });
      router.replace(`/order/${order.id}?new=1`);
    } catch (e: any) { alert(e.message); } finally { setSubmitting(false); }
  };

  const brandedTotal = BAG_SIZES.reduce((sum, b) => sum + b.price * (brandedBags[b.key] || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="schedule-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{isNeighbor ? "Drop-off Order" : "Schedule Pickup"}</Text>
          {isGuest && (
            <Card style={{ borderColor: colors.gold, backgroundColor: colors.gold + "18" }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>You're browsing as a guest.</Text>
              <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 13 }}>Explore & estimate freely — sign up when you're ready to submit.</Text>
            </Card>
          )}
          {isNeighbor && (
            <Card style={{ borderColor: colors.info }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Neighborhood service</Text>
              <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 13 }}>Drop off & pick up at our location — no driver pickup/delivery.</Text>
            </Card>
          )}

          <Text style={styles.label}>Services (choose one or more)</Text>
          <View style={styles.chipsWrap}>
            {SERVICES.map((s) => (
              <Pressable key={s} testID={`service-${s}`} onPress={() => toggleService(s)} style={[styles.chip, services.includes(s) && styles.chipActive]}>
                {services.includes(s) && <Ionicons name="checkmark" size={14} color={colors.bg} style={{ marginRight: 4 }} />}
                <Text style={[styles.chipText, services.includes(s) && { color: colors.bg }]}>{s}</Text>
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

          <Text style={styles.label}>Buy branded reusable bags (optional)</Text>
          <Card>
            {BAG_SIZES.map((b) => (
              <View key={b.key} style={styles.bagRow}>
                <View>
                  <Text style={styles.rowLabel}>{b.label} bag</Text>
                  <Text style={styles.bagPrice}>${b.price} each</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable testID={`bag-${b.key}-minus`} onPress={() => setBag(b.key, -1)} style={styles.stepBtn}><Ionicons name="remove" size={18} color={colors.text} /></Pressable>
                  <Text style={styles.stepVal}>{brandedBags[b.key] || 0}</Text>
                  <Pressable testID={`bag-${b.key}-plus`} onPress={() => setBag(b.key, 1)} style={styles.stepBtn}><Ionicons name="add" size={18} color={colors.text} /></Pressable>
                </View>
              </View>
            ))}
            {brandedTotal > 0 && <Text style={styles.bagTotal} testID="branded-bag-total">Branded bags: +${brandedTotal.toFixed(2)}</Text>}
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

          {isNeighbor ? (
            <Field label="Preferred drop-off date" testID="dropoff-date-input" value={dropDate} onChangeText={setDropDate} />
          ) : (<>
            <Field label="Pickup date" testID="pickup-date-input" value={pickupDate} onChangeText={setPickupDate} />
            <Field label="Pickup window" testID="pickup-window-input" value={pickupWindow} onChangeText={setPickupWindow} />
            <Field label="Delivery date" testID="delivery-date-input" value={deliveryDate} onChangeText={setDeliveryDate} />
            <Field label="Delivery window" testID="delivery-window-input" value={deliveryWindow} onChangeText={setDeliveryWindow} />
          </>)}

          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <View style={styles.stepRow}>
              <Text style={styles.rowLabel}>Estimated total</Text>
              <Text style={styles.estimate} testID="price-estimate">${estimate.toFixed(2)}</Text>
            </View>
          </Card>

          <Btn title={isGuest ? "Sign up to submit" : "Submit Request"} onPress={submit} loading={submitting} testID="submit-order-button" />
          <Text style={styles.note}>Your request goes to Sour Apple VIP for approval before {isNeighbor ? "drop-off" : "pickup"}.</Text>
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
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
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
  bagRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  bagPrice: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  bagTotal: { color: colors.gold, fontWeight: "700", marginTop: spacing.sm },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  aiBtnText: { color: colors.gold, fontWeight: "700" },
  aiTips: { color: colors.text, lineHeight: 22 },
  estimate: { color: colors.apple, fontSize: 24, fontWeight: "800" },
  note: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
});
