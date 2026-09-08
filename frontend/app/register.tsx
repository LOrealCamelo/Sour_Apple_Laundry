import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Home, Car, ChevronLeft } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { Btn, Field } from "@/src/components/UI";
import { colors, spacing } from "@/src/theme";

const ROLES = [
  { key: "STUDENT", label: "Student", icon: GraduationCap },
  { key: "NEIGHBOR", label: "Neighbor", icon: Home },
  { key: "DRIVER", label: "Driver", icon: Car },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState("STUDENT");
  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    campus: "",
    building: "",
    room: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const setField = (key: string) => (val: string) =>
    setF((prev) => ({ ...prev, [key]: val }));

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const u = await register({ ...f, email: f.email.trim(), role });
      if (u.role === "DRIVER") {
        navigate("/driver");
      } else {
        navigate("/student");
      }
    } catch (e: any) {
      setErr(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen p-4 pb-16 max-w-md mx-auto flex flex-col justify-center"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="register-screen"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="self-start p-2 -ml-2 mb-2 rounded-full transition-transform active:scale-90"
        title="Go back"
      >
        <ChevronLeft size={28} style={{ color: colors.text || "#fff" }} />
      </button>

      {/* Hero Logo */}
      <img
        src="/assets/LOGO.png"
        alt="Sour Apple VIP Logo"
        className="w-24 h-24 object-contain mx-auto mb-2 drop-shadow-md"
        onError={(e) => {
          // Fallback if path differs
          (e.target as HTMLImageElement).src = "/logo-hero.jpg";
        }}
      />

      {/* Title */}
      <h1
        className="text-3xl font-extrabold text-center mb-6"
        style={{ color: colors.text || "#fff" }}
      >
        Create account
      </h1>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {ROLES.map((r) => {
          const isSelected = role === r.key;
          const Icon = r.icon;

          return (
            <button
              type="button"
              key={r.key}
              data-testid={`role-${r.key.toLowerCase()}-button`}
              onClick={() => setRole(r.key)}
              className="flex flex-col items-center justify-center h-16 rounded-xl border transition-all duration-200 active:scale-95"
              style={{
                backgroundColor: isSelected
                  ? colors.apple || "#B0FF00"
                  : colors.surfaceAlt || "#1a1a1a",
                borderColor: isSelected
                  ? colors.apple || "#B0FF00"
                  : colors.border || "#333",
                color: isSelected
                  ? colors.bg || "#000"
                  : colors.textDim || "#888",
              }}
            >
              <Icon size={22} className="mb-1" />
              <span className="text-xs font-bold">{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Neighbor Explainer Banner */}
      {role === "NEIGHBOR" && (
        <p
          className="text-xs text-center mb-4 px-2"
          style={{ color: colors.textDim || "#888" }}
        >
          Neighborhood service is drop-off & self-pickup — no driver pickup/delivery.
        </p>
      )}

      {/* Registration Form */}
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="Full name"
          data-testid="reg-name-input"
          value={f.name}
          onChangeText={setField("name")}
          placeholder="Jamie Doe"
          required
        />

        <Field
          label="Email"
          data-testid="reg-email-input"
          value={f.email}
          type="email"
          onChangeText={setField("email")}
          placeholder="you@school.edu"
          required
        />

        <Field
          label="Password"
          data-testid="reg-password-input"
          value={f.password}
          type="password"
          onChangeText={setField("password")}
          placeholder="Create a password"
          required
        />

        <Field
          label="Phone"
          data-testid="reg-phone-input"
          value={f.phone}
          type="tel"
          onChangeText={setField("phone")}
          placeholder="555-0100"
        />

        {/* Dynamic Campus / Address Fields */}
        {role !== "DRIVER" && (
          <>
            <Field
              label={role === "NEIGHBOR" ? "Neighborhood" : "Campus"}
              data-testid="reg-campus-input"
              value={f.campus}
              onChangeText={setField("campus")}
              placeholder={role === "NEIGHBOR" ? "Maple Grove" : "MVCC"}
            />
            <Field
              label={role === "NEIGHBOR" ? "Street address" : "Dorm / Building"}
              data-testid="reg-building-input"
              value={f.building}
              onChangeText={setField("building")}
              placeholder={role === "NEIGHBOR" ? "123 Main St" : "West Hall"}
            />
            <Field
              label={role === "NEIGHBOR" ? "Apt / Unit (optional)" : "Room / Apt #"}
              data-testid="reg-room-input"
              value={f.room}
              onChangeText={setField("room")}
              placeholder={role === "NEIGHBOR" ? "Unit B" : "204"}
            />
          </>
        )}

        {/* Error Alert */}
        {Boolean(err) && (
          <div
            className="text-sm font-semibold p-2.5 rounded-lg text-center"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: colors.danger || "#ef4444",
            }}
            data-testid="register-error"
          >
            {err}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <Btn
            title="Create Account"
            type="submit"
            loading={loading}
            data-testid="register-submit-button"
          />
        </div>
      </form>

      {/* Login Link */}
      <div className="mt-5 text-center">
        <span className="text-sm" style={{ color: colors.textDim || "#888" }}>
          Have an account?{" "}
          <Link
            to="/login"
            className="font-bold underline ml-1 hover:opacity-80 transition-opacity"
            style={{ color: colors.apple || "#B0FF00" }}
          >
            Log in
          </Link>
        </span>
      </div>
    </div>
  );
}
