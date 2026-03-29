import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, CalendarDays, Settings, CreditCard,
  LogOut, X, Heart
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
    <div className="h-full bg-white border-r border-[#E8E8E8] flex flex-col" data-testid="sidebar">
      {/* Brand */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[#E8E8E8] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center">
          <Heart className="h-4 w-4 text-white fill-white" />
        </div>
        <span className="text-lg font-bold font-['Nunito'] tracking-tight text-[#1F2937]">CaseFlow</span>
        <Button variant="ghost" size="icon" className="ml-auto md:hidden text-[#9CA3AF]" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                `sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
                  isActive
                    ? "sidebar-active text-[#1F2937]"
                    : "text-[#6B7280] hover:text-[#1F2937] border-l-3 border-transparent"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
      </nav>

      <Separator className="bg-[#E8E8E8]" />

      {/* User info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#2DD4BF] flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1F2937] truncate">{user?.name || "User"}</p>
            <p className="text-xs text-[#9CA3AF] truncate">{role?.replace("_", " ")}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/5 gap-2 rounded-lg"
          data-testid="logout-btn"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
