import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Briefcase, Calendar, Target, TrendingUp,
  Clock, AlertTriangle, UserPlus, Wand2, FileDown, Bell, BarChart3
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [trends, setTrends] = useState([]);
  const [outcomeStats, setOutcomeStats] = useState([]);
  const [activity, setActivity] = useState({});
  const [demographics, setDemographics] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [s, t, o, a, d] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/dashboard/trends?range=month"),
          api.get("/dashboard/outcomes"),
          api.get("/dashboard/activity"),
          api.get("/dashboard/demographics"),
        ]);
        setStats(s.data);
        setTrends(t.data);
        setOutcomeStats(o.data);
        setActivity(a.data);
        setDemographics(d.data);
      } catch {}
    };
    fetch();
  }, []);

  const STAT_CARDS = [
    { label: "Clients", value: stats.client_count || 0, icon: Users, color: "#F97316", bg: "#FFF7ED" },
    { label: "Services", value: stats.service_count || 0, icon: Briefcase, color: "#14B8A6", bg: "#F0FDFA" },
    { label: "Visits", value: stats.visit_count || 0, icon: Calendar, color: "#6366F1", bg: "#EEF2FF" },
    { label: "Outcomes", value: stats.outcome_count || 0, icon: Target, color: "#10B981", bg: "#ECFDF5" },
  ];

  const OUTCOME_COLORS = { "ACHIEVED": "#10B981", "IN_PROGRESS": "#F59E0B", "NOT_STARTED": "#9CA3AF", "NOT_ACHIEVED": "#EF4444" };
  const totalOutcomes = outcomeStats.reduce((s, o) => s + o.count, 0);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">Here's what's happening today</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.pending_count > 0 && (
            <Badge variant="outline" className="border-[#FDE68A] text-[#F59E0B] bg-[#FFFBEB] text-xs rounded-full gap-1 px-3" data-testid="pending-badge">
              <Clock className="h-3 w-3" /> {stats.pending_count} pending approvals
            </Badge>
          )}
          {user?.role === "ADMIN" && (
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const response = await api.get("/reports/dashboard-csv", { responseType: "blob" });
                const blob = new Blob([response.data], { type: "text/csv" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "dashboard_export.csv";
                link.click();
                URL.revokeObjectURL(link.href);
              } catch {}
            }} className="border-[#E5E7EB] text-[#6B7280] rounded-lg gap-1.5 text-xs h-8 hover:border-[#F97316] hover:text-[#F97316]" data-testid="dashboard-csv-export">
              <FileDown className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid={`stat-${s.label.toLowerCase()}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="overline">{s.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                  <Icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
              </div>
              <p className="data-metric">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
          <>
            <button onClick={() => navigate("/clients/wizard")} className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-[#F97316] transition-all" data-testid="quick-action-wizard">
              <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center"><Wand2 className="h-5 w-5 text-[#F97316]" /></div>
              <span className="text-xs font-bold text-[#1F2937]">Onboard Client</span>
            </button>
            <button onClick={() => navigate("/clients")} className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-[#14B8A6] transition-all" data-testid="quick-action-clients">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] flex items-center justify-center"><UserPlus className="h-5 w-5 text-[#14B8A6]" /></div>
              <span className="text-xs font-bold text-[#1F2937]">Add Client</span>
            </button>
          </>
        )}
        {user?.role === "ADMIN" && (
          <button onClick={() => navigate("/reports")} className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-[#6366F1] transition-all" data-testid="quick-action-reports">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center"><FileDown className="h-5 w-5 text-[#6366F1]" /></div>
            <span className="text-xs font-bold text-[#1F2937]">Reports</span>
          </button>
        )}
        <button onClick={() => navigate("/calendar")} className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-[#F59E0B] transition-all" data-testid="quick-action-calendar">
          <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] flex items-center justify-center"><Calendar className="h-5 w-5 text-[#F59E0B]" /></div>
          <span className="text-xs font-bold text-[#1F2937]">Calendar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Trend Chart */}
        {trends.length > 0 && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5" data-testid="trend-chart">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-[#F97316]" />
              <span className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Activity Trend (30 days)</span>
            </div>
            <div className="flex items-end gap-1 h-28">
              {trends.slice(-14).map((t, i) => {
                const max = Math.max(...trends.slice(-14).map(d => d.service_count + d.visit_count), 1);
                const val = t.service_count + t.visit_count;
                const pct = (val / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${t.date}: ${val} activities`}>
                    <span className="text-[8px] text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity">{val}</span>
                    <div className="w-full rounded-t transition-all duration-300 group-hover:opacity-100" style={{
                      height: `${Math.max(pct, 4)}%`,
                      backgroundColor: val > 0 ? "#F97316" : "#F3F4F6",
                      opacity: val > 0 ? 0.9 : 0.5,
                    }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-[#D1D5DB] font-mono">{trends[Math.max(0, trends.length - 14)]?.date?.slice(5)}</span>
              <span className="text-[8px] text-[#D1D5DB] font-mono">{trends[trends.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
        )}

        {/* Outcome Distribution */}
        {totalOutcomes > 0 && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5" data-testid="outcome-chart">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-[#14B8A6]" />
              <span className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Outcome Distribution</span>
            </div>
            <div className="space-y-3">
              {outcomeStats.map((o) => {
                const pct = totalOutcomes > 0 ? (o.count / totalOutcomes) * 100 : 0;
                return (
                  <div key={o.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#6B7280]">{o.status?.replace("_", " ")}</span>
                      <span className="text-xs font-bold text-[#1F2937]">{o.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: OUTCOME_COLORS[o.status] || "#9CA3AF" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Visits Widget */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5" data-testid="upcoming-visits-widget">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#6366F1]" />
              <span className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Upcoming Visits</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")} className="text-[#9CA3AF] text-xs h-6 rounded-lg">View all</Button>
          </div>
          {activity.upcoming_visits?.length > 0 ? (
            <div className="space-y-2">
              {activity.upcoming_visits.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#FAFAF8] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
                    <Clock className="h-3.5 w-3.5 text-[#6366F1]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1F2937] truncate">{v.client_name}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-mono">{v.date?.slice(0, 16).replace("T", " ")}</p>
                  </div>
                  <Badge variant="outline" className="border-[#C7D2FE] text-[#6366F1] bg-[#EEF2FF] text-[9px] rounded-full">{v.duration}min</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] text-center py-4">No upcoming visits</p>
          )}
        </div>

        {/* Recent Clients Widget */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5" data-testid="recent-clients-widget">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#F97316]" />
              <span className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Recent Clients</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="text-[#9CA3AF] text-xs h-6 rounded-lg">View all</Button>
          </div>
          {activity.recent_clients?.length > 0 ? (
            <div className="space-y-2">
              {activity.recent_clients.map((c) => (
                <button key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#FAFAF8] transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {c.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1F2937] truncate">{c.name}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{c.email || "No email"}</p>
                  </div>
                  {c.pending && <Badge variant="outline" className="border-[#FDE68A] text-[#F59E0B] bg-[#FFFBEB] text-[9px] rounded-full">Pending</Badge>}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] text-center py-4">No clients yet</p>
          )}
        </div>

        {/* Overdue Payments Alert */}
        {activity.overdue_payments?.length > 0 && (
          <div className="bg-white border border-[#FECACA] rounded-xl p-5 lg:col-span-2" data-testid="overdue-payments-widget">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
              <span className="text-sm font-bold font-['Nunito'] text-[#EF4444]">Overdue Payments</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activity.overdue_payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-[#FEF2F2] rounded-lg">
                  <div>
                    <p className="text-xs font-semibold text-[#1F2937]">{p.client_name}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{p.description}</p>
                  </div>
                  <span className="text-sm font-bold font-mono text-[#EF4444]">${p.amount?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demographics Breakdown Chart (R27.1) */}
        {demographics.length > 0 && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 lg:col-span-2" data-testid="demographics-chart">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-[#8B5CF6]" />
              <span className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Client Demographics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {demographics.map((cat) => {
                const maxCount = Math.max(...cat.items.map(i => i.count), 1);
                const DEMO_COLORS = ["#F97316", "#14B8A6", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
                return (
                  <div key={cat.category} data-testid={`demo-category-${cat.category}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">{cat.category.replace(/_/g, " ")}</p>
                    <div className="space-y-2">
                      {cat.items.map((item, idx) => {
                        const pct = (item.count / maxCount) * 100;
                        return (
                          <div key={item.label} className="group">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-[#4B5563] truncate max-w-[150px]">{item.label}</span>
                              <span className="text-xs font-bold text-[#1F2937] font-mono">{item.count}</span>
                            </div>
                            <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: DEMO_COLORS[idx % DEMO_COLORS.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
