import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Calendar, CreditCard,
  Settings, LogOut, FileText, Mail
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/clients", label: "Clients", icon: Users, testId: "nav-clients" },
  { to: "/calendar", label: "Calendar", icon: Calendar, testId: "nav-calendar" },
  { to: "/payments", label: "Payments", icon: CreditCard, testId: "nav-payments" },
  { to: "/reports", label: "Reports", icon: FileText, testId: "nav-reports", roles: ["ADMIN"] },
  { to: "/messages", label: "Messages", icon: Mail, testId: "nav-messages", roles: ["ADMIN", "CASE_WORKER"] },
  { to: "/settings", label: "Settings", icon: Settings, testId: "nav-settings", roles: ["ADMIN"] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="w-56 h-screen bg-white border-r border-[#E8E8E8] flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-5 border-b border-[#F3F4F6]">
        <h1 className="text-xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">
          Hack<span className="text-[#F97316]">Forge</span>
        </h1>
        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold mt-0.5">Case Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[#FFF7ED] to-[#FFEDD5] text-[#F97316] font-bold shadow-sm"
                    : "text-[#6B7280] hover:bg-[#FAFAF8] hover:text-[#1F2937]"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[#F3F4F6]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#1F2937] truncate">{user?.name}</p>
            <p className="text-[10px] text-[#9CA3AF] truncate">{user?.role?.replace("_", " ")}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] h-8 text-xs gap-2 rounded-lg" data-testid="logout-btn">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
