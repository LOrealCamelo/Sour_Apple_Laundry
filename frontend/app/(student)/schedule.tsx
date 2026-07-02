import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";
import { Btn, Field, Card } from "@/src/components/UI";

const SERVICES = ["Wash & Fold", "Bedding", "Towels", "Rush Laundry", "Subscription Laundry Plan"];
const PREFS = ["Cold wash only", "Hang dry items", "Separate whites/colors", "Extra fabric softener", "No detergent scent"];
const COLLEGES = ["MVCC", "Utica University"];
const BAG_SIZES = [
  { key: "small", label: "Small", price: 5 },
  { key: "medium", label: "Medium", price: 8 },
  { key: "large", label: "Large", price: 12 },
];
const TIMES = ["Morning (9am–12pm)", "Afternoon (12–3pm)", "Evening (3–6pm)"];

export default function Schedule() {
  const router = useRouter();
  const { user, isGuest } = useAuth();

  const [customerType, setCustomerType] = useState(user?.role === "NEIGHBOR" ? "Non College Student" : "College Student");
  const [college, setCollege] = useState("MVCC");
  const [dorm, setDorm] = useState("");
  const [directions, setDirections] = useState("");
  const [services, setServices] = useState<string[]>(["Wash & Fold"]);
  const [bags, setBags] = useState(1);
  const [rush, setRush] = useState(false);
  const [bedding, setBedding] = useState(false);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [stain, setStain] = useState("");
  const [prefDate, setPrefDate] = useState("06/25/2026");
  const [prefTime, setPrefTime] = useState(TIMES[0]);
  const [estimate, setEstimate] = useState(0);
  const [aiTips, setAiTips] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isCollege = customerType === "College Student";

  useEffect(() => {
    api("/orders/estimate", { method: "POST", auth: false, body: { services, bags, rush, bedding_addon: bedding } })
      .then((r: any) => setEstimate(r.estimate)).catch(() => {});
  }, [services, bags, rush, bedding]);

  const toggleService = (s: string) => setServices((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const togglePref = (p: string) => setPrefs((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);

  const getAiTips = async () => {
    if (!stain.trim()) return;
    setAiLoading(true);
    try { const r: any = await api("/ai/stain-tips", { method: "POST", body: { notes: stain, service_type: services.join(", ") } }); setAiTips(r.tips); }
    catch { setAiTips("Could not load tips right now."); } finally { setAiLoading(false); }
  };

  const submit = async () => {
    if (isGuest) { router.push("/register"); return; }
    if (services.length === 0) { alert("Select at least one service"); return; }
    if (isCollege && !dorm.trim()) { alert("Please enter your dorm/building"); return; }
    setSubmitting(true);
    try {
      const body: any = {
        services, customer_type: customerType,
        college: isCollege ? college : "", dorm: isCollege ? dorm : "",
        directions: isCollege ? directions : "",
        order_type: isCollege ? "College Pickup & Delivery" : "Drop-off & Pickup",
        bags, rush, bedding_addon: bedding, preferences: prefs, stain_notes: stain, photos: [],
        pickup_date: prefDate, pickup_window: prefTime,
        delivery_date: "", delivery_window: "",
      };
      const order: any = await api("/orders", { method: "POST", body });
      router.replace(`/order/${order.id}?new=1`);
    } catch (e: any) { alert(e.message); } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="schedule-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Schedule Laundry</Text>
          {isGuest && (
            <Card style={{ borderColor: colors.gold, backgroundColor: colors.gold + "18" }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>You're browsing as a guest.</Text>
              <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 13 }}>Explore & estimate freely — sign up when ready to submit.</Text>
            </Card>
          )}

          {/* Customer type */}
          <Text style={styles.label}>Who are you?</Text>
          <View style={styles.typeRow}>
            {["College Student", "Non College Student"].map((t) => (
              <Pressable key={t} testID={`ctype-${t}`} onPress={() => setCustomerType(t)} style={[styles.typeCard, customerType === t && styles.typeActive]}>
                <Ionicons name={t === "College Student" ? "school" : "home"} size={20} color={customerType === t ? colors.bg : colors.textDim} />
                <Text style={[styles.typeText, customerType === t && { color: colors.bg }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {isCollege ? (<>
            <Text style={styles.label}>Which college?</Text>
            <View style={styles.chipsWrap}>
              {COLLEGES.map((c) => (
                <Pressable key={c} testID={`college-${c}`} onPress={() => setCollege(c)} style={[styles.chip, college === c && styles.chipActive]}>
                  <Text style={[styles.chipText, college === c && { color: colors.bg }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Dorm / building" testID="dorm-input" value={dorm} onChangeText={setDorm} placeholder="e.g. North Hall" />
            <Field label="Directions to your dorm & parking lot" testID="directions-input" value={directions} onChangeText={setDirections} placeholder="Where should we meet you? (bring bags out to the car)" multiline />
            <Card style={{ borderColor: colors.info }}>
              <Text style={styles.infoText}>📍 Bring your laundry bags out to the car — we don't enter the building. You'll pick up your clean laundry from the car in the lot too.</Text>
            </Card>
          </>) : (
            <Card style={{ borderColor: colors.info }}>
              <Text style={styles.infoText}>🏠 Non-college: you drop your laundry to us. We'll message you in-app when it's ready and you'll confirm a pickup time.</Text>
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

          <View style={styles.bagsHeader}>
            <Text style={styles.label}>Buy branded reusable bags</Text>
            <View style={styles.comingSoonPill}><Text style={styles.comingSoonText}>COMING SOON</Text></View>
          </View>
          <Card style={{ opacity: 0.45 }}>
            {BAG_SIZES.map((b) => (
              <View key={b.key} style={styles.bagRow} pointerEvents="none">
                <View><Text style={styles.rowLabel}>{b.label} bag</Text><Text style={styles.bagPrice}>${b.price} each</Text></View>
                <View style={styles.stepper}>
                  <View style={styles.stepBtn}><Ionicons name="remove" size={18} color={colors.textDim} /></View>
                  <Text style={styles.stepVal}>0</Text>
                  <View style={styles.stepBtn}><Ionicons name="add" size={18} color={colors.textDim} /></View>
                </View>
              </View>
            ))}
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
            <Ionicons name="sparkles" size={16} color={colors.gold} /><Text style={styles.aiBtnText}>Get AI stain-care tips</Text>
          </Pressable>
          {aiLoading && <ActivityIndicator color={colors.gold} style={{ marginVertical: 8 }} />}
          {!!aiTips && <Card style={{ borderColor: colors.gold }}><Text style={styles.aiTips} testID="ai-tips-result">{aiTips}</Text></Card>}

          <Field label={isCollege ? "Preferred pickup date (mm/dd/yyyy)" : "Preferred drop-off date (mm/dd/yyyy)"} testID="pref-date-input" value={prefDate} onChangeText={setPrefDate} placeholder="06/25/2026" />
          <Text style={styles.label}>Preferred {isCollege ? "pickup" : "drop-off"} time</Text>
          <View style={styles.chipsWrap}>
            {TIMES.map((t) => (
              <Pressable key={t} testID={`time-${t}`} onPress={() => setPrefTime(t)} style={[styles.chip, prefTime === t && styles.chipActive]}>
                <Text style={[styles.chipText, prefTime === t && { color: colors.bg }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.smallNote}>⏱ Sour Apple VIP confirms the final {isCollege ? "pickup & sets your delivery time" : "times"} — you'll see them here and get a message.</Text>

          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <View style={styles.stepRow}>
              <Text style={styles.rowLabel}>Estimated total</Text>
              <Text style={styles.estimate} testID="price-estimate">${estimate.toFixed(2)}</Text>
            </View>
          </Card>

          <Btn title={isGuest ? "Sign up to submit" : "Submit Request"} onPress={submit} loading={submitting} testID="submit-order-button" />
          <Text style={styles.note}>Your request goes to Sour Apple VIP for approval first.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Toggle({ label, value, onToggle, testID }: { label: string; value: boolean; onToggle: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onToggle} style={styles.toggleRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.switch, value && { backgroundColor: colors.apple, alignItems: "flex-end" }]}><View style={styles.knob} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },
  label: { color: colors.textDim, fontSize: 13, marginBottom: 8, fontWeight: "600" },
  typeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  typeCard: { flex: 1, height: 68, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  typeActive: { backgroundColor: colors.apple, borderColor: colors.apple },
  typeText: { color: colors.textDim, fontWeight: "700", fontSize: 12, textAlign: "center" },
  infoText: { color: colors.text, fontSize: 13, lineHeight: 19 },
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
  bagsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  comingSoonPill: { backgroundColor: colors.pink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  comingSoonText: { color: "#0A0A0F", fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  bagRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  bagPrice: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  aiBtnText: { color: colors.gold, fontWeight: "700" },
  aiTips: { color: colors.text, lineHeight: 22 },
  smallNote: { color: colors.textDim, fontSize: 12, marginBottom: spacing.md, lineHeight: 17 },
  estimate: { color: colors.apple, fontSize: 24, fontWeight: "800" },
  note: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
});
