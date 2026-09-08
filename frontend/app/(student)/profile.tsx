import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Edit3, X } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";
import { Card, Btn, Field } from "@/src/components/UI";

export default function StudentProfile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    campus: user?.campus || "",
    building: user?.building || "",
    room: user?.room || "",
  });
  const [saving, setSaving] = useState(false);

  const setField = (key: string) => (val: string) =>
    setF((prev) => ({ ...prev, [key]: val }));

  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api("/auth/me", { method: "PUT", body: f });
      if (refreshUser) await refreshUser();
      setEdit(false);
    } catch (e: any) {
      alert(e.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const referral = "SOUR-" + (user?.id?.slice(0, 5).toUpperCase() || "VIP");

  return (
    <div
      className="min-h-screen p-4 pb-28 max-w-md mx-auto"
      style={{ backgroundColor: colors.bg || "#0A0A0F" }}
      data-testid="profile-screen"
    >
      {/* Avatar Circle */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 font-extrabold text-3xl shadow-lg"
        style={{
          backgroundColor: colors.apple || "#B0FF00",
          color: colors.bg || "#0A0A0F",
          boxShadow: "0 0 20px rgba(176, 255, 0, 0.3)",
        }}
      >
        {user?.name?.[0]?.toUpperCase() || "U"}
      </div>

      {/* User Name & Email */}
      <h1
        className="text-2xl font-extrabold text-center tracking-tight"
        style={{ color: colors.text || "#FFFFFF" }}
      >
        {user?.name || "Student"}
      </h1>
      <p
        className="text-center text-sm mt-0.5 mb-6 font-medium"
        style={{ color: colors.textDim || "#888899" }}
      >
        {user?.email}
      </p>

      {/* Referral Code Card */}
      <Card className="mb-4 border" style={{ borderColor: colors.border || "#22222A" }}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textDim || "#888899" }}>
              Your referral code
            </p>
            <h2
              className="text-2xl font-black mt-0.5 tracking-wider"
              style={{ color: colors.gold || "#FFD700" }}
              data-testid="referral-code"
            >
              {referral}
            </h2>
          </div>
          <Gift size={32} style={{ color: colors.gold || "#FFD700" }} />
        </div>
        <p className="text-xs leading-relaxed mt-2" style={{ color: colors.textDim || "#888899" }}>
          Share with friends — you both get a discount on laundry.
        </p>
      </Card>

      {/* Profile Details (Edit Mode vs View Mode) */}
      {edit ? (
        <Card className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold" style={{ color: colors.text || "#FFFFFF" }}>
              Edit Profile
            </h3>
            <button
              type="button"
              onClick={() => setEdit(false)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={save} className="space-y-3">
            <Field
              label="Name"
              value={f.name}
              onChangeText={setField("name")}
              data-testid="edit-name"
              required
            />
            <Field
              label="Phone"
              value={f.phone}
              onChangeText={setField("phone")}
              data-testid="edit-phone"
            />
            <Field
              label="Campus"
              value={f.campus}
              onChangeText={setField("campus")}
              data-testid="edit-campus"
            />
            <Field
              label="Building"
              value={f.building}
              onChangeText={setField("building")}
              data-testid="edit-building"
            />
            <Field
              label="Room / Apt #"
              value={f.room}
              onChangeText={setField("room")}
              data-testid="edit-room"
            />
            <div className="pt-2">
              <Btn
                title="Save Profile"
                type="submit"
                loading={saving}
                data-testid="save-profile-button"
              />
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mb-6">
          <Info label="Phone" value={user?.phone} />
          <Info label="Campus" value={user?.campus} />
          <Info label="Building" value={user?.building} />
          <Info label="Room / Apt" value={user?.room} />

          <button
            type="button"
            data-testid="edit-profile-button"
            onClick={() => setEdit(true)}
            className="flex items-center gap-2 mt-4 pt-2 font-bold text-xs transition-opacity hover:opacity-80 active:scale-95"
            style={{ color: colors.apple || "#B0FF00" }}
          >
            <Edit3 size={15} />
            <span>Edit profile</span>
          </button>
        </Card>
      )}

      {/* Log Out Button */}
      <Btn
        title="Log Out"
        variant="ghost"
        onClick={async () => {
          await logout();
          navigate("/");
        }}
        data-testid="logout-button"
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div
      className="flex justify-between items-center py-2.5 border-b last:border-0"
      style={{ borderColor: colors.border || "#22222A" }}
    >
      <span className="text-xs" style={{ color: colors.textDim || "#888899" }}>
        {label}
      </span>
      <span className="text-xs font-semibold" style={{ color: colors.text || "#FFFFFF" }}>
        {value || "—"}
      </span>
    </div>
  );
}
