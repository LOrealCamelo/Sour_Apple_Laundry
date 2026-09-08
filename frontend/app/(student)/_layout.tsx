import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, PlusCircle, ClipboardList, User } from "lucide-react";
import { colors } from "@/src/theme";

export default function StudentLayout() {
  const tabs = [
    { name: "Home", path: "/student", icon: Home, exact: true },
    { name: "Schedule", path: "/student/schedule", icon: PlusCircle, exact: false },
    { name: "Orders", path: "/student/orders", icon: ClipboardList, exact: false },
    { name: "Profile", path: "/student/profile", icon: User, exact: false },
  ];

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: colors.bg || "#0A0A0F" }}
    >
      {/* Active Screen Content Container */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Fixed VIP Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex justify-around items-center border-t z-50 select-none"
        style={{
          backgroundColor: colors.surface || "#141018",
          borderColor: colors.border || "#22222A",
          height: 72,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.exact}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 active:scale-90 ${
                  isActive ? "font-extrabold" : "font-medium"
                }`
              }
              style={({ isActive }) => ({
                color: isActive
                  ? colors.apple || "#B0FF00"
                  : colors.textDim || "#777788",
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    className="mb-1 transition-transform"
                    style={{
                      strokeWidth: isActive ? 2.5 : 2,
                      filter: isActive
                        ? `drop-shadow(0 0 8px ${colors.apple || "#B0FF00"}66)`
                        : "none",
                    }}
                  />
                  <span className="text-[11px] tracking-tight">{tab.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
