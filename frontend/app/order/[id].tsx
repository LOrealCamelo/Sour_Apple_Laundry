import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Check, DollarSign, Wallet } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, statusColor } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";
import OrderChat from "@/src/components/OrderChat";
import RatingStars from "@/src/components/RatingStars";

const FLOW = [
  "Request Submitted",
  "Pending Admin Approval",
  "Approved",
  "Pickup Scheduled",
  "Picked Up",
  "Washing",
  "Drying",
  "Folding",
  "Quality Check",
  "Ready for Pickup",
  "Out for Delivery",
  "Delivered",
];

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = searchParams.get("new");
  const paid = searchParams.get("paid");

  const [order, setOrder] = useState<any>(null);
  const [methods, setMethods] = useState<any>({});
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setOrder(await api(`/orders/${id}`));
      setMethods(await api("/payments/methods", { auth: false }));
    } catch (e) {
      console.error("Failed to load order", e);
    }
  };

  useEffect(() => {
    (async () => {
      if (paid === "1") {
        try {
          await api(`/payments/stripe/verify/${id}`, { method: "POST" });
        } catch {}
      }
      await load();
    })();
  }, [id, paid]);

  if (!order) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.bg || "#000" }}
      >
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: `${colors.apple || "#B0FF00"} transparent transparent transparent` }}
        />
      </div>
    );
  }

  const doneStatuses = new Set(order.history?.map((h: any) => h.status) || []);
  const currentIdx = FLOW.indexOf(order.status);
  const isCollege = order.customer_type === "College Student";

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e: any) {
      alert(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  // Stripe Checkout Redirect (Standard Browser Redirect)
  const payStripe = async () => {
    setBusy(true);
    try {
      const r: any = await api(`/payments/stripe/checkout/${id}`, { method: "POST" });
      if (r.url) {
        window.location.href = r.url; // Redirects smoothly in browser
      }
    } catch (e: any) {
      alert(e.message || "Stripe checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const payManual = (m: string) =>
    act(() => api(`/payments/manual/${id}`, { method: "POST", body: { method: m } }));

  const rate = () =>
    stars &&
    act(() => api(`/orders/${id}/rate`, { method: "POST", body: { stars, feedback: "" } }));

  const reorder = async () => {
    try {
      const o: any = await api(`/orders/${id}/reorder`, { method: "POST" });
      navigate(`/order/${o.id}?new=1`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const confirmPickup = () => act(() => api(`/orders/${id}/confirm-pickup`, { method: "POST" }));
  const requestChange = () =>
    act(() =>
      api(`/orders/${id}/request-change`, {
        method: "POST",
        body: { note: "Customer requested a date/time change" },
      })
    );
  const cancel = () => act(() => api(`/orders/${id}/cancel`, { method: "POST" }));

  const canCancel = [
    "Request Submitted",
    "Pending Admin Approval",
    "Approved",
    "Needs Customer Follow-Up",
  ].includes(order.status);
  const unpaid = order.payment_status === "Unpaid" || order.payment_status === "Processing";

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="order-tracking-screen"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full active:scale-95 transition-transform"
          title="Go back"
        >
          <ChevronLeft size={28} style={{ color: colors.text || "#fff" }} />
        </button>
        <Badge text={order.status} color={statusColor(order.status)} />
      </div>

      {/* New Order Banner */}
      {isNew === "1" && (
        <div
          className="p-4 rounded-xl mb-4 border"
          style={{
            borderColor: colors.warn || "#ffaa00",
            backgroundColor: "rgba(255, 170, 0, 0.12)",
          }}
        >
          <h2 className="font-extrabold text-sm" style={{ color: colors.text || "#fff" }}>
            ✅ Request submitted!
          </h2>
          <p className="text-xs mt-1" style={{ color: colors.textDim || "#ccc" }}>
            Your request is pending Sour Apple VIP approval.
          </p>
        </div>
      )}

      {/* Order Tracking Code Card */}
      <Card className="text-center mb-4 border-2" style={{ borderColor: colors.gold || "#FFD700" }}>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: colors.textDim || "#888" }}>
          ORDER TRACKING NUMBER
        </p>
        <h1
          className="text-2xl font-black mt-1 mb-1 tracking-wider"
          style={{ color: colors.gold || "#FFD700" }}
          data-testid="order-tracking-number"
        >
          {order.code}
        </h1>
        <p className="text-xs" style={{ color: colors.textDim || "#888" }}>
          Show this to Sour Apple VIP for your order
        </p>
      </Card>

      {/* Order Details Card */}
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-base" style={{ color: colors.text || "#fff" }}>
            {order.service_type}
          </span>
          <span className="text-xs font-bold" style={{ color: colors.info || "#00b4d8" }}>
            {order.customer_type}
          </span>
        </div>
        <p className="text-xs mb-1" style={{ color: colors.textDim || "#888" }}>
          {order.bags} bag(s){order.rush ? " · RUSH" : ""}{order.bedding_addon ? " · Bedding" : ""}
        </p>
        {isCollege && (
          <p className="text-xs mb-1" style={{ color: colors.textDim || "#888" }}>
            {order.college} · {order.dorm}
          </p>
        )}
        {Boolean(order.directions) && (
          <p className="text-xs mb-1 italic" style={{ color: colors.textDim || "#888" }}>
            Directions: {order.directions}
          </p>
        )}
        <p className="text-xs mb-1" style={{ color: colors.textDim || "#888" }}>
          Preferred: {order.pickup_date} · {order.pickup_window}
        </p>
        {Boolean(order.delivery_window) && (
          <p className="text-xs font-semibold mt-1" style={{ color: colors.gold || "#FFD700" }}>
            Delivery set: {order.delivery_date} {order.delivery_window}
          </p>
        )}
      </Card>

      {/* Payment Card */}
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span
{