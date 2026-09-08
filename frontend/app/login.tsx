import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/src/context/AuthContext";
import { Btn, Field } from "@/src/components/UI";
import { colors, spacing } from "@/src/theme";

export default function Login() {
  const { login, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const u = await login(email.trim(), password);
      if (u.role === "ADMIN") {
        navigate("/admin");
      } else if (u.role === "DRIVER") {
        navigate("/driver");
      } else {
        navigate("/student");
      }
    } catch (e: any) {
      setErr(e.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen p-4 pb-16 max-w-md mx-auto flex flex-col justify-center"
      style={{ backgroundColor: colors.bg || "#000" }}
      data-testid="login-screen"
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
        className="w-28 h-28 object-contain mx-auto mb-2 drop-shadow-md"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/logo-hero.jpg";
        }}
      />

      {/* Title & Subtitle */}
      <h1
        className="text-3xl font-extrabold text-center mb-1"
        style={{ color: colors.text || "#fff" }}
      >
        Welcome back
      </h1>
      <p
        className="text-sm text-center mb-6"
        style={{ color: colors.textDim || "#888" }}
      >
        Log in to your Sour Apple VIP account
      </p>

      {/* Login Form */}
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Email"
          data-testid="login-email-input"
          value={email}
          type="email"
          onChangeText={setEmail}
          placeholder="you@school.edu"
          required
        />

        <Field
          label="Password"
          data-testid="login-password-input"
          value={password}
          type="password"
          onChangeText={setPassword}
          placeholder="••••••••"
          required
        />

        {/* Error Alert */}
        {Boolean(err) && (
          <div
            className="text-sm font-semibold p-2.5 rounded-lg text-center"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: colors.danger || "#ef4444",
            }}
            data-testid="login-error"
          >
            {err}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <Btn
            title="Log In"
            type="submit"
            loading={loading}
            data-testid="login-submit-button"
          />
        </div>
      </form>

      {/* Create Account Link */}
      <div className="mt-5 text-center">
        <span className="text-sm" style={{ color: colors.textDim || "#888" }}>
          New here?{" "}
          <Link
            to="/register"
            className="font-bold underline ml-1 hover:opacity-80 transition-opacity"
            style={{ color: colors.apple || "#B0FF00" }}
          >
            Create account
          </Link>
        </span>
      </div>

      {/* Guest Mode Link */}
      <div className="mt-3 text-center">
        <button
          type="button"
          data-testid="login-guest-button"
          onClick={() => {
            continueAsGuest();
            navigate("/student");
          }}
          className="text-sm font-bold underline transition-opacity hover:opacity-80"
          style={{ color: colors.pink || "#ff2a85" }}
        >
          Continue as guest →
        </button>
      </div>

      {/* Demo Credentials Box */}
      <div
        className="mt-8 p-3 rounded-xl border text-center text-xs leading-relaxed"
        style={{
          backgroundColor: colors.surfaceAlt || "#111",
          borderColor: colors.border || "#222",
          color: colors.textDim || "#777",
        }}
      >
        <span className="font-bold text-zinc-400">Demo Accounts:</span>
        <br />
        Admin: <code className="text-zinc-300">natture1st@gmail.com</code> /{" "}
        <code className="text-zinc-300">Admin123!</code>
        <br />
        Student: <code className="text-zinc-300">student@sourapple.com</code> /{" "}
        <code className="text-zinc-300">Student123!</code>
        <br />
        Driver: <code className="text-zinc-300">driver@sourapple.com</code> /{" "}
        <code className="text-zinc-300">Driver123!</code>
      </div>
    </div>
  );
}
