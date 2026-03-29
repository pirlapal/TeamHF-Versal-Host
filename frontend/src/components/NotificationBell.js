import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";
import { Bell, Check } from "lucide-react";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const [{ data: notifs }, { data: countData }] = await Promise.all([
        api.get("/notifications?limit=10"),
        api.get("/notifications/unread-count"),
      ]);
      setNotifications(notifs);
      setUnreadCount(countData.count);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const TYPE_COLORS = {
    visit_scheduled: "#6366F1", visit_reminder: "#F59E0B", client_created: "#14B8A6",
    client_onboarded: "#14B8A6", payment_received: "#10B981", payment_overdue: "#EF4444",
    new_message: "#F97316", message_reply: "#F97316",
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-[#FFF7ED] transition-colors" data-testid="notification-bell">
        <Bell className="h-5 w-5 text-[#6B7280]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-[#F97316] text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] px-1" data-testid="notification-count">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white border border-[#E8E8E8] rounded-xl shadow-xl z-50 overflow-hidden" data-testid="notification-dropdown">
          <div className="flex items-center justify-between p-3 border-b border-[#F3F4F6]">
            <span className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-[#F97316] hover:underline" data-testid="mark-all-read">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-[#F9FAFB]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9CA3AF]">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-3 flex items-start gap-3 hover:bg-[#FAFAF8] transition-colors ${!n.is_read ? "bg-[#FFFBEB]/30" : ""}`} data-testid={`notification-item-${n.id}`}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: n.is_read ? "#E5E7EB" : (TYPE_COLORS[n.type] || "#F97316") }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1F2937] truncate">{n.title}</p>
                    <p className="text-[10px] text-[#9CA3AF] truncate">{n.message}</p>
                    <span className="text-[9px] text-[#D1D5DB] font-mono">{n.created_at?.split("T")[0]}</span>
                  </div>
                  {!n.is_read && (
                    <button onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }} className="p-1 rounded hover:bg-[#ECFDF5]" data-testid={`mark-read-${n.id}`}>
                      <Check className="h-3 w-3 text-[#10B981]" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
