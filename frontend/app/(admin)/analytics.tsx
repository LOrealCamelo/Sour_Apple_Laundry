import React, { useEffect, useState } from "react";
import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";
import { Card } from "@/src/components/UI";
import { ArchiveBox, DollarSign, User, Users, Clock, Briefcase, Check, Flag } from "lucide-react";

export default function Analytics() {
  const [a, setA] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    try {
      setA(await api("/admin/analytics"));
    } catch (e) {
      console.error("Failed to load analytics", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = a
    ? [
        { label: "Total Orders", value: a.total_orders, icon: ArchiveBox, color: colors.info },
        { label: "Revenue Est.", value: `$${a.revenue_estimate}`, icon: DollarSign, color: colors.apple },
        { label: "Active Students", value: a.active_students, icon: User, color: colors.gold },
        { label: "Active Drivers", value: a.active_drivers, icon: Users, color: colors.info },
        { label: "Pending Requests", value: a.pending_requests, icon: Clock, color: colors.warn },
        { label: "Open Driver Jobs", value: a.open_driver_jobs, icon: Briefcase, color: colors.apple },
        { label: "Completed Pickups", value: a.completed_pickups, icon: Check, color: colors.info },
        { label: "Completed Deliveries", value: a.completed_deliveries, icon: Flag, color: colors.apple },
      ]
    : [];

  return (
    <div data-testid="analytics-screen">
      <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, padding: spacing.lg, paddingBottom: spacing.md }}>Analytics</h1>
      <div style={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
          {stats.map((s) => (
            <div key={s.label} style={{ width: "47.5%" }} data-testid={`stat-${s.label}`}>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <s.icon size={22} color={s.color} />
                  <div>
                    <div style={{ color: colors.text, fontSize: 24, fontWeight: 800, marginTop: 8 }}>{s.value}</div>
                    <div style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))}

          {a && (
            <Card>
              <div>
                <div style={{ color: colors.textDim, fontSize: 13, marginBottom: 6 }}>Most requested service</div>
                <div style={{ color: colors.apple, fontSize: 20, fontWeight: 800 }}>{a.most_requested_service}</div>
              </div>
            </Card>
          )}

          {a && (
            <Card>
              <div>
                <div style={{ color: colors.textDim, fontSize: 13, marginBottom: 6 }}>Orders by campus</div>
                {Object.entries(a.orders_by_campus).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: 6 }}>
                    <div style={{ color: colors.text }}>{k}</div>
                    <div style={{ color: colors.gold, fontWeight: 700 }}>{v as number}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
