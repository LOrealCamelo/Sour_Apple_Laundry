import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, ShieldCheck, MapPin, Check, AlertTriangle, Camera } from "lucide-react";
import { api } from "@/src/api/client";
import { colors } from "@/src/theme";
import { Card, Btn, Field } from "@/src/components/UI";

const BAG_SIZES = [
  {
    id: "small",
    name: "Small Bag (27 Inch)",
    price: 10,
    visual: "27 inch Closed bag (drawstring, Velcro, zipper, or snaps)",
    desc: "Up to 10 lbs, about 1-2 days of clothes",
  },
  {
    id: "medium",
    name: "Medium Bag (32 Inch - Most Popular)",
    price: 20,
    visual: "32 inch Closed bag (drawstring, Velcro, zipper, or snaps)",
    desc: "15-20 lbs, a full week of clothes for 1 person",
  },
  {
    id: "large",
    name: "Large Bag (40 Inch)",
    price: 30,
    visual: "40 inch Heavy-duty closed bag (drawstring, Velcro, zipper, or snaps)",
    desc: "25-30+ lbs, 2 weeks of laundry or family load",
  },
];

const ADDON_SERVICES = [
  { id: "Bedding", name: "Bedding / Comforter", price: 25, desc: "Comforters, blankets and heavy sheets" },
  { id: "Towels", name: "Extra Towel Bundle", price: 15, desc: "Bundle of bath towels, mats and washcloths" },
  { id: "Rush Laundry", name: "Rush Same-Day Turnaround", price: 40, desc: "Guaranteed priority turnaround" },
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

  const [customerType, setCustomerType] = useState("NON_STUDENT");
  const [mvccRole, setMvccRole] = useState("Student");
  const [selectedSize, setSelectedSize] = useState("medium");
  const [bagQty, setBagQty] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([
    "Standard Sour Apple Fresh (Scented detergent, OxiClean, Scent booster & Softener)",
  ]);
  const [stainNotes, setStainNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffWindow, setDropoffWindow] = useState("9am - 12pm");
  const [bagPhoto, setBagPhoto] = useState<string | null>(null);
  const [contractAgreed, setContractAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [estimate, setEstimate] = useState(20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let total = 0;
    const sizeObj = BAG_SIZES.find((s) => s.id === selectedSize) || BAG_SIZES;
    total += sizeObj.price * bagQty;

    selectedAddons.forEach((addonId) => {
      const addon = ADDON_SERVICES.find((a) => a.id === addonId);
      if (addon) total += addon.price;
    });

    setEstimate(total);
  }, [selectedSize, bagQty, selectedAddons]);

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

  const submitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");

    if (!contractAgreed) {
      setErr("Please check the box to agree to the Service Agreement before booking.");
      return;
    }
    if (!signatureName.trim()) {
      setErr("Please type your full legal name as your electronic signature.");
      return;
    }

    setLoading(true);
    try {
      const sizeObj = BAG_SIZES.find((s) => s.id === selectedSize);
      const allServices = [`${sizeObj?.name} (${sizeObj?.visual})`, ...selectedAddons];

      const order = await api("/orders", {
        method: "POST",
        body: {
          services: allServices,
          service_type: sizeObj?.name,
          customer_type: customerType === "NON_STUDENT" ? "Neighborhood Resident" : "College Student",
          college: customerType === "MVCC" ? "MVCC" : "",
          dorm: locationDetail,
          directions: customerType === "NON_STUDENT" ? "South Utica Drop-off" : `MVCC ${mvccRole} Pickup`,
          pickup_date: dropoffDate || new Date().toISOString().split("T")[0],
          pickup_window: dropoffWindow,
          bags: bagQty,
          rush: selectedAddons.includes("Rush Laundry"),
          bedding_addon: selectedAddons.includes("Bedding"),
          preferences,
          stain_notes: stainNotes,
          bag_image_base64: bagPhoto,
          image_review_requested: Boolean(bagPhoto),
          image_review_email: "natture1st@gmail.com",
          bag_price_each: sizeObj?.price || 20,
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
      <div className="flex items-center gap-2 mb-4 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full active:scale-90 transition-transform"
        >
          <ChevronLeft size={28} className="text-white" />
        </button>
        <h1 className="text-2xl font-black tracking-tight text-white">
          Schedule Service
        </h1>
      </div>

      <form onSubmit={submitOrder} className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCustomerType("NON_STUDENT")}
            className="py-3 rounded-xl border text-center transition-all active:scale-95"
            style={{
              backgroundColor: customerType === "NON_STUDENT" ? "#B0FF00" : "#1D1627",
              borderColor: customerType === "NON_STUDENT" ? "#B0FF00" : "#333",
              color: customerType === "NON_STUDENT" ? "#000" : "#fff",
            }}
          >
            <span className="block text-sm font-black">Non Student</span>
            <span className="block text-[10px] opacity-80 mt-0.5">South Utica Drop-Off</span>
          </button>

          <button
            type="button"
            onClick={() => setCustomerType("MVCC")}
            className="py-3 rounded-xl border text-center transition-all active:scale-95"
            style={{
              backgroundColor: customerType === "MVCC" ? "#B0FF00" : "#1D1627",
              borderColor: customerType === "MVCC" ? "#B0FF00" : "#333",
              color: customerType === "MVCC" ? "#000" : "#fff",
            }}
          >
            <span className="block text-sm font-black">MVCC</span>
            <span className="block text-[10px] opacity-80 mt-0.5">Campus Pickup</span>
          </button>
        </div>

        {customerType === "MVCC" && (
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <button
              type="button"
              onClick={() => setMvccRole("Student")}
              className="py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: mvccRole === "Student" ? "#B0FF00" : "transparent",
                color: mvccRole === "Student" ? "#000" : "#888",
              }}
            >
              Student (Dorm Curbside)
            </button>
            <button
              type="button"
              onClick={() => setMvccRole("Faculty")}
              className="py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: mvccRole === "Faculty" ? "#B0FF00" : "transparent",
                color: mvccRole === "Faculty" ? "#000" : "#888",
              }}
            >
              Faculty / Staff
            </button>
          </div>
        )}

        <div
          className="p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 shadow-sm"
          style={{
            backgroundColor: "rgba(176, 255, 0, 0.06)",
            borderColor: "rgba(176, 255, 0, 0.25)",
            color: "#fff",
          }}
        >
          <MapPin size={20} className="shrink-0 mt-0.5 text-lime-400" />
          <div>
            <p className="font-extrabold text-xs text-lime-400">
              {customerType === "NON_STUDENT"
                ? "Drop-Off & Pick-Up Destination: South Utica, NY"
                : "MVCC Campus Pickup & Delivery"}
            </p>
            <p className="text-zinc-300 mt-0.5">
              {customerType === "NON_STUDENT"
                ? "Open to everyone! Drop off your laundry in South Utica, and pick it up fresh and neatly folded."
                : "Scheduled curbside pickup outside residence halls or department parking lots twice weekly."}
            </p>
          </div>
        </div>

        <Card>
          <h2 className="text-sm font-black mb-1 uppercase tracking-wider text-amber-400">
            1. Select Your Bag Size
          </h2>
          <p className="text-xs mb-3 text-zinc-400">
            Refer to our visual size chart below:
          </p>

          <div className="mb-3 rounded-xl overflow-hidden border border-zinc-800 shadow-md">
            <img
              src="/assets/images/bag-sizes.jpg"
              alt="Sour Apple Bag Size Chart"
              className="w-full h-auto object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/LOGO.png";
              }}
            />
          </div>

          <div
            className="p-3.5 rounded-xl mb-3 border text-xs leading-relaxed flex items-start gap-2.5 shadow-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              borderColor: "rgba(239, 68, 68, 0.45)",
              color: "#fca5a5",
            }}
          >
            <AlertTriangle size={20} className="shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-black text-xs text-red-300 uppercase tracking-wide">
                Strict Closure Policy - No Open Baskets
              </p>
              <p className="mt-0.5 text-zinc-200">
                All laundry MUST be dropped off in a bag with a secure closure (drawstring, Velcro, zipper, or snap buttons). Open plastic baskets with no lids are NOT accepted.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {BAG_SIZES.map((s) => {
              const active = selectedSize === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSize(s.id)}
                  className="p-3.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all select-none"
                  style={{
                    backgroundColor: active ? "rgba(176, 255, 0, 0.08)" : "#1a1a1a",
                    borderColor: active ? "#B0FF00" : "#222",
                  }}
                >
                  <div className="pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white">{s.name}</p>
                      {active && <Check size={14} className="text-lime-400" />}
                    </div>
                    <p className="text-xs font-semibold mt-0.5 text-lime-400">
                      {s.visual}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{s.desc}</p>
                  </div>
                  <span className="text-base font-black shrink-0 text-lime-400">
                    ${s.price}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
            <span className="text-xs font-bold text-white">Quantity of bags:</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBagQty(Math.max(1, bagQty - 1))}
                className="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-white active:scale-90"
                style={{ borderColor: "#333", backgroundColor: "#111" }}
              >
                -
              </button>
              <span className="font-black text-lg text-lime-400">
                {bagQty}
              </span>
              <button
                type="button"
                onClick={() => setBagQty(bagQty + 1)}
                className="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-white active:scale-90"
                style={{ borderColor: "#333", backgroundColor: "#111" }}
              >
                +
              </button>
            </div>
          </div>
        </Card>

        {/* Bag Photo Upload Verification */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Camera size={18} className="text-lime-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
              Bag Size Verification Photo
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Snap a photo of your closed bag so we can verify the size before approval.
          </p>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  setBagPhoto(reader.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
            className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-lime-400 file:text-black cursor-pointer"
          />

          {Boolean(bagPhoto) && (
            <div className="mt-3 relative w-24 h-24 rounded-xl overflow-hidden border-2 border-lime-400">
              <img src={bagPhoto} alt="Bag Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-black mb-2 uppercase tracking-wider text-amber-400">
            Optional Upgrades
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
                    backgroundColor: checked ? "rgba(176, 255, 0, 0.08)" : "#1a1a1a",
                    borderColor: checked ? "#B0FF00" : "#222",
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{a.name}</p>
                    <p className="text-xs text-zinc-400">{a.desc}</p>
                  </div>
                  <span className="text-sm font-black text-lime-400">
                    +${a.price}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-black mb-2 uppercase tracking-wider text-amber-400">
            2. Wash Preferences
          </h2>
          <div
            className="p-3 rounded-xl mb-3 border text-xs leading-relaxed"
            style={{
              backgroundColor: "rgba(176, 255, 0, 0.06)",
              borderColor: "rgba(176, 255, 0, 0.25)",
              color: "#fff",
            }}
          >
            <p className="font-bold mb-1 text-lime-400">Our Standard Wash Formula:</p>
            We wash all standard loads with fresh scented detergent, OxiClean, scent boosters, and scented fabric softener.
            <br />
            <span className="text-zinc-300 mt-1 block">
              Prefer unscented or hypoallergenic? Check the box below and include your own detergent bottle with your bag!
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
                <span className="text-white">{p}</span>
              </label>
            ))}
          </div>

          <Field
            label="Stain Notes or Fragile Instructions"
            value={stainNotes}
            onChangeText={setStainNotes}
            placeholder="e.g. coffee stain on collar"
          />
        </Card>

        <Card>
          <h2 className="text-sm font-black mb-3 uppercase tracking-wider text-amber-400">
            3. Schedule and Contact
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

          {customerType === "NON_STUDENT" ? (
            <Field
              label="Your Street Address / Area"
              value={locationDetail}
              onChangeText={setLocationDetail}
              placeholder="e.g. 123 Elm St, South Utica"
              required
            />
          ) : mvccRole === "Student" ? (
            <Field
              label="Residence Hall and Room #"
              value={locationDetail}
              onChangeText={setLocationDetail}
              placeholder="e.g. West Hall Rm 204"
              required
            />
          ) : (
            <Field
              label="Campus Building and Department / Office #"
              value={locationDetail}
              onChangeText={setLocationDetail}
              placeholder="e.g. Payne Hall, Office 102"
              required
            />
          )}

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
            className="w-full h-10 px-3 rounded-xl border text-sm mb-2 text-white bg-zinc-900 border-zinc-800"
          >
            <option value="9am - 12pm">Morning (9am - 12pm)</option>
            <option value="12pm - 3pm">Afternoon (12pm - 3pm)</option>
            <option value="3pm - 6pm">Evening (3pm - 6pm)</option>
          </select>
        </Card>

        <Card className="border-2 border-lime-400">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-lime-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-lime-400">
              Service Agreement and Signature
            </h2>
          </div>

          <div className="p-3 rounded-lg text-[11px] leading-relaxed max-h-24 overflow-y-auto mb-3 border text-zinc-300 bg-zinc-900 border-zinc-800">
            By booking with Sour Apple VIP, you agree: All laundry must be delivered in bags with secure closure (drawstring, Velcro, zipper, or snaps - no open baskets). Liability for lost items is limited up to $100 per bag. Payment is collected upon drop-off or completion confirmation.
          </div>

          <label className="flex items-start gap-2 text-xs cursor-pointer select-none mb-3">
            <input
              type="checkbox"
              checked={contractAgreed}
              onChange={(e) => setContractAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-lime-400"
              required
            />
            <span className="font-semibold text-white">
              I have read, understood, and legally agree to the Service Agreement.
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

        {Boolean(err) && (
          <div className="p-3 rounded-xl bg-red-900/30 border border-red-500 text-red-400 text-xs font-bold text-center">
            {err}
          </div>
        )}

        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm font-bold text-zinc-400">Estimated Total:</span>
            <span className="text-2xl font-black text-lime-400">
              ${estimate.toFixed(2)}
            </span>
          </div>

          <Btn
            title={`Book Service - $${estimate.toFixed(2)}`}
            type="submit"
            loading={loading}
            data-testid="submit-order-button"
          />
        </div>
      </form>
    </div>
  );
}
