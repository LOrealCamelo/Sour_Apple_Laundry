import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightCircle, RotateCw } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await api("/orders/my");
      setOrders(data || []);
    } catch (e) {
      console.error("Failed to load student orders", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filter out delivered or rejected orders to only show active ones
  const active = orders.filter(
    (o) => !["Delivered", "Rejected", "Cancelled"].includes(o.status)
  );

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#0A0A0F" }}
      data-testid="student-home"
    >
      {/* Brand Bar with Logo */}
      <div className="flex justify-between items-center mb-4 pt-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/LOGO.png"
            alt="Sour Apple Logo"
            className="w-12 h-12 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logo-hero.jpg";
            }}
          />
          <span
            className="font-black text-lg tracking-wider"
            style={{ color: colors.text || "#FFFFFF" }}
          >
            SOUR APPLE <span style={{ color: colors.pink || "#ff2a85" }}>VIP</span>
          </span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={load}
          className="p-2 rounded-full transition-transform active:scale-90"
          style={{ backgroundColor: colors.surface || "#141018" }}
          title="Refresh orders"
        >
          <RotateCw
            size={18}
            className={refreshing ? "animate-spin" : ""}
            style={{ color: colors.apple || "#B0FF00" }}
          />
        </button>
      </div>

      {/* Greeting & Campus Location */}
      <h1
        className="text-3xl font-extrabold tracking-tight"
        style={{ color: colors.text || "#FFFFFF" }}
      >
        Hi, {user?.name?.split(" ")[0] || "there"} 👋
      </h1>
      <p
        className="text-sm mt-1 mb-6 font-medium"
        style={{ color: colors.textDim || "#888899" }}
      >
        {user?.campus || "Your campus"}
        {user?.building ? ` · ${user.building}` : ""}
      </p>

      {/* Main Lime Green CTA Banner */}
      <div
        onClick={() => navigate("/student/schedule")}
        data-testid="schedule-cta"
        className="p-5 rounded-2xl flex items-center justify-between cursor-pointer mb-8 transition-transform active:scale-95 shadow-lg select-none"
        style={{
          backgroundColor: colors.apple || "#B0FF00",
          boxShadow: "0 4px 25px rgba(176, 255, 0, 0.3)",
        }}
      >
        <div className="flex-1 pr-2">
          <h2
            className="text-xl font-black leading-tight"
            style={{ color: colors.bg || "#0A0A0F" }}
          >
            Schedule a pickup
          </h2>
          <p
            className="text-xs font-bold mt-1 opacity-90"
            style={{ color: colors.bg || "#0A0A0F" }}
          >
            Wash & Fold, Dry Cleaning & more
          </p>
        </div>

        <ArrowRightCircle
          size={42}
          className="transition-transform group-hover:translate-x-1"
          style={{ color: colors.bg || "#0A0A0F" }}
        />
      </div>

      {/* Active Orders Section */}
      <h2
        className="text-lg font-extrabold mb-3 tracking-tight"
        style={{ color: colors.text || "#FFFFFF" }}
      >
        Active orders
      </h2>

      {/* Empty State */}
      {active.length === 0 && !refreshing && (
        <div
          className="p-8 rounded-2xl border text-center border-dashed"
          style={{
            borderColor: colors.border || "#22222A",
            backgroundColor: colors.surface || "#141018",
          }}
        >
          <p className="text-sm" style={{ color: colors.textDim || "#888899" }}>
            No active orders right now.
          </p>
          <button
            onClick={() => navigate("/student/schedule")}
            className="mt-3 text-xs font-bold underline"
            style={{ color: colors.apple || "#B0FF00" }}
          >
            Schedule your first pickup →
          </button>
        </div>
      )}

      {/* Active Orders List */}
      <div className="space-y-4">
        {active.map((o) => (
          <div
            key={o.id}
            data-testid={`order-card-${o.code}`}
            onClick={() => navigate(`/order/${o.id}`)}
            className="cursor-pointer transition-transform active:scale-[0.98]"
          >
            <Card className="hover:border-zinc-700 transition-colors">
              {/* Order Code & Status Badge */}
              <div className="flex justify-between items-center mb-2">
                <span
                  className="font-extrabold text-sm tracking-wider"
                  style={{ color: colors.gold || "#FFD700" }}
                >
                  {o.code}
                </span>
                <Badge text={o.status} color={statusColor(o.status)} />
              </div>

              {/* Service Type & Bag Count */}
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: colors.text || "#FFFFFF" }}
              >
                {o.service_type} · {o.bags} bag(s)
              </p>

              {/* Scheduled Pickup Time */}
              <p
                className="text-xs mb-3"
                style={{ color: colors.textDim || "#888899" }}
              >
                Pickup {o.pickup_date} · {o.pickup_window}
              </p>

              {/* Price */}
              <span
                className="text-lg font-extrabold tracking-tight"
                style={{ color: colors.apple || "#B0FF00" }}
              >
                ${Number(o.price || 0).toFixed(2)}
              </span>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
