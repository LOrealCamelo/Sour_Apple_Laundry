import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Home, GraduationCap, ChevronLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "@/src/api/client";
import { colors } from "@/src/theme";
import { Card, Btn, Field } from "@/src/components/UI";

const SERVICES = [
  "Wash & Fold",
  "Bedding",
  "Towels",
  "Rush Laundry",
  "Subscription Laundry Plan",
];

const SERVICE_PRICES: Record<string, number> = {
  "Wash & Fold": 20,
  "Bedding": 25,
  "Towels": 15,
  "Rush Laundry": 40,
  "Subscription Laundry Plan": 60,
};

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

  // "Who are you?" State
  const [whoAreYou, setWhoAreYou] = useState<"NON_STUDENT" | "MVCC">("NON_STUDENT");
  const [mvccRole, setMvccRole] = useState<"Student" | "Faculty">("Student");

  // Location / Dorm Fields
  const [dormOrAddress, setDormOrAddress] = useState("");
  const [directions, setDirections] = useState("");

  // Services & Bags
  const [selectedServices, setSelectedServices] = useState<string[]>(["Wash & Fold"]);
  const [bags, setBags] = useState(1);

  // Preferences & Stains
  const [preferences, setPreferences] = useState<string[]>([
    "Standard Sour Apple Fresh (Scented detergent, OxiClean, Scent booster & Softener)",
  ]);
  const [stainNotes, setStainNotes] = useState("");

  // Contact & Timing
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffWindow, setDropoffWindow] = useState("9am - 12pm");

  // Digital Contract State
  const [contractAgreed, setContractAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  const [estimate, setEstimate] = useState(20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Calculate live estimate
  useEffect(() => {
    let base = 0;
    selectedServices.forEach((s) => {
      base += SERVICE_PRICES[s] || 20;
    });
    // Extra bag fee: $5 each after the 1st
    base += Math.max(0, bags - 1) * 5;
    setEstimate(base);
  }, [selectedServices, bags]);

  const toggleService = (s: string) => {
    setSelectedServices((prev) =>
      prev.includes(s)
        ? prev.length > 1
          ? prev.filter((item) => item !== s)
          : prev
        : [...prev, s]
    );
  };

  const togglePref = (p: string) => {
    setPreferences((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const submitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");

    if (!contractAgreed) {
      setErr("Please review and agree to the Service Agreement before booking.");
      return;
    }
    if (!signatureName.trim()) {
      setErr("Please type your full legal name as your electronic signature.");
      return;
    }

    setLoading(true);
    try {
      const order = await api("/orders", {
        method: "POST",
        body: {
          services: selectedServices,
          service_type: selectedServices.join(", "),
          customer_type: whoAreYou === "MVCC" ? "College Student" : "Neighborhood Resident",
          college: whoAreYou === "MVCC" ? "MVCC" : "",
          dorm: dormOrAddress,
          directions: whoAreYou === "MVCC" ? directions : "South Utica Drop-off",
          pickup_date: dropoffDate || new Date().toISOString().split("T")[0],
          pickup_window: dropoffWindow,
          bags,
          rush: selectedServices.includes("Rush Laundry"),
          bedding_addon: selectedServices.includes("Bedding"),
          preferences,
          stain_notes: stainNotes,
          branded_bags: {},
          contract_agreed: true,
          signature_name: signatureName.trim(),
          signed_at: new Date().toISOString(),
        },
      });

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
      style={{ backgroundColor: "#0A0A0F" }}
      data-testid="schedule-screen"
    >
      {/* Top Header */}
      <div className="flex items-center gap-2 mb-6 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full active:scale-90 transition-transform"
        >
          <ChevronLeft size={28} className="text-white" />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Schedule Laundry
        </h1>
      </div>

      <form onSubmit={submitOrder} className="space-y-6">
        {/* WHO ARE YOU? SECTION */}
        <div>
          <h2 className="text-sm font-bold text-zinc-300 mb-2">Who are you?</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Non Student Card */}
            <button
              type="button"
              onClick={() => setWhoAreYou("NON_STUDENT")}
              className="flex flex-col items-center justify-center h-20 rounded-2xl border transition-all active:scale-95"
              style={{
                backgroundColor: whoAreYou === "NON_STUDENT" ? "#B0FF00" : "#1D1627",
                borderColor: whoAreYou === "NON_STUDENT" ? "#B0FF00" : "#2E243D",
                color: whoAreYou === "NON_STUDENT" ? "#0A0A0F" : "#A098B2",
              }}
            >
              <Home size={22} className="mb-1" />
              <span className="text-xs font-black">Non Student</span>
            </button>

            {/* MVCC Card */}
            <button
              type="button"
              onClick={() => setWhoAreYou("MVCC")}
              className="flex flex-col items-center justify-center h-20 rounded-2xl border transition-all active:scale-95"
              style={{
                backgroundColor: whoAreYou === "MVCC" ? "#B0FF00" : "#1D1627",
                borderColor: whoAreYou === "MVCC" ? "#B0FF00" : "#2E243D",
                color: whoAreYou === "MVCC" ? "#0A0A0F" : "#A098B2",
              }}
            >
              <GraduationCap size={24} className="mb-1" />
              <span className="text-xs font-black">MVCC</span>
            </button>
          </div>
        </div>

        {/* IF MVCC: ROLE SELECTOR */}
        {whoAreYou === "MVCC" && (
          <div>
            <h2 className="text-sm font-bold text-zinc-300 mb-2">Campus Role</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMvccRole("Student")}
                className="px-5 py-2.5 rounded-full text-xs font-bold transition-all border"
                style={{
                  backgroundColor: mvccRole === "Student" ? "#B0FF00" : "#1D1627",
                  borderColor: mvccRole === "Student" ? "#B0FF00" : "#2E243D",
                  color: mvccRole === "Student" ? "#0A0A0F" : "#FFFFFF",
                }}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setMvccRole("Faculty")}
                className="px-5 py-2.5 rounded-full text-xs font-bold transition-all border"
                style={{
                  backgroundColor: mvccRole === "Faculty" ? "#B0FF00" : "#1D1627",
                  borderColor: mvccRole === "Faculty" ? "#B0FF00" : "#2E243D",
                  color: mvccRole === "Faculty" ? "#0A0A0F" : "#FFFFFF",
                }}
              >
                Faculty / Staff
              </button>
            </div>
          </div>
        )}

      {/* LOCATION / DORM INPUTS */}
        <div>
          <h2 className="text-sm font-bold text-zinc-300 mb-2">
            {whoAreYou === "NON_STUDENT"
              ? "Your Address / Area (Where you live or work)"
              : mvccRole === "Student"
              ? "Dorm / Residence Hall"
              : "Campus Building & Office"}
          </h2>
          <input
            type="text"
            value={dormOrAddress}
            onChange={(e) => setDormOrAddress(e.target.value)}
            placeholder={
              whoAreYou === "NON_STUDENT"
                ? "e.g. 123 Elm St, Utica (or New Hartford, Whitesboro, etc.)"
                : mvccRole === "Student"
                ? "e.g. North Hall Rm 204"
                : "e.g. Payne Hall, Office 102"
            }
            className="w-full h-12 px-4 rounded-xl text-sm border text-white"
            style={{ backgroundColor: "#1D1627", borderColor: "#2E243D" }}
            required
          />
        </div>

        {/* DIRECTIONS / PARKING NOTICE FOR MVCC */}
        {whoAreYou === "MVCC" && (
          <div>
            <h2 className="text-sm font-bold text-zinc-300 mb-2">
              Directions to your dorm & parking lot
            </h2>
            <input
              type="text"
              value={directions}
              onChange={(e) => setDirections(e.target.value)}
              placeholder="Where should we meet you? (parking lot, entrance...)"
              className="w-full h-12 px-4 rounded-xl text-sm border text-white"
              style={{ backgroundColor: "#1D1627", borderColor: "#2E243D" }}
            />
          </div>
        )}

        {/* BLUE PIN NOTICE BOX - UNIVERSAL LOCATION & TURNAROUND */}
        <div
          className="p-4 rounded-2xl border text-xs leading-relaxed"
          style={{
            backgroundColor: "rgba(14, 30, 48, 0.7)",
            borderColor: "rgba(56, 139, 253, 0.4)",
            color: "#E6EDF3",
          }}
        >
          {whoAreYou === "NON_STUDENT" ? (
            <div>
              <p className="font-extrabold text-sm text-sky-400 mb-1">
                📍 Drop-Off & Pick-Up Destination: South Utica, NY
              </p>
              <p className="text-zinc-300">
                Open to everyone! Whether you live in the area, work in Utica, or are visiting on a business trip, drop off your laundry bags with us in South Utica and pick them up fresh and folded. <em>(Home pickup/delivery is not provided).</em>
              </p>
              <div className="mt-2 pt-2 border-t border-blue-900/60 text-zinc-300 space-y-1">
                <p>
                  • <strong>Standard Turnaround:</strong> 48 to 72 hours (we text/notify you as soon as it’s ready).
                </p>
                <p>
                  • <strong>Same-Day Rush (Optional):</strong> Drop off by 10:00 AM $\rightarrow$ ready after 5:00 PM same day.
                </p>
              </div>
            </div>
          ) : (
            <p>
              📍 <strong>MVCC Curbside Campus Pickup:</strong> Bring your laundry bags out to the designated parking lot area. We do not enter dorm buildings. We notify you for curbside pickup in the lot when clean.
            </p>
          )}
        </div>

{/* SERVICES (CHOOSE ONE OR MORE) */}
        <div>
          <h2 className="text-sm font-bold text-zinc-300 mb-2">
            Base Services (choose one or more)
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {SERVICES.filter((s) => s !== "Rush Laundry").map((s) => {
              const active = selectedServices.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleService(s)}
                  className="px-4 py-2.5 rounded-full text-xs font-bold transition-all border select-none active:scale-95"
                  style={{
                    backgroundColor: active ? "#B0FF00" : "#1D1627",
                    borderColor: active ? "#B0FF00" : "#2E243D",
                    color: active ? "#0A0A0F" : "#FFFFFF",
                  }}
                >
                  {active ? `✓ ${s}` : s}
                </button>
              );
            })}
          </div>

          {/* ⚡ SAME-DAY RUSH UPGRADE CARD */}
          <div
            onClick={() => toggleService("Rush Laundry")}
            className="p-3.5 rounded-2xl border cursor-pointer flex justify-between items-center transition-all select-none"
            style={{
              backgroundColor: selectedServices.includes("Rush Laundry")
                ? "rgba(176, 255, 0, 0.1)"
                : "#1D1627",
              borderColor: selectedServices.includes("Rush Laundry")
                ? "#B0FF00"
                : "#2E243D",
            }}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white">⚡ Same-Day Rush Turnaround</p>
                {selectedServices.includes("Rush Laundry") && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-lime-400 text-black">ACTIVE</span>
                )}
              </div>
              <p className="text-xs text-lime-400 font-semibold mt-0.5">
                Drop off before 10:00 AM $\rightarrow$ Ready for pickup after 5:00 PM today
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Standard orders take 48–72 hours. Check this to jump to the front of the wash line!
              </p>
            </div>
            <span className="text-sm font-black text-lime-400 shrink-0 ml-2">
              +$20
            </span>
          </div>
        </div>

        {/* SIZE CHART IMAGE BANNER */}
        <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-md">
          <img
            src="/assets/images/bag-sizes.jpg"
            alt="Sour Apple Bag Size Chart"
            className="w-full h-auto object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/LOGO.png";
            }}
          />
        </div>

        {/* 🚫 STRICT NO OPEN BASKETS WARNING BOX */}
        <div
          className="p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderColor: "rgba(239, 68, 68, 0.45)",
            color: "#fca5a5",
          }}
        >
          <AlertTriangle size={20} className="shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-black text-xs text-red-300 uppercase tracking-wide">
              Strict Closure Policy — No Open Baskets
            </p>
            <p className="mt-0.5 text-zinc-200">
              All laundry <strong>MUST</strong> be dropped off in a bag with a secure closure (drawstring, Velcro, zipper, or snap buttons). Open plastic baskets with no lids are NOT accepted to prevent items from falling out during transport.
            </p>
          </div>
        </div>

        {/* BAGS COUNTER */}
        <div
          className="p-4 rounded-2xl border flex justify-between items-center"
          style={{ backgroundColor: "#1D1627", borderColor: "#2E243D" }}
        >
          <div>
            <span className="font-black text-base text-white">Bags</span>
            <p className="text-xs text-zinc-400 mt-0.5">
              $5 per additional bag after the 1st
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setBags(Math.max(1, bags - 1))}
              className="w-9 h-9 rounded-full border flex items-center justify-center font-bold text-white text-lg active:scale-90"
              style={{ backgroundColor: "#2A2038", borderColor: "#3D2E52" }}
            >
              -
            </button>
            <span className="font-black text-xl text-white w-6 text-center">
              {bags}
            </span>
            <button
              type="button"
              onClick={() => setBags(bags + 1)}
              className="w-9 h-9 rounded-full border flex items-center justify-center font-bold text-white text-lg active:scale-90"
              style={{ backgroundColor: "#2A2038", borderColor: "#3D2E52" }}
            >
              +
            </button>
          </div>
        </div>

        {/* SCENTED FORMULA NOTICE & PREFERENCES */}
        <Card>
          <h2 className="text-sm font-black mb-2 uppercase tracking-wider text-amber-400">
            Wash Preferences
          </h2>
          <div
            className="p-3 rounded-xl mb-3 border text-xs leading-relaxed"
            style={{
              backgroundColor: "rgba(176, 255, 0, 0.06)",
              borderColor: "rgba(176, 255, 0, 0.25)",
              color: "#fff",
            }}
          >
            <p className="font-bold mb-1 text-lime-400">🧺 Our Standard Wash Formula:</p>
            We wash all standard loads with fresh scented detergent, OxiClean, scent boosters, and scented fabric softener.
            <br />
            <span className="text-zinc-300 mt-1 block">
              <strong>Prefer unscented or hypoallergenic?</strong> Check the box below and include your own detergent bottle with your bag at drop-off!
            </span>
          </div>

          <div className="space-y-2 mb-3">
            {PREFERENCES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preferences.includes(p)}
                  onChange={() => togglePref(p)}
                  className="w-4 h-4 accent-lime-400"
                />
                <span className="text-zinc-200">{p}</span>
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

        {/* CONTACT & SCHEDULE TIMING */}
        <Card>
          <h2 className="text-sm font-black mb-3 uppercase tracking-wider text-amber-400">
            Contact & Preferred Time
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
          <Field
            label="Preferred Date"
            type="date"
            value={dropoffDate}
            onChangeText={setDropoffDate}
            required
          />
          <label className="block text-xs font-semibold mb-1 text-zinc-400">
            Preferred Time Window
          </label>
          <select
            value={dropoffWindow}
            onChange={(e) => setDropoffWindow(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border text-sm mb-2 text-white"
            style={{ backgroundColor: "#1D1627", borderColor: "#2E243D" }}
          >
            <option value="9am - 12pm">Morning Window (9am - 12pm)</option>
            <option value="12pm - 3pm">Afternoon Window (12pm - 3pm)</option>
            <option value="3pm - 6pm">Evening Window (3pm - 6pm)</option>
          </select>
        </Card>

        {/* SERVICE AGREEMENT & SIGNATURE */}
        <Card className="border-2" style={{ borderColor: "#B0FF00" }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-lime-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-lime-400">
              Service Agreement & Signature
            </h2>
          </div>
          <div
            className="p-3 rounded-lg text-[11px] leading-relaxed max-h-24 overflow-y-auto mb-3 border text-zinc-300"
            style={{ backgroundColor: "#15101F", borderColor: "#2E243D" }}
          >
            By booking with Sour Apple Wash & Fold Laundry Services, you agree: All laundry is handled with professional care. Standard turnaround is 48–72 hours unless Same-Day Rush is selected. All laundry must be delivered in bags with secure closure (drawstring, Velcro, zipper, or snaps — no open baskets). Liability for lost items is limited up to $100 per bag. Payment is collected upon drop-off or completion confirmation.
          </div>

          <label className="flex items-start gap-2 text-xs cursor-pointer select-none mb-3">
            <input
              type="checkbox"
              checked={contractAgreed}
              onChange={(e) => setContractAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-lime-400"
              required
            />
            <span className="font-semibold text-zinc-200">
              I have read, understood, and legally agree to the Sour Apple Wash & Fold Service Agreement (including closed-bag requirements).
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

        {/* SUBMIT BUTTON WITH LIVE PRICE */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm font-bold text-zinc-400">Estimated Total:</span>
            <span className="text-2xl font-black text-lime-400">
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
