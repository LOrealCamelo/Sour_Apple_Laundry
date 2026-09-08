import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

// Screens
import Welcome from "./app/index";
import Login from "./app/login";
import Register from "./app/register";

// Driver Screens & Layout
import DriverLayout from "./app/(driver)/_layout";
import AvailableJobs from "./app/(driver)/index";
import MyJobs from "./app/(driver)/mine";
import DriverProfile from "./app/(driver)/profile";

export default function App() {
  return (
    <div
      className="min-h-screen font-sans antialiased select-none"
      style={{
        backgroundColor: colors.bg || "#0A0A0F",
        color: colors.text || "#FFFFFF",
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Driver Portal Routes */}
            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<AvailableJobs />} />
              <Route path="mine" element={<MyJobs />} />
              <Route path="profile" element={<DriverProfile />} />
            </Route>

            {/* Fallback to Welcome */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
