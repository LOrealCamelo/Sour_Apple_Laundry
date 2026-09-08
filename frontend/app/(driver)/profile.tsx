import React from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme";
import { Card, Btn, Badge } from "@/src/components/UI";

export default function DriverProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen p-4 pb-24 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="driver-profile-screen"
    >
      {/* Avatar */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 font-extrabold text-3xl shadow-lg"
        style={{
          backgroundColor: colors.apple || "#B0FF00",
          color: colors.bg || "#000",
        }}
      >
        {user?.name?.[0]?.toUpperCase() || "D"}
      </div>

      {/* User Info */}
      <h1
        className="text-2xl font-extrabold text-center"
        style={{ color: colors.text || "#fff" }}
      >
        {user?.name || "Driver"}
      </h1>
      <p
        className="text-center text-sm mt-1"
        style={{ color: colors.textDim || "#888" }}
      >
        {user?.email}
      </p>

      {/* Badge */}
      <div className="flex justify-center mt-2 mb-6">
        <Badge text="Approved Driver" color={colors.apple || "#B0FF00"} />
      </div>

      {/* Earnings Card */}
      <Card className="mb-4">
        <h2 className="font-bold text-base mb-1" style={{ color: colors.text || "#fff" }}>
          Earnings
        </h2>
        <div
          className="text-3xl font-extrabold mb-1"
          style={{ color: colors.apple || "#B0FF00" }}
        >
          $0.00
        </div>
        <p className="text-xs leading-relaxed" style={{ color: colors.textDim || "#888" }}>
          Payout tracking placeholder — connects to Stripe payouts later.
        </p>
      </Card>

      {/* Onboarding Documents Card */}
      <Card className="mb-6">
        <h2 className="font-bold text-base mb-3" style={{ color: colors.text || "#fff" }}>
          Onboarding Documents
        </h2>
        <Doc label="Driver's license" />
        <Doc label="Insurance" />
        <Doc label="W-9" />
        <Doc label="Background check consent" />
        <p className="text-xs leading-relaxed mt-3" style={{ color: colors.textDim || "#888" }}>
          Document upload & verification are placeholders.
        </p>
      </Card>

      {/* Log Out Button */}
      <Btn
        title="Log Out"
        variant="ghost"
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
        data-testid="driver-logout-button"
      />
    </div>
  );
}

function Doc({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 py-2 border-b last:border-0"
      style={{ borderColor: colors.border || "#222" }}
    >
      <FileText size={18} style={{ color: colors.textDim || "#888" }} />
      <span className="flex-1 text-sm" style={{ color: colors.text || "#fff" }}>
        {label}
      </span>
      {/* Warning Status Dot */}
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: colors.warn || "#ffaa00" }}
      />
    </div>
  );
}
