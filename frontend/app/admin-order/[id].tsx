import { Card, Btn, Badge } from "@/src/components/UI";
import OrderChat from "@/src/components/OrderChat";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { colors, statusColor } from "@/src/theme";
import { api } from "@/src/api/client";

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
        body: { status: "Paid" },
      })
    );

  const assign = (jobId: string, driverId: string) =>
    act(async () => {
      await api(`/admin/jobs/${jobId}/assign`, { method: "POST", body: { status: driverId } });
    });

  const saveSchedule = () =>
    act(() =>
      api(`/admin/orders/${id}/schedule`, {
        method: "POST",
        body: { pickup_window: schedPickup, delivery_date: schedDelDate, delivery_window: schedDelTime },
      })
    );

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="admin-order-detail"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pt-2">
        <div>
          <h1 className="text-xl font-black" style={{ color: colors.text || "#fff" }}>
            Order {order.code}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: colors.textDim || "#888" }}>
            {order.student_name} · {order.phone}
          </p>
        </div>
        <Badge text={order.status} color={statusColor(order.status)} />
      </div>

      {/* Customer Bag Photo (if provided) */}
      {order.photos?.length > 0 && (
        <Card className="mb-4">
          <h2 className="font-bold text-sm mb-2 text-white">Customer Bag Photo</h2>
          <img
            src={order.photos[0]}
            alt="Customer Bag"
            className="w-full h-48 object-cover rounded-xl border border-zinc-700"
          />
          <div className="flex gap-3 mt-3">
            <Btn title="Approve Image" variant="gold" onClick={approve} loading={busy} />
            <Btn title="Reject Image" variant="ghost" onClick={reject} loading={busy} />
          </div>
        </Card>
      )}

      {/* Details */}
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-sm font-bold" style={{ color: colors.text || "#fff" }}>
              {order.service_type}
            </p>
            <p className="text-xs mt-0.5" style={{ color: colors.textDim || "#888" }}>
              {order.bags} bag(s) {order.rush ? "· RUSH" : ""} {order.bedding_addon ? "· Bedding" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black" style={{ color: colors.apple || "#B0FF00" }}>
            ${order.price}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.textDim || "#888" }}>
            {order.payment_status}
          </p>
        </div>
      </Card>

      <Card className="mb-4">
        <OrderChat orderId={id!} myRole={"ADMIN"} />
      </Card>

      <div className="flex gap-3 mb-4">
        <Btn title="Approve" variant="gold" onClick={approve} loading={busy} />
        <Btn title="Reject" variant="ghost" onClick={reject} loading={busy} />
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-xl border text-xs" style={{ borderColor: colors.border || "#222" }}>
          <p className="text-xs text-zinc-400">Manage job release, driver assignment, and schedule.
*** End Patch