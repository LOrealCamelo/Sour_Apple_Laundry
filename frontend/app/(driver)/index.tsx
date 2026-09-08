import React, { useEffect, useState } from "react";
import { MapPin, Clock, RotateCw } from "lucide-react";
import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";

export default function AvailableJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/driver/jobs/open");
      setJobs(data || []);
    } catch (e) {
      console.error("Failed to load open jobs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (id: string) => {
    setBusy(id);
    try {
      await api(`/driver/jobs/${id}/claim`, { method: "POST" });
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to claim job");
    } finally {
      setBusy("");
    }
  };

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="driver-available-screen"
    >
      {/* Header with Title & Refresh Icon */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <h1
          className="text-2xl font-extrabold"
          style={{ color: colors.text || "#fff" }}
        >
          Available Jobs
        </h1>
        <button
          onClick={load}
          className="p-2 rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: colors.surface || "#111" }}
          title="Refresh available jobs"
        >
          <RotateCw
            size={18}
            className={loading ? "animate-spin" : ""}
            style={{ color: colors.apple || "#B0FF00" }}
          />
        </button>
      </div>

      {/* Empty State */}
      {jobs.length === 0 && !loading && (
        <p
          className="text-sm text-center py-12"
          style={{ color: colors.textDim || "#888" }}
        >
          No open jobs right now. Tap refresh to check again.
        </p>
      )}

      {/* Available Jobs List */}
      <div className="space-y-4">
        {jobs.map((j) => (
          <Card key={j.id} data-testid={`job-card-${j.order_code}`}>
            {/* Order Code & Job Type Badge */}
            <div className="flex justify-between items-center mb-2">
              <span
                className="font-extrabold text-sm tracking-wide"
                style={{ color: colors.gold || "#FFD700" }}
              >
                {j.order_code}
              </span>
              <Badge text={j.job_type} color={colors.info || "#00b4d8"} />
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin size={15} style={{ color: colors.textDim || "#888" }} />
              <span className="text-xs" style={{ color: colors.textDim || "#888" }}>
                {j.campus} · {j.building}
              </span>
            </div>

            {/* Time Window */}
            <div className="flex items-center gap-2 mb-2">
              <Clock size={15} style={{ color: colors.textDim || "#888" }} />
              <span className="text-xs" style={{ color: colors.textDim || "#888" }}>
                Pickup {j.pickup_window} · Delivery {j.delivery_window}
              </span>
            </div>

            {/* Special Instructions Note */}
            {Boolean(j.special_instructions) && (
              <p
                className="text-xs mb-3 italic"
                style={{ color: colors.textDim || "#888" }}
              >
                Note: {j.special_instructions}
              </p>
            )}

            {/* Payout & Distance Row */}
            <div className="flex justify-between items-center my-3 pt-2 border-t border-zinc-800">
              <span
                className="text-lg font-extrabold"
                style={{ color: colors.apple || "#B0FF00" }}
              >
                ${j.payout} payout
              </span>
              <span className="text-xs" style={{ color: colors.textDim || "#888" }}>
                ~1.2 mi
              </span>
            </div>

            {/* Claim/Request Button */}
            <Btn
              title={j.auto_assign_first_claim ? "Claim Job" : "Request Job"}
              onClick={() => claim(j.id)}
              loading={busy === j.id}
              data-testid={`claim-${j.order_code}`}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
