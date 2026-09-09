import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Screens
import Welcome from "../app/index";
import Login from "../app/login";
import Register from "../app/register";
import Schedule from "../app/(student)/schedule";
import Orders from "../app/(student)/orders";
import Profile from "../app/(student)/profile";
import OrderTracking from "../app/order/[id]";
import AdminRequests from "../app/(admin)/index";
import AdminOrderDetail from "../app/admin-order/[id]";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Welcome & Auth */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer Booking & Orders */}
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:id" element={<OrderTracking />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminRequests />} />
          <Route path="/admin-order/:id" element={<AdminOrderDetail />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
