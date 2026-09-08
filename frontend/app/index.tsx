import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Welcome() {
  const { user, loading, isGuest, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  // Automatic redirect if already logged in or guest
  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === "ADMIN") navigate("/admin");
      else if (user.role === "DRIVER") navigate("/driver");
      else navigate("/student");
    } else if (isGuest) {
      navigate("/student");
    }
  }, [user, loading, isGuest, navigate]);

  // Loading spinner while checking auth session
  if (loading || user || isGuest) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.bg || "#0A0A0F" }}
        data-testid="splash-loading"
      >
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: `${colors.apple || "#B0FF00"} transparent transparent transparent` }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative flex flex-col justify-between p-6 pb-12 pt-10 max-w-md mx-auto overflow-hidden select-none"
      style={{
        background: "linear-gradient(180deg, #141018 0%, #0A0A0F 50%, #160A14 100%)",
      }}
      data-testid="welcome-screen"
    >
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto">
        {/* Logo with Green Neon Glow */}
        <div className="relative mb-6">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40"
            style={{ backgroundColor: colors.apple || "#B0FF00" }}
          />
          <img
            src="/assets/LOGO.png"
            alt="Sour Apple VIP Logo"
            className="relative w-64 h-64 sm:w-72 sm:h-72 object-contain drop-shadow-2xl transition-transform hover:scale-105 duration-300"
            data-testid="hero-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logo-hero.jpg";
            }}
          />
        </div>

        {/* Tagline Pill */}
        <div
          className="px-5 py-2 rounded-full border-2 bg-black shadow-lg mb-6"
          style={{ borderColor: colors.apple || "#B0FF00" }}
        >
          <p className="text-white font-extrabold text-xs tracking-wider uppercase">
            WE TAKE THE{" "}
            <span style={{ color: colors.apple || "#B0FF00" }}>STINK</span> OUT
            OF LAUNDRY
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap justify-center gap-2 max-w-xs">
          {["✓ WE PICK UP", "✓ WE WASH", "✓ WE FOLD", "✓ WE DELIVER"].map((badge) => (
            <span
              key={badge}
              className="text-xs font-extrabold px-3 py-1.5 rounded-md tracking-tight"
              style={{
                backgroundColor: colors.surfaceAlt || "#1a1a1a",
                color: colors.apple || "#B0FF00",
                border: "1px solid rgba(176, 255, 0, 0.2)",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 mt-8">
        {/* Schedule / Get Started Button */}
        <button
          type="button"
          data-testid="get-started-button"
          onClick={() => navigate("/register")}
          className="h-14 w-full rounded-xl font-black text-base tracking-wider uppercase transition-all duration-200 active:scale-95 shadow-lg flex items-center justify-center"
          style={{
            backgroundColor: colors.apple || "#B0FF00",
            color: "#0A0A0F",
            boxShadow: "0 0 20px rgba(176, 255, 0, 0.4)",
          }}
        >
          SCHEDULE IN THE APP →
        </button>

        {/* Login Button */}
        <button
          type="button"
          data-testid="login-link-button"
          onClick={() => navigate("/login")}
          className="h-13 w-full rounded-xl font-bold text-sm tracking-wide border-2 transition-all duration-200 active:scale-95 flex items-center justify-center"
          style={{
            borderColor: colors.pink || "#ff2a85",
            color: colors.pink || "#ff2a85",
            backgroundColor: "transparent",
          }}
        >
          I already have an account
        </button>

        {/* Guest Mode Link */}
        <button
          type="button"
          data-testid="guest-button"
          onClick={() => {
            continueAsGuest();
            navigate("/student");
          }}
          className="h-10 text-sm font-bold underline transition-opacity hover:opacity-80 flex items-center justify-center"
          style={{ color: colors.textDim || "#888" }}
        >
          Continue as guest →
        </button>
      </div>
    </div>
  );
}
