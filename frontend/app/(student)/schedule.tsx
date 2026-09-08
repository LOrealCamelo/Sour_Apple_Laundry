import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, ShieldCheck } from "lucide-react";
import { api } from "@/src/api/client";
import { colors } from "@/src/theme";
import { Card, Btn, Field } from "@/src/components/UI";

const SERVICES = [
  { id: "Wash & Fold", name: "Wash & Fold", price: 20, desc: "Everyday clothes washed, dried & folded" },
  { id: "Bedding", name: "Bedding / Comforter", price: 25, desc: "Sheets, blankets & comforters" },
  { id: "Towels", name: "Towels Only", price: 15, desc: "Bath towels, washcloths & mats" },
  { id: "Rush Laundry", name: "Rush Laundry (Same-Day)", price: 40, desc: "Guaranteed fast turnaround" },
];

const PREFERENCES = [
  "Cold wash only",
  "Separate whites and colors",
  "Hypoallergenic / Fragrance-free",
  "Low heat dry",
  "Hang dry delicate items",
];

export default function Schedule() {
  const navigate = useNavigate();

  // Booking Form State
  const [selectedServices, setSelectedServices] = useState<string[]>(["Wash & Fold"]);
  const [bags, setBags] = useState(1);
  const [rush, setRush] = useState(false);
  const [beddingAddon, setBeddingAddon] = useState(false);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [stainNotes, setStainNotes] = useState("");

  // Customer & Location
  const [customerType, setCustomerType] = useState("College Student");
  const [college, setCollege] = useState("MVCC");
  const [dorm, setDorm] = useState("");
  const [directions, setDirections] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupWindow, setPickupWindow] = useState("9am - 12pm");

  // Branded Reusable Bags Add-on
  const [bagStyle, setBagStyle] = useState<"GIRL" | "BOY">("GIRL");
  const [brandedBags, setBrandedBags] = useState<{ [key: string]: number }>({
    small: 0,
    medium: 0,
    large: 0,
  });

  // Digital Contract & Signature State
  const [contractAgreed, setContractAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  const [estimate, setEstimate] = useState(20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Calculate live estimate whenever selections change
  useEffect(() => {
    (async () => {
      try {
        const res = await api("/orders/estimate", {
          method: "POST",
          body: {
            services: selectedServices,
            bags,
            rush,
            bedding_addon: beddingAddon,
            branded_bags: brandedBags,
          },
        });
        setEstimate(res.estimate || 20);
      } catch {}
    })();
  }, [selectedServices, bags, rush, beddingAddon, brandedBags]);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]
    );
  };

  const togglePref = (p: string) => {
    setPreferences((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const updateBagQty = (size: string, delta: number) => {
    setBrandedBags((prev) => ({
      ...prev,
      [size]: Math.max(0, (prev[size] || 0) + delta),
    }));
  };

  const submitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");

    if (!contractAgreed) {
      setErr("Please review and agree to the Service Agreement before booking.");
      return;
    }
    if (!signatureName.trim()) {
      setErr("Please type your full legal name as your digital signature.");
      return;
    }

    setLoading(true);
    try {
      const order = await api("/orders", {
        method: "POST",
        body: {
          services: selectedServices,
          customer_type: customerType,
          college: customerType === "College Student" ? college : "",
          dorm,
          directions,
          pickup_date: pickupDate || new Date().toISOString().split("T")[0],
          pickup_window: pickupWindow,
          bags,
          rush,
          bedding_addon: beddingAddon,
          preferences,
          stain_notes: stainNotes,
          branded_bags: brandedBags,
          contract_agreed: true,
          signature_name: signatureName.trim(),
          signed_at: new Date().toISOString(),
        },
      });
      navigate(`/order/${order.id}?new=1`);
    } catch (e: any) {
      setErr(e.message || "Failed to schedule pickup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen p-4 pb-28 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#0A0A0F" }}
      data-testid="schedule-screen"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full active:scale-90 transition-transform"
        >
          <ChevronLeft size={28} style={{ color: colors.text || "#fff" }} />
        </button>
        <h1 className="text-2xl font-black" style={{ color: colors.text || "#fff" }}>
          Schedule Pickup
        </h1>
      </div>

      <form onSubmit={submitOrder} className="space-y-5">
        {/* Customer Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          {["College Student", "Neighborhood Resident"].map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setCustomerType(type)}
              className="py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95"
              style={{
                backgroundColor: customerType === type ? colors.apple || "#B0FF00" : colors.surfaceAlt || "#1a1a1a",
                borderColor: customerType === type ? colors.apple || "#B0FF00" : colors.border || "#333",
                color: customerType === type ? colors.bg || "#000" : colors.text || "#fff",
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* 1. Services Selection */}
        <Card>
          <h2 className="text-sm font-black mb-3 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            1. Select Services
          </h2>
          <div className="space-y-2">
            {SERVICES.map((s) => {
              const active = selectedServices.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleService(s.id)}
                  className="p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all select-none"
                  style={{
                    backgroundColor: active ? "rgba(176, 255, 0, 0.08)" : colors.surfaceAlt || "#1a1a1a",
                    borderColor: active ? colors.apple || "#B0FF00" : colors.border || "#222",
                  }}
                >
                  <div>
                    <p className="text-sm font-bold" style={{ color: colors.text || "#fff" }}>
                      {s.name}
                    </p>
                    <p className="text-xs" style={{ color: colors.textDim || "#888" }}>
                      {s.desc}
                    </p>
                  </div>
                  <span className="text-sm font-black" style={{ color: colors.apple || "#B0FF00" }}>
                    ${s.price}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 2. Laundry Bags Count */}
        <Card>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-black" style={{ color: colors.text || "#fff" }}>
                Number of Bags
              </h2>
              <p className="text-xs" style={{ color: colors.textDim || "#888" }}>
                $5 per additional bag after the first
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBags(Math.max(1, bags - 1))}
                className="w-8 h-8 rounded-full border flex items-center justify-center font-bold"
                style={{ borderColor: colors.border || "#333", color: colors.text || "#fff" }}
              >
                -
              </button>
              <span className="font-black text-lg" style={{ color: colors.apple || "#B0FF00" }}>
                {bags}
              </span>
              <button
                type="button"
                onClick={() => setBags(bags + 1)}
                className="w-8 h-8 rounded-full border flex items-center justify-center font-bold"
                style={{ borderColor: colors.border || "#333", color: colors.text || "#fff" }}
              >
                +
              </button>
            </div>
          </div>
        </Card>

        {/* 3. Reusable Branded Bags Add-On */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={18} style={{ color: colors.apple || "#B0FF00" }} />
            <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
              Reusable Laundry Bags (Optional)
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: colors.textDim || "#888" }}>
            Heavy-duty, water-resistant drawstring bags. One-time purchase!
          </p>

          {/* Style Selector */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setBagStyle("GIRL")}
              className="py-1.5 rounded-lg border text-xs font-bold"
              style={{
                borderColor: bagStyle === "GIRL" ? colors.pink || "#ff2a85" : colors.border || "#333",
                color: bagStyle === "GIRL" ? colors.pink || "#ff2a85" : colors.textDim || "#888",
              }}
            >
              Girl Apple (Pink/Gray)
            </button>
            <button
              type="button"
              onClick={() => setBagStyle("BOY")}
              className="py-1.5 rounded-lg border text-xs font-bold"
              style={{
                borderColor: bagStyle === "BOY" ? colors.info || "#00b4d8" : colors.border || "#333",
                color: bagStyle === "BOY" ? colors.info || "#00b4d8" : colors.textDim || "#888",
              }}
            >
              Boy Apple (Navy/Blue)
            </button>
          </div>

          {/* Sizes */}
          {[
            { size: "small", label: "Small Bag (Up to 10 lbs)", price: 8 },
            { size: "medium", label: "Medium Bag (15-20 lbs)", price: 10 },
            { size: "large", label: "Large Bag (Dorm Heavy)", price: 12 },
          ].map((item) => (
            <div key={item.size} className="flex justify-between items-center py-2 border-b last:border-0 border-zinc-800">
              <div>
                <span className="text-xs font-bold" style={{ color: colors.text || "#fff" }}>
                  {item.label}
                </span>
                <span className="text-xs ml-2 font-semibold" style={{ color: colors.apple || "#B0FF00" }}>
                  +${item.price}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateBagQty(item.size, -1)}
                  className="w-7 h-7 rounded border flex items-center justify-center text-xs"
                  style={{ borderColor: colors.border || "#333", color: colors.text || "#fff" }}
                >
                  -
                </button>
                <span className="w-5 text-center text-xs font-bold" style={{ color: colors.text || "#fff" }}>
                  {brandedBags[item.size] || 0}
                </span>
                <button
                  type="button"
                  onClick={() => updateBagQty(item.size, 1)}
                  className="w-7 h-7 rounded border flex items-center justify-center text-xs"
                  style={{ borderColor: colors.border || "#333", color: colors.text || "#fff" }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </Card>

        {/* 4. Preferences & Stains */}
        <Card>
          <h2 className="text-sm font-black mb-3 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            2. Wash Preferences
          </h2>
          <div className="space-y-2 mb-4">
            {PREFERENCES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preferences.includes(p)}
                  onChange={() => togglePref(p)}
                  className="w-4 h-4 accent-lime-400"
                />
                <span style={{ color: colors.text || "#fff" }}>{p}</span>
              </label>
            ))}
          </div>

          <Field
            label="Specific Stain Notes or Fragile Items"
            value={stainNotes}
            onChangeText={setStainNotes}
            placeholder="e.g. coffee stain on collar, don't machine dry the red hoodie"
          />
        </Card>

        {/* 5. Pickup Timing & Address */}
        <Card>
          <h2 className="text-sm font-black mb-3 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            3. Pickup Details
          </h2>
          {customerType === "College Student" ? (
            <>
              <Field label="College / Campus" value={college} onChangeText={setCollege} placeholder="MVCC" />
              <Field label="Dorm / Building & Room #" value={dorm} onChangeText={setDorm} placeholder="e.g. West Hall Rm 204" required />
            </>
          ) : (
            <Field label="Street Address / Neighborhood" value={dorm} onChangeText={setDorm} placeholder="e.g. 123 Elm St, South Utica" required />
          )}

          <Field label="Preferred Date" type="date" value={pickupDate} onChangeText={setPickupDate} />
          
          <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
            Preferred Pickup Window
          </label>
          <select
            value={pickupWindow}
            onChange={(e) => setPickupWindow(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border text-sm mb-2"
            style={{
              backgroundColor: colors.surfaceAlt || "#1a1a1a",
              borderColor: colors.border || "#333",
              color: colors.text || "#fff",
            }}
          >
            <option value="9am - 12pm">Morning (9am - 12pm)</option>
            <option value="12pm - 3pm">Afternoon (12pm - 3pm)</option>
            <option value="3pm - 6pm">Evening (3pm - 6pm)</option>
          </select>
        </Card>

        {/* 6. Digital Contract & Electronic Signature */}
        <Card className="border-2" style={{ borderColor: colors.apple || "#B0FF00" }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={20} style={{ color: colors.apple || "#B0FF00" }} />
            <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: colors.apple || "#B0FF00" }}>
              Service Agreement & Signature
            </h2>
          </div>

          <div
            className="p-3 rounded-lg text-[11px] leading-relaxed max-h-28 overflow-y-auto mb-3 border text-zinc-300"
            style={{ backgroundColor: colors.surfaceAlt || "#111", borderColor: colors.border || "#222" }}
          >
            By booking with Sour Apple VIP, you agree: All laundry is handled with professional care. Sour Apple VIP is not liable for normal wear/tear, color bleeding from non-separated clothes, or items left in pockets. Liability for lost items is limited up to $100 per bag. Payment is due upon delivery/pickup confirmation.
          </div>

          <label className="flex items-start gap-2 text-xs cursor-pointer select-none mb-3">
            <input
              type="checkbox"
              checked={contractAgreed}
              onChange={(e) => setContractAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-lime-400"
              required
            />
            <span className="font-semibold" style={{ color: colors.text || "#fff" }}>
              I have read, understood, and legally agree to the Sour Apple VIP Laundry Service Agreement.
            </span>
          </label>

          <Field
            label="Type Full Legal Name (Digital Signature)"
            value={signatureName}
            onChangeText={setSignatureName}
            placeholder="e.g. Jamie M. Doe"
            required
          />
        </Card>

        {/* Error Alert */}
        {Boolean(err) && (
          <div className="p-3 rounded-xl bg-red-900/30 border border-red-500 text-red-400 text-xs font-bold text-center">
            {err}
          </div>
        )}

        {/* Sticky Price & Submit Button */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm font-bold" style={{ color: colors.textDim || "#888" }}>
              Estimated Total:
            </span>
            <span className="text-2xl font-black" style={{ color: colors.apple || "#B0FF00" }}>
              ${estimate.toFixed(2)}
            </span>
          </div>

          <Btn
            title={`Book Pickup — $${estimate.toFixed(2)}`}
            type="submit"
            loading={loading}
            data-testid="submit-order-button"
          />
        </div>
      </form>
    </div>
  );
}
