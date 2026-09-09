import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, ShieldCheck, MapPin, Check, AlertTriangle } from "lucide-react";
import { api } from "@/src/api/client";
import { colors } from "@/src/theme";
import { Card, Btn, Field } from "@/src/components/UI";

// Bag Sizes with student/public pricing
const BAG_SIZES = [
  {
    id: "small",
    name: "Small Bag (27 Inch)",
    studentPrice: 10,
    publicPrice: 20,
    visual: "27\" Closed bag (drawstring, Velcro, zipper, or snaps)",
    desc: "Up to 10 lbs · About 1-2 days of clothes",
  },
  {
    id: "medium",
    name: "Medium Bag (32 Inch — Most Popular)",
    studentPrice: 20,
    publicPrice: 30,
    visual: "32\" Closed bag (drawstring, Velcro, zipper, or snaps)",
    desc: "15-20 lbs · A full week of clothes for 1 person",
  },
  {
    id: "large",
    name: "Large Bag (40 Inch)",
    studentPrice: 30,
    publicPrice: 40,
    visual: "40\" Heavy-duty closed bag (drawstring, Velcro, zipper, or snaps)",
    desc: "25-30+ lbs · 2 weeks of laundry or family load",
  },
];

const ADDON_SERVICES = [
  { id: "Bedding", name: "Bedding / Comforter", price: 25, desc: "Comforters, blankets & heavy sheets" },
  { id: "Towels", name: "Extra Towel Bundle", price: 15, desc: "Bundle of bath towels, mats & washcloths" },
  { id: "Rush Laundry", name: "Rush Same-Day Turnaround", price: 20, desc: "Guaranteed priority turnaround" },
];

const PREFERENCES = [
  "Standard Sour Apple Fresh (Scented detergent, OxiClean, Scent booster & Softener)",
  "I will provide my own detergent (Fragrance-free / Hypoallergenic)",
  "Cold wash only",
  "Separate whites and colors",
  "Low heat dry",
  "Hang dry delicate items",
];

