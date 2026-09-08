import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCw, ChevronRight } from "lucide-react";
import { api } from "@/src/api/client";
import { colors, statusColor } from "@/src/theme";
import { Card, Badge } from "@/src/components/UI";

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await api("/orders/my");
      setOrders(data || []);
    } catch (e) {
      console.error("Failed to load order history", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div
      className="min-h-screen p-4 pb-28 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#0A0A0F" }}
      data-testid="orders-screen"
    >
      {/* Header with Title & Refresh Icon */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ color: colors.text || "#FFFFFF" }}
        >
          My Orders
        </h1>
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

      {/* Empty State */}
      {orders.length === 0 && !refreshing && (
        <div
          className="p-8 rounded-2xl border text-center border-dashed my-12"
          style={{
            borderColor: colors.border || "#22222A",
            backgroundColor: colors.surface || "#141018",
          }}
        >
          <p className="text-sm" style={{ color: colors.textDim || "#888899" }}>
            No orders yet.
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

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((o) => (
          <div
            key={o.id}
            data-testid={`history-order-${o.code}`}
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

              {/* Service Details & Price */}
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: colors.text || "#FFFFFF" }}
              >
                {o.service_type} · {o.bags} bag(s) ·{" "}
                <span style={{ color: colors.apple || "#B0FF00" }}>
                  ${Number(o.price || 0).toFixed(2)}
                </span>
              </p>

              {/* Pickup Schedule Window */}
              <p
                className="text-xs"
                style={{ color: colors.textDim || "#888899" }}
              >
                Pickup {o.pickup_date} · {o.pickup_window}
              </p>

              {/* Rating Prompt if Delivered & Unrated */}
              {o.status === "Delivered" && o.rating == null && (
                <div
                  className="flex items-center gap-1 mt-3 pt-2 border-t border-zinc-800 text-xs font-bold"
                  style={{ color: colors.apple || "#B0FF00" }}
                >
                  <span>Tap to rate this order</span>
                  <ChevronRight size={14} />
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
