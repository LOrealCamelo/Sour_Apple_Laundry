import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Briefcase, Car, User } from "lucide-react";
import { colors } from "@/src/theme";

export default function DriverLayout() {
  const location = useLocation();

  const tabs = [
    { name: "Available", path: "/driver", icon: Briefcase },
    { name: "My Jobs", path: "/driver/mine", icon: Car },
    { name: "Profile", path: "/driver/profile", icon: User },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: colors.background || "#000" }}>
      {/* Active Screen Content */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex justify-around items-center border-t z-50"
        style={{
          backgroundColor: colors.surface || "#111",
          borderColor: colors.border || "#222",
          height: 70,
        }}
      >
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors"
              style={{
                color: isActive ? colors.apple || "#B0FF00" : colors.textDim || "#888",
              }}
            >
              <Icon size={22} className="mb-1" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
