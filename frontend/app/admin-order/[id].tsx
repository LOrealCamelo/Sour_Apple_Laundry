import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, FileCheck } from "lucide-react";
import { api } from "@/src/api/client";
import { colors, spacing, statusColor } from "@/src/theme";
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
              Dorm/Building: {order.dorm}
            </p>
          )}
          {Boolean(order.directions) && (
            <p className="text-xs mt-0.5 italic" style={{ color: colors.textDim || "#888" }}>
              Directions: {order.directions}
            </p>
          )}
        </Card>

        {/* Digital Contract Verification Card */}
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
                  Signed by:{" "}
                  <span className="font-semibold text-white">
                    {order.signature_name || order.student_name}
                  </span>
                </p>
              </div>
            </div>
            <Badge text="Verified" color={colors.apple || "#B0FF00"} />
          </div>
        )}

        {/* Customer Change Request Banner */}
        {order.change_request && (
          <div
            className="p-3.5 rounded-xl border"
            style={{
              borderColor: colors.warn || "#ffaa00",
              backgroundColor: "rgba(255, 170, 0, 0.12)",
            }}
          >
            <p className="font-bold text-xs" style={{ color: colors.text || "#fff" }}>
              ⚠️ Customer requested a change
            </p>
            <p className="text-xs mt-1" style={{ color: colors.textDim || "#ccc" }}>
              {order.change_request.note}
            </p>
          </div>
        )}

        {/* Pickup Confirmed Card */}
        {order.pickup_confirmed && (
          <Card className="border" style={{ borderColor: colors.apple || "#B0FF00" }}>
            <p className="text-xs font-bold" style={{ color: colors.apple || "#B0FF00" }}>
              ✅ Customer confirmed pickup
            </p>
          </Card>
        )}

        {/* Order Details & Payment Toggle Card */}
        <Card>
          <h2 className="font-bold text-sm mb-1" style={{ color: colors.text || "#fff" }}>
            Order Details
          </h2>
          <p className="text-sm font-semibold" style={{ color: colors.text || "#fff" }}>
            {order.service_type} · {order.bags} bag(s)
            {order.rush ? " · RUSH" : ""}
            {order.bedding_addon ? " · Bedding" : ""}
          </p>
          <p className="text-xs mt-1" style={{ color: colors.textDim || "#888" }}>
            Preferred: {order.pickup_date} {order.pickup_window}
          </p>
          {Boolean(order.delivery_window) && (
            <p className="text-xs mt-1" style={{ color: colors.gold || "#FFD700" }}>
              Delivery set: {order.delivery_date} {order.delivery_window}
            </p>
          )}
          {order.preferences?.length > 0 && (
            <p className="text-xs mt-1" style={{ color: colors.textDim || "#888" }}>
              Prefs: {order.preferences.join(", ")}
            </p>
          )}
          {Boolean(order.stain_notes) && (
            <p className="text-xs mt-1 italic" style={{ color: colors.textDim || "#888" }}>
              Notes: {order.stain_notes}
            </p>
          )}

          {/* Payment Status & Toggle Button */}
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800">
            <Badge
              text={
                order.payment_status +
                (order.payment_method ? ` · ${order.payment_method}` : "")
              }
              color={
                order.payment_status === "Paid"
                  ? colors.apple || "#B0FF00"
                  : colors.warn || "#ffaa00"
              }
            />
            <button
              type="button"
              data-testid="toggle-payment"
              onClick={markPaid}
              className="text-xs font-bold underline transition-opacity hover:opacity-80"
              style={{ color: colors.apple || "#B0FF00" }}
            >
              Mark {order.payment_status === "Paid" ? "Unpaid" : "Paid"}
            </button>
          </div>
        </Card>

        {/* Set Times / Scheduling Card */}
        <Card>
          <h2 className="font-bold text-sm mb-2" style={{ color: colors.text || "#fff" }}>
            Set Times (You Control Scheduling)
          </h2>

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
            Confirmed pickup time
          </label>
          <input
            data-testid="sched-pickup"
            type="text"
            value={schedPickup}
            onChange={(e) => setSchedPickup(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm mb-3"
            style={{
              backgroundColor: colors.surfaceAlt || "#1a1a1a",
              borderColor: colors.border || "#333",
              color: colors.text || "#fff",
            }}
            placeholder="e.g. Wed 06/25 10:00 AM EST"
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
            Delivery date (mm/dd/yyyy)
          </label>
          <input
            data-testid="sched-deldate"
            type="text"
            value={schedDelDate}
            onChange={(e) => setSchedDelDate(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm mb-3"
            style={{
              backgroundColor: colors.surfaceAlt || "#1a1a1a",
              borderColor: colors.border || "#333",
              color: colors.text || "#fff",
            }}
            placeholder="06/27/2026"
          />

          <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
            Delivery time
          </label>
          <input
            data-testid="sched-deltime"
            type="text"
            value={schedDelTime}
            onChange={(e) => setSchedDelTime(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm mb-3"
            style={{
              backgroundColor: colors.surfaceAlt || "#1a1a1a",
              borderColor: colors.border || "#333",
              color: colors.text || "#fff",
            }}
            placeholder="e.g. 4:00 PM EST"
          />

          <Btn
            title="Save Schedule"
            onClick={saveSchedule}
            loading={busy}
            data-testid="save-schedule-button"
          />
        </Card>

        {/* Messages Card */}
        <Card>
          <h2 className="font-bold text-sm mb-3" style={{ color: colors.text || "#fff" }}>
            Messages
          </h2>
          <OrderChat orderId={id!} myRole="ADMIN" />
        </Card>

        {/* Review & Decide (Only shown if Pending Admin Approval) */}
        {order.status === "Pending Admin Approval" && (
          <Card>
            <h2 className="font-bold text-sm mb-2" style={{ color: colors.text || "#fff" }}>
              Review & Decide
            </h2>

            <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
              Adjust price ($)
            </label>
            <input
              data-testid="price-input"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm mb-3"
              style={{
                backgroundColor: colors.surfaceAlt || "#1a1a1a",
                borderColor: colors.border || "#333",
                color: colors.text || "#fff",
              }}
            />

            <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
              Note (optional / rejection reason)
            </label>
            <input
              data-testid="admin-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm mb-3"
              style={{
                backgroundColor: colors.surfaceAlt || "#1a1a1a",
                borderColor: colors.border || "#333",
                color: colors.text || "#fff",
              }}
              placeholder="Internal / customer note"
            />

            <div className="space-y-2">
              <Btn
                title="Approve Request"
                onClick={approve}
                loading={busy}
                data-testid="approve-button"
              />
              <Btn
                title="Reject"
                variant="ghost"
                onClick={reject}
                data-testid="reject-button"
              />
            </div>
          </Card>
        )}

        {/* Release Driver Job Section */}
        {["Approved", "Pickup Job Released", "Delivery Job Released", "Quality Check", "Driver Assigned"].includes(order.status) && (
          <Card>
            <h2 className="font-bold text-sm mb-2" style={{ color: colors.text || "#fff" }}>
              Release Driver Job
            </h2>

            {/* Job Type Chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {JOB_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`jobtype-${t}`}
                  onClick={() => setJobType(t)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95"
                  style={{
                    backgroundColor: jobType === t ? colors.gold || "#FFD700" : colors.surfaceAlt || "#1a1a1a",
                    borderColor: jobType === t ? colors.gold || "#FFD700" : colors.border || "#333",
                    color: jobType === t ? colors.bg || "#000" : colors.text || "#fff",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold mb-1" style={{ color: colors.textDim || "#888" }}>
              Driver payout ($)
            </label>
            <input
              data-testid="payout-input"
              type="number"
              value={payout}
              onChange={(e) => setPayout(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm mb-3"
              style={{
                backgroundColor: colors.surfaceAlt || "#1a1a1a",
                borderColor: colors.border || "#333",
                color: colors.text || "#fff",
              }}
            />

            {/* Auto Assign Toggle */}
            <label className="flex items-center justify-between cursor-pointer mb-3 py-1">
              <span className="text-xs font-semibold" style={{ color: colors.text || "#fff" }}>
                Auto-assign first driver who claims
              </span>
              <input
                type="checkbox"
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
                className="w-5 h-5 accent-lime-400 cursor-pointer"
              />
            </label>

            <Btn
              title="Release to Driver Marketplace"
              onClick={release}
              loading={busy}
              data-testid="release-job-button"
            />
          </Card>
        )}

        {/* Existing Jobs for this order */}
        {jobs.map((j) => (
          <Card key={j.id} data-testid={`job-${j.id}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm" style={{ color: colors.text || "#fff" }}>
                {j.job_type} Job
              </span>
              <Badge text={j.status} color={statusColor(j.status === "Open" ? "Pending" : "Approved")} />
            </div>
            <p className="text-xs" style={{ color: colors.textDim || "#888" }}>
              Payout ${j.payout} {j.driver_name ? `· Driver: ${j.driver_name}` : ""}
            </p>

            {/* Driver Requests */}
            {j.requests?.length > 0 && j.status !== "Assigned" && (
              <div className="mt-3 pt-2 border-t border-zinc-800">
                <p className="text-xs font-bold mb-2" style={{ color: colors.textDim || "#888" }}>
                  Driver requests
                </p>
                {j.requests.map((r: any) => (
                  <div key={r.driver_id} className="flex justify-between items-center py-1">
                    <span className="text-xs" style={{ color: colors.text || "#fff" }}>
                      {r.driver_name}
                    </span>
                    <button
                      type="button"
                      data-testid={`assign-${r.driver_id}`}
                      onClick={() => assign(j.id, r.driver_id)}
                      className="px-3 py-1 rounded text-xs font-bold active:scale-95 transition-transform"
                      style={{
                        backgroundColor: colors.apple || "#B0FF00",
                        color: colors.bg || "#000",
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Assignment Option */}
            {j.status === "Open" && j.requests?.length === 0 && drivers.length > 0 && (
              <div className="mt-3 pt-2 border-t border-zinc-800">
                <p className="text-xs font-bold mb-2" style={{ color: colors.textDim || "#888" }}>
                  Assign manually
                </p>
                {drivers.map((d) => (
                  <div key={d.id} className="flex justify-between items-center py-1">
                    <span className="text-xs" style={{ color: colors.text || "#fff" }}>
                      {d.name}
                    </span>
                    <button
                      type="button"
                      data-testid={`manual-assign-${d.id}`}
                      onClick={() => assign(j.id, d.id)}
                      className="px-3 py-1 rounded text-xs font-bold active:scale-95 transition-transform"
                      style={{
                        backgroundColor: colors.apple || "#B0FF00",
                        color: colors.bg || "#000",
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}

        {/* Update Laundry Status Chips */}
        <Card>
          <h2 className="font-bold text-sm mb-3" style={{ color: colors.text || "#fff" }}>
            Update Laundry Status
          </h2>
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`status-${s}`}
                onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95"
                style={{
                  backgroundColor:
                    order.status === s ? colors.gold || "#FFD700" : colors.surfaceAlt || "#1a1a1a",
                  borderColor:
                    order.status === s ? colors.gold || "#FFD700" : colors.border || "#333",
                  color: order.status === s ? colors.bg || "#000" : colors.text || "#fff",
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
