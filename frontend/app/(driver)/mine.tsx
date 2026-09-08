import React, { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { api } from "@/src/api/client";
import { colors, spacing, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

const ACTIONS = [
  "On the way",
  "Arrived",
  "Picked up",
  "Dropped off",
  "Out for delivery",
  "Delivered",
];

export default function MyJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/driver/jobs/mine");
      setJobs(data || []);
    } catch (e) {
      console.error("Failed to load jobs", e);
    } finally {
      setLoading(false);
    }
  };

  // Loads on page mount
  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, status: string) => {
    try {
      await api(`/driver/jobs/${id}/status`, {
        method: "POST",
        body: { status },
      });
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to update status");
    }
  };

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="driver-myjobs-screen"
    >
      {/* Header with Title & Refresh Icon */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <h1
          className="text-2xl font-extrabold"
          style={{ color: colors.text || "#fff" }}
        >
          My Jobs
        </h1>
        <button
          onClick={load}
          className="p-2 rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: colors.surface || "#111" }}
          title="Refresh jobs"
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
          No jobs yet. Claim one from Available.
        </p>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.map((j) => (
          <Card key={j.id} data-testid={`myjob-${j.order_code}`}>
            {/* Header: Order Code & Status Badge */}
            <div className="flex justify-between items-center mb-2">
              <span
                className="font-extrabold text-sm tracking-wide"
                style={{ color: colors.gold || "#FFD700" }}
              >
                {j.order_code}
              </span>
              <Badge
                text={j.status}
                color={statusColor(
                  j.status === "Completed" ? "Delivered" : "Approved"
                )}
              />
            </div>

            {/* Job Details */}
            <p className="text-xs mb-3" style={{ color: colors.textDim || "#888" }}>
              {j.job_type} · {j.campus} · {j.building} · ${j.payout}
            </p>

            {/* Requested State */}
            {j.status === "Requested" && (
              <p
                className="text-xs font-semibold mt-2"
                style={{ color: colors.warn || "#ffaa00" }}
              >
                Waiting for admin approval…
              </p>
            )}

            {/* In Progress Status Action Chips */}
            {(j.status === "Assigned" || j.status === "In Progress") && (
              <div className="flex flex-wrap gap-2 mt-4 pt-2 border-t border-zinc-800">
                {ACTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => update(j.id, a)}
                    data-testid={`action-${a}`}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 border"
                    style={{
                      backgroundColor: colors.surfaceAlt || "#1a1a1a",
                      borderColor: colors.apple || "#B0FF00",
                      color: colors.apple || "#B0FF00",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