export default function Schedule() {
  const navigate = useNavigate();

  // Booking Type & Size
  const [customerType, setCustomerType] = useState("Local Drop-Off & Pick-Up");
  const [selectedSize, setSelectedSize] = useState("medium");
  const [bagQty, setBagQty] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Preferences & Notes
  const [preferences, setPreferences] = useState<string[]>([
    "Standard Sour Apple Fresh (Scented detergent, OxiClean, Scent booster & Softener)",
  ]);
  const [stainNotes, setStainNotes] = useState("");

  // Customer Details & Schedule
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dormOrAddress, setDormOrAddress] = useState("");
  const [campusName, setCampusName] = useState("MVCC");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffWindow, setDropoffWindow] = useState("Morning (9am - 12pm)");

  // Digital Contract State
  const [contractAgreed, setContractAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  // Image upload for bag verification
  const [bagImage, setBagImage] = useState<File | null>(null);
  const [bagImagePreview, setBagImagePreview] = useState<string | null>(null);

  const [estimate, setEstimate] = useState(20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Determine whether current booking is a student price
  const isStudentBooking = customerType === "MVCC Student Curbside";

  // Helper: get price for a bag size depending on customer type
  const priceForSize = (sizeId: string) => {
    const s = BAG_SIZES.find((x) => x.id === sizeId);
    if (!s) return 0;
    return isStudentBooking ? s.studentPrice : s.publicPrice;
  };

  // Calculate live estimate
  useEffect(() => {
    let total = 0;
    const unitPrice = priceForSize(selectedSize);
    total += unitPrice * bagQty;

    selectedAddons.forEach((addonId) => {
      const addon = ADDON_SERVICES.find((a) => a.id === addonId);
      if (addon) total += addon.price;
    });

    setEstimate(total);
  }, [selectedSize, bagQty, selectedAddons, customerType]);

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const togglePref = (p: string) => {
    setPreferences((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setBagImage(file);
      setBagImagePreview(URL.createObjectURL(file));
    } else {
      setBagImage(null);
      setBagImagePreview(null);
    }
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const submitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");

    if (!contractAgreed) {
      setErr("Please check the box to agree to the Service Agreement and closure requirements before booking.");
      return;
    }
    if (!signatureName.trim()) {
      setErr("Please type your full legal name as your electronic signature.");
      return;
    }

    setLoading(true);
    try {
      const sizeObj = BAG_SIZES.find((s) => s.id === selectedSize);
      const sizeLabel = sizeObj?.name;
      const bagPrice = priceForSize(selectedSize);
      const allServices = [`${sizeLabel} (${sizeObj?.visual})`, ...selectedAddons];

      let bagImageBase64: string | null = null;
      if (bagImage) {
        const dataUrl = await fileToBase64(bagImage);
        // include full data URL; backend can parse or strip header as needed
        bagImageBase64 = dataUrl;
      }

      const order = await api("/orders", {
        method: "POST",
        body: {
          services: allServices,
          service_type: sizeLabel,
          customer_type: customerType === "MVCC Student Curbside" ? "College Student" : "Neighborhood Resident",
          college: customerType === "MVCC Student Curbside" ? campusName : "",
          dorm: dormOrAddress,
          directions: customerType === "Local Drop-Off & Pick-Up" ? "South Utica Drop-off" : "MVCC Campus Curbside",
          pickup_date: dropoffDate || new Date().toISOString().split("T")[0],
          pickup_window: dropoffWindow,
          bags: bagQty,
          bag_price_each: bagPrice,
          rush: selectedAddons.includes("Rush Laundry"),
          bedding_addon: selectedAddons.includes("Bedding"),
          preferences,
          stain_notes: stainNotes,
          branded_bags: {},
          contract_agreed: true,
          signature_name: signatureName.trim(),
          signed_at: new Date().toISOString(),

          // Image review & admin fallback
          bag_image_base64: bagImageBase64,
          image_review_requested: !!bagImageBase64,
          image_review_email: "natture1st@gmail.com",
        },
      });

      // Navigate to order screen; admin will review image and confirm
      navigate(`/order/${order.id}?new=1`);
    } catch (e: any) {
      setErr(e.message || "Failed to schedule service");
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
      <div className="flex items-center gap-2 mb-4 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full active:scale-90 transition-transform"
        >
          <ChevronLeft size={28} style={{ color: colors.text || "#fff" }} />
        </button>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: colors.text || "#fff" }}>
          Schedule Service
        </h1>
      </div>

      {/* Location Banner */}
      <div
        className="p-3.5 rounded-2xl mb-5 border text-xs leading-relaxed flex items-start gap-3 shadow-md"
        style={{
          backgroundColor: "rgba(176, 255, 0, 0.06)",
          borderColor: "rgba(176, 255, 0, 0.25)",
        }}
      >
        <MapPin size={22} className="shrink-0 mt-0.5" style={{ color: colors.apple || "#B0FF00" }} />
        <div>
          <p className="font-extrabold text-sm" style={{ color: colors.apple || "#B0FF00" }}>
            South Utica Drop-Off & Pick-Up
          </p>
          <p className="text-zinc-300 mt-0.5">
            Anyone is welcome! Drop off dirty in South Utica, and we notify you as soon as your fresh, folded clothes are ready for pickup.
          </p>
        </div>
      </div>

      <form onSubmit={submitOrder} className="space-y-5">
        {/* Customer Type Selector */}
        <div className="grid grid-cols-2 gap-2">
          {["Local Drop-Off & Pick-Up", "MVCC Student Curbside"].map((type) => (
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

        {/* 1. Bag Size Selector with Official Size Chart */}
        <Card>
          <h2 className="text-sm font-black mb-1 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            1. Select Your Bag Size
          </h2>
          <p className="text-xs mb-3 text-zinc-400">
            No scale needed! Refer to our visual size chart below:
          </p>

          {/* Size Chart Image Banner */}
          <div className="mb-3 rounded-xl overflow-hidden border border-zinc-800 shadow-md">
            <img
              src="/assets/images/bag-sizes.jpg"
              alt="Sour Apple Bag Size Chart — Small 27in, Medium 32in, Large 40in"
              className="w-full h-auto object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/LOGO.png";
              }}
            />
          </div>

          {/* 🚫 STRICT CLOSURE POLICY BOX */}
          <div
            className="p-3.5 rounded-xl mb-3 border text-xs leading-relaxed flex items-start gap-2.5 shadow-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              borderColor: "rgba(239, 68, 68, 0.45)",
              color: "#fca5a5",
            }}
          >
            <AlertTriangle size={22} className="shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-extrabold text-xs text-red-300 uppercase tracking-wide">
                Strict Closure Policy — NO OPEN / NO LID BASKETS
              </p>
              <p className="mt-0.5 text-zinc-200">
                All laundry <strong>MUST</strong> be dropped off in a bag with a secure closure via a <strong>drawstring, Velcro, zipper, or snap buttons</strong>.
                <br />
                <span className="text-red-300 font-semibold">
                  Open laundry baskets with no lids are NOT accepted
                </span> (items fall out and get misplaced during transport).
              </p>
            </div>
          </div>

          {/* Size Options */}
          <div className="space-y-2.5">
            {BAG_SIZES.map((s) => {
              const active = selectedSize === s.id;
              const displayPrice = isStudentBooking ? s.studentPrice : s.publicPrice;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSize(s.id)}
                  className="p-3.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all select-none"
                  style={{
                    backgroundColor: active ? "rgba(176, 255, 0, 0.08)" : colors.surfaceAlt || "#1a1a1a",
                    borderColor: active ? colors.apple || "#B0FF00" : colors.border || "#222",
                  }}
                >
                  <div className="pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white">{s.name}</p>
                      {active && <Check size={14} style={{ color: colors.apple || "#B0FF00" }} />}
                    </div>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: colors.apple || "#B0FF00" }}>
                      📏 {s.visual}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{s.desc}</p>
                  </div>
                  <span className="text-base font-black shrink-0" style={{ color: colors.apple || "#B0FF00" }}>
                    ${displayPrice}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bag Quantity Counter */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
            <span className="text-xs font-bold text-white">Quantity of bags this size:</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBagQty(Math.max(1, bagQty - 1))}
                className="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                style={{ borderColor: colors.border || "#333", backgroundColor: colors.surface || "#111" }}
              >
                -
              </button>
              <span className="font-black text-lg" style={{ color: colors.apple || "#B0FF00" }}>
                {bagQty}
              </span>
              <button
                type="button"
                onClick={() => setBagQty(bagQty + 1)}
                className="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                style={{ borderColor: colors.border || "#333", backgroundColor: colors.surface || "#111" }}
              >
                +
              </button>
            </div>
          </div>
        </Card>

        {/* Optional Add-ons */}
        <Card>
          <h2 className="text-sm font-black mb-2 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            Optional Add-ons
          </h2>
          <div className="space-y-2">
            {ADDON_SERVICES.map((a) => {
              const checked = selectedAddons.includes(a.id);
              return (
                <div
                  key={a.id}
                  onClick={() => toggleAddon(a.id)}
                  className="p-3 rounded-xl border cursor-pointer flex justify-between items-center select-none"
                  style={{
                    backgroundColor: checked ? "rgba(176, 255, 0, 0.08)" : colors.surfaceAlt || "#1a1a1a",
                    borderColor: checked ? colors.apple || "#B0FF00" : colors.border || "#222",
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{a.name}</p>
                    <p className="text-xs text-zinc-400">{a.desc}</p>
                  </div>
                  <span className="text-sm font-black" style={{ color: colors.apple || "#B0FF00" }}>
                    +${a.price}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Reusable Branded Bags (Coming Soon Section) */}
        <Card className="border relative overflow-hidden" style={{ borderColor: "rgba(255, 42, 133, 0.3)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} style={{ color: colors.pink || "#ff2a85" }} />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Sour Apple Reusable Bags
              </h2>
            </div>
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: colors.pink || "#ff2a85", color: "#fff" }}
            >
              Coming Soon!
            </span>
          </div>

          <p className="text-xs text-zinc-400 mb-2">
            Heavy-duty, water-resistant drawstring closure bags in <strong>Girl Apple</strong> and <strong>Boy Apple</strong> styles. Small 27" (${BAG_SIZES[0].publicPrice}) , Medium 32" (${BAG_SIZES[1].publicPrice}), Large 40" (${BAG_SIZES[2].publicPrice}).
          </p>

          <div
            className="p-2.5 rounded-xl border text-center text-xs text-zinc-300"
            style={{ backgroundColor: colors.surfaceAlt || "#111", borderColor: colors.border || "#222" }}
          >
            🌟 Custom branded bags with drawstring closures are in production! In the meantime, please use any standard bag with a drawstring, zipper, Velcro, or snap buttons.
          </div>
        </Card>

        {/* 2. Wash Preferences & Scent Notice */}
        <Card>
          <h2 className="text-sm font-black mb-2 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            2. Wash Preferences
          </h2>

          <div
            className="p-3 rounded-xl mb-3 border text-xs leading-relaxed"
            style={{
              backgroundColor: "rgba(176, 255, 0, 0.06)",
              borderColor: "rgba(176, 255, 0, 0.25)",
              color: colors.text || "#fff",
            }}
          >
            <p className="font-bold mb-1" style={{ color: colors.apple || "#B0FF00" }}>
              🧺 Our Standard Wash Formula:
            </p>
            We wash all standard loads with fresh scented detergent, OxiClean, scent boosters, and scented fabric softener.
            <br />
            <span className="text-zinc-300 mt-1 block">
              <strong>Prefer unscented or hypoallergenic?</strong> Check the box below and include your own detergent bottle with your bag at drop-off!
            </span>
          </div>

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
            label="Stain Notes or Fragile Instructions"
            value={stainNotes}
            onChangeText={setStainNotes}
            placeholder="e.g. coffee stain on collar, using my own hypoallergenic detergent"
          />
        </Card>

        {/* 3. Schedule & Contact */}
        <Card>
          <h2 className="text-sm font-black mb-3 uppercase tracking-wider" style={{ color: colors.gold || "#FFD700" }}>
            3. Schedule & Contact
          </h2>

          <Field
            label="Full Name"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Jamie Doe"
            required
          />

          <Field
            label="Phone Number"
            type="tel"
            value={phone}
            onChangeText={setPhone}
            placeholder="(315) 555-0199"
            required
          />

          {customerType === "Local Drop-Off & Pick-Up" ? (
            <Field
              label="Your Street Address / Area"
              value={dormOrAddress}
              onChangeText={setDormOrAddress}
              placeholder="e.g. 123 Elm St, South Utica (or New Hartford, Whitesboro, etc.)"
              required
            />
          ) : (
            <>
              <Field
                label="College / Campus"
                value={campusName}
                onChangeText={setCampusName}
                placeholder="MVCC"
              />
              <Field
                label="Residence Hall & Room #"
                value={dormOrAddress}
                onChangeText={setDormOrAddress}
                placeholder="e.g. West Hall Rm 204"
                required
              />
            </>
          )}

          <Field
            label="Preferred Date"
            type="date"
            value={dropoffDate}
            onChangeText={setDropoffDate}
            required
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
            Preferred Drop-off / Pickup Window
          </label>
          <select
            value={dropoffWindow}
            onChange={(e) => setDropoffWindow(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border text-sm mb-2"
            style={{
              backgroundColor: colors.surfaceAlt || "#1a1a1a",
              borderColor: colors.border || "#333",
              color: colors.text || "#fff",
            }}
          >
            <option value="Morning (9am - 12pm)">Morning (9am - 12pm)</option>
            <option value="Afternoon (12pm - 3pm)">Afternoon (12pm - 3pm)</option>
            <option value="Evening (3pm - 6pm)">Evening (3pm - 6pm)</option>
          </select>

          {/* Bag photo upload for size verification */}
          <div className="mt-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
              Optional: Take or upload a photo of your closed bag (helps us verify size)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="w-full mb-2"
            />
            {bagImagePreview && (
              <img src={bagImagePreview} alt="Bag preview" className="w-36 h-auto rounded-md border" />
            )}
          </div>
        </Card>

        {/* 4. Service Agreement & Electronic Signature */}
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
            By booking with Sour Apple VIP, you agree: All laundry is handled with professional care. <strong>All laundry must be delivered in bags with a secure closure via drawstring, Velcro, zipper[...]"
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
              I have read, understood, and legally agree to the Sour Apple VIP Laundry Service Agreement (including closed-bag requirements via drawstring, Velcro, zipper, or snap buttons).
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

        {/* Price & Submit */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm font-bold text-zinc-400">Estimated Total:</span>
            <span className="text-2xl font-black" style={{ color: colors.apple || "#B0FF00" }}>
              ${estimate.toFixed(2)}
            </span>
          </div>

          <Btn
            title={`Book Service — $${estimate.toFixed(2)}`}
            type="submit"
            loading={loading}
            data-testid="submit-order-button"
          />
        </div>
      </form>
    </div>
  );
}
