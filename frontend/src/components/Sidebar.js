import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Calendar, CreditCard,
  Settings, LogOut, FileText, Mail
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", vocabKey: "dashboard", i18nKey: "nav.dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/clients", vocabKey: "clients", i18nKey: "nav.clients", icon: Users, testId: "nav-clients", permission: "clients.read" },
  { to: "/calendar", vocabKey: "calendar", i18nKey: "nav.calendar", icon: Calendar, testId: "nav-calendar", permission: "visits.read" },
  { to: "/payments", vocabKey: "payments", i18nKey: "nav.payments", icon: CreditCard, testId: "nav-payments", permission: "payments.read" },
  { to: "/reports", vocabKey: "reports", i18nKey: "nav.reports", icon: FileText, testId: "nav-reports", permission: "reports.read" },
  { to: "/messages", vocabKey: "messages", i18nKey: "nav.messages", icon: Mail, testId: "nav-messages", permission: "messages.read" },
  { to: "/settings", vocabKey: "settings", i18nKey: "nav.settings", icon: Settings, testId: "nav-settings", permission: "admin.settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { v } = useTenant();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Debug logging
  React.useEffect(() => {
    if (user) {
      console.log('[Sidebar] User loaded:', {
        email: user.email,
        role: user.role,
        hasPermissions: !!user.permissions,
        permissionCount: user.permissions?.length,
        permissions: user.permissions
      });
    }
  }, [user]);

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
        {NAV_ITEMS.filter(item => {
          // Dashboard is always visible
          if (!item.permission) return true;
          // Check if user has the required permission
          return user?.permissions?.includes(item.permission);
        }).map((item) => {
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
              {t(item.i18nKey) || v(item.vocabKey)}
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
          <LogOut className="h-3.5 w-3.5" /> {t("nav.signOut")}
        </Button>
      </div>
    </div>
  );
}
