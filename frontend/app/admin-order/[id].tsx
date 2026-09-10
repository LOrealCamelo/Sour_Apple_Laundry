import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, FileCheck, Camera } from "lucide-react";
import { api } from "@/src/api/client";
import { colors, statusColor } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";
import OrderChat from "@/src/components/OrderChat";

const NEXT_STATUS = [
  "Picked Up",
  "Checked In",
  "Washing",
  "Drying",
  "Folding",
  "Quality Check",
  "Ready for Pickup",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const JOB_TYPES = ["Pickup", "Delivery", "Pickup + Delivery"];

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
      const o: any = await api(`/orders/${id}`);
      setOrder(o);
      setPrice(String(o.price || ""));
      const allJobs: any[] = await api("/admin/jobs");
      setJobs((allJobs || []).filter((j) => j.order_id === id));
      setDrivers((await api("/admin/drivers")) || []);
    } catch (e) {
      console.error("Failed to load admin order", e);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!order) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.bg || "#000" }}
      >
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: `${colors.gold || "#FFD700"} transparent transparent transparent` }}
        />
      </div>
    );
  }

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

  const approve = () =>
    act(() =>
      api(`/admin/orders/${id}/approve`, {
        method: "POST",
        body: { price: parseFloat(price) || 0, admin_note: note },
      })
    );

  const reject = () =>
    act(() =>
      api(`/admin/orders/${id}/reject`, {
        method: "POST",
        body: { reason: note || "Rejected" },
      })
    );

  const release = () =>
    act(() =>
      api(`/admin/orders/${id}/release`, {
        method: "POST",
        body: {
          job_type: jobType,
          payout: parseFloat(payout) || 12.0,
          auto_assign_first_claim: autoAssign,
        },
      })
    );

  const setStatus = (s: string) =>
    act(() =>
      api(`/admin/orders/${id}/status`, {
        method: "POST",
        body: { status: s },
      })
    );

  const markPaid = () =>
    act(() =>
      api(`/admin/orders/${id}/payment`, {
        method: "POST",
        body: { status: order.payment_status === "Paid" ? "Unpaid" : "Paid" },
      })
    );

  const assign = (jobId: string, driverId: string) =>
    act(() =>
      api(`/admin/jobs/${jobId}/assign`, {
        method: "POST",
        body: { status: driverId },
      })
    );

  const saveSchedule = () =>
    act(() =>
      api(`/admin/orders/${id}/schedule`, {
        method: "POST",
        body: {
          pickup_window: schedPickup || undefined,
          delivery_date: schedDelDate || undefined,
          delivery_window: schedDelTime || undefined,
        },
      })
    );

  const bagImage = order.photos?.[0] || order.bag_image_base64;

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="admin-order-detail"
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
        <h1
          className="text-lg font-black tracking-wide"
          style={{ color: colors.gold || "#FFD700" }}
        >
          {order.code}
        </h1>
        <Badge text={order.status} color={statusColor(order.status)} />
      </div>

      <div className="space-y-4">
        {/* Customer Card */}
        <Card>
          <h2 className="font-bold text-sm mb-1" style={{ color: colors.text || "#fff" }}>
            Customer
          </h2>
          <p className="text-sm font-semibold" style={{ color: colors.text || "#fff" }}>
            {order.student_name} · {order.phone}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.textDim || "#888" }}>
            {order.customer_type}
            {order.college ? ` · ${order.college}` : ""}
          </p>
          {Boolean(order.dorm) && (
            <p className="text-xs mt-0.5" style={{ color: colors.textDim || "#888" }}>
              Location: {order.dorm}
            </p>
          )}
        </Card>

        {/* Customer Bag Verification Photo */}
        {Boolean(bagImage) && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Camera size={18} className="text-lime-400" />
              <h2 className="font-bold text-sm text-white">Bag Verification Photo</h2>
            </div>
            <div className="rounded-xl overflow-hidden border border-zinc-700 max-h-56">
              <img
                src={bagImage}
                alt="Customer Bag"
                className="w-full h-full object-cover"
              />
            </div>
          </Card>
        )}

        {/* Digital Contract Card */}
        {order.contract_agreed && (
          <div
            className="p-3.5 rounded-xl border flex items-center justify-between"
            style={{
              borderColor: colors.apple || "#B0FF00",
              backgroundColor: "rgba(176, 255, 0, 0.08)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <FileCheck size={20} style={{ color: colors.apple || "#B0FF00" }} />
              <div>
                <p className="text-xs font-bold" style={{ color: colors.text || "#fff" }}>
                  Contract Signed Digitally
                </p>
                <p className="text-xs" style={{ color: colors.textDim || "#aaa" }}>
                  Signed by: <span className="font-semibold text-white">{order.signature_name}</span>
                </p>
              </div>
            </div>
            <Badge text="Verified" color={colors.apple || "#B0FF00"} />
          </div>
        )}

        {/* Order Details & Payment */}
        <Card>
          <h2 className="font-bold text-sm mb-1" style={{ color: colors.text || "#fff" }}>
            Order Details
          </h2>
          <p className="text-sm font-semibold" style={{ color: colors.text || "#fff" }}>
            {order.service_type} · {order.bags} bag(s)
            {order.rush ? " · RUSH" : ""}
          </p>
          <p className="text-xs mt-1" style={{ color: colors.textDim || "#888" }}>
            Preferred Date: {order.pickup_date} ({order.pickup_window})
          </p>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800">
            <Badge
              text={order.payment_status + (order.payment_method ? ` · ${order.payment_method}` : "")}
              color={order.payment_status === "Paid" ? colors.apple || "#B0FF00" : colors.warn || "#ffaa00"}
            />
            <button
              type="button"
              onClick={markPaid}
              className="text-xs font-bold underline"
              style={{ color: colors.apple || "#B0FF00" }}
            >
              Mark {order.payment_status === "Paid" ? "Unpaid" : "Paid"}
            </button>
          </div>
        </Card>

        {/* Scheduling Controls */}
        <Card>
          <h2 className="font-bold text-sm mb-2" style={{ color: colors.text || "#fff" }}>
            Set Confirmed Times
          </h2>
          <input
            type="text"
            value={schedPickup}
            onChange={(e) => setSchedPickup(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm mb-3 bg-zinc-900 border-zinc-800 text-white"
            placeholder="Confirmed pickup window"
          />
          <Btn title="Save Schedule" onClick={saveSchedule} loading={busy} />
        </Card>

        {/* Messages */}
        <Card>
          <h2 className="font-bold text-sm mb-3 text-white">Messages</h2>
          <OrderChat orderId={id!} myRole="ADMIN" />
        </Card>

        {/* Review & Decide (Approve / Reject) */}
        {order.status === "Pending Admin Approval" && (
          <Card>
            <h2 className="font-bold text-sm mb-2 text-white">Review & Decide</h2>
            <label className="block text-xs font-semibold mb-1 text-zinc-400">Adjust Price ($)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm mb-3 bg-zinc-900 border-zinc-800 text-white"
            />
            <label className="block text-xs font-semibold mb-1 text-zinc-400">Note / Reason</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm mb-3 bg-zinc-900 border-zinc-800 text-white"
              placeholder="e.g. Adjusted to medium bag size"
            />
            <div className="space-y-2">
              <Btn title="Approve Request" onClick={approve} loading={busy} />
              <Btn title="Reject" variant="ghost" onClick={reject} />
            </div>
          </Card>
        )}

        {/* Update Laundry Status Chips */}
        <Card>
          <h2 className="font-bold text-sm mb-3 text-white">Update Status</h2>
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95"
                style={{
                  backgroundColor: order.status === s ? colors.gold || "#FFD700" : "#1a1a1a",
                  borderColor: order.status === s ? colors.gold || "#FFD700" : "#333",
                  color: order.status === s ? "#000" : "#fff",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

