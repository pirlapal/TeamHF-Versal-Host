import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Users, ClipboardList, CalendarDays, Target, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const STAT_ICONS = [
  { key: "client_count", label: "Total Clients", icon: Users, color: "#F97316", bg: "#FFF7ED" },
  { key: "service_count", label: "Total Services", icon: ClipboardList, color: "#14B8A6", bg: "#F0FDFA" },
  { key: "visit_count", label: "Total Visits", icon: CalendarDays, color: "#6366F1", bg: "#EEF2FF" },
  { key: "outcome_count", label: "Total Outcomes", icon: Target, color: "#F59E0B", bg: "#FFFBEB" },
];

const OUTCOME_COLORS = { NOT_STARTED: "#D1D5DB", IN_PROGRESS: "#F59E0B", ACHIEVED: "#10B981", NOT_ACHIEVED: "#EF4444" };

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-3 text-xs shadow-lg">
      <p className="text-[#1F2937] font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, trendsRes, outcomesRes] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get(`/dashboard/trends?range=${range}`),
          api.get("/dashboard/outcomes"),
        ]);
        setStats(statsRes.data);
        setTrends(trendsRes.data);
        setOutcomes(outcomesRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [range]);

  const handleExport = async () => {
    try {
      const res = await api.get("/reports/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = "clients_export.csv"; a.click();
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="space-y-6" data-testid="dashboard-loading">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Dashboard</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">Your organization at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32 bg-white border-[#E5E7EB] text-[#1F2937] h-9 rounded-lg" data-testid="range-selector"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-[#E5E7EB] rounded-xl">
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          {user?.role === "ADMIN" && (
            <Button variant="outline" size="sm" onClick={handleExport} className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] gap-2 rounded-lg" data-testid="export-btn">
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_ICONS.map((s, i) => (
          <div key={s.key} className={`stat-card bg-white border border-[#E8E8E8] p-5 animate-fade-in stagger-${i+1}`} data-testid={`stat-${s.key}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="overline">{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="data-metric">{stats?.[s.key] ?? 0}</p>
            {s.key === "client_count" && stats?.pending_count > 0 && (
              <p className="text-xs text-[#F59E0B] mt-2 font-semibold">{stats.pending_count} pending approval</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-[#E8E8E8] rounded-xl p-5" data-testid="trends-chart">
          <h3 className="text-sm font-bold text-[#1F2937] mb-4 font-['Nunito']">Service & Visit Trends</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="service_count" stroke="#F97316" strokeWidth={2.5} name="Services" dot={false} />
                <Line type="monotone" dataKey="visit_count" stroke="#14B8A6" strokeWidth={2.5} strokeDasharray="5 5" name="Visits" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-64 flex items-center justify-center text-sm text-[#9CA3AF]">No trend data for this period</div>}
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5" data-testid="outcomes-chart">
          <h3 className="text-sm font-bold text-[#1F2937] mb-4 font-['Nunito']">Outcome Summary</h3>
          {outcomes.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={outcomes} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {outcomes.map((entry, i) => <Cell key={i} fill={OUTCOME_COLORS[entry.status] || "#D1D5DB"} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E8E8E8", borderRadius: "12px", color: "#1F2937", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#6B7280" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-64 flex items-center justify-center text-sm text-[#9CA3AF]">No outcomes recorded yet</div>}
        </div>
      </div>
    </div>
  );
}
