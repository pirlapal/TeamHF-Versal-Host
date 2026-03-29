import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, CalendarDays, Settings, CreditCard,
  LogOut, X, Hexagon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["ADMIN", "CASE_WORKER"] },
  { to: "/clients", icon: Users, label: "Clients", roles: ["ADMIN", "CASE_WORKER", "VOLUNTEER"] },
  { to: "/calendar", icon: CalendarDays, label: "Calendar", roles: ["ADMIN", "CASE_WORKER"] },
  { to: "/payments", icon: CreditCard, label: "Payments", roles: ["ADMIN", "CASE_WORKER"] },
  { to: "/admin", icon: Settings, label: "Admin Settings", roles: ["ADMIN"] },
];

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "CASE_WORKER";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="h-full bg-[#0A0A0B] border-r border-[#2A2A2D] flex flex-col" data-testid="sidebar">
      {/* Brand */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[#2A2A2D] shrink-0">
        <Hexagon className="h-6 w-6 text-[#0055FF]" />
        <span className="text-lg font-semibold font-['Outfit'] tracking-tight text-[#F9F9FB]">CaseFlow</span>
        <Button variant="ghost" size="icon" className="ml-auto md:hidden text-[#6E6E73]" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                `sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm transition-all ${
                  isActive
                    ? "sidebar-active text-[#F9F9FB] font-medium"
                    : "text-[#A0A0A5] hover:text-[#F9F9FB] border-l-3 border-transparent"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
      </nav>

      <Separator className="bg-[#2A2A2D]" />

      {/* User info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[#141415] border border-[#2A2A2D] flex items-center justify-center text-xs font-medium text-[#0055FF]">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#F9F9FB] truncate">{user?.name || "User"}</p>
            <p className="text-xs text-[#6E6E73] truncate">{role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-[#A0A0A5] hover:text-[#FF1744] hover:bg-[#FF1744]/10 gap-2"
          data-testid="logout-btn"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
