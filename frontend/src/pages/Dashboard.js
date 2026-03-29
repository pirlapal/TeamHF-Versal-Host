import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Users, ClipboardList, CalendarDays, Target, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const STAT_ICONS = [
  { key: "client_count", label: "Total Clients", icon: Users, color: "#0055FF" },
  { key: "service_count", label: "Total Services", icon: ClipboardList, color: "#00E5FF" },
  { key: "visit_count", label: "Total Visits", icon: CalendarDays, color: "#00E676" },
  { key: "outcome_count", label: "Total Outcomes", icon: Target, color: "#FFEA00" },
];

const OUTCOME_COLORS = { NOT_STARTED: "#6E6E73", IN_PROGRESS: "#FFEA00", ACHIEVED: "#00E676", NOT_ACHIEVED: "#FF1744" };

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass border border-[#2A2A2D] rounded-sm p-3 text-xs">
      <p className="text-[#F9F9FB] font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono font-semibold">{p.value}</span>
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
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range]);

  const handleExport = async () => {
    try {
      const res = await api.get("/reports/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "clients_export.csv";
      a.click();
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 bg-[#141415]" />)}
        </div>
        <Skeleton className="h-72 bg-[#141415]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">Dashboard</h1>
          <p className="text-sm text-[#6E6E73] mt-1">Overview of your organization's activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32 bg-[#141415] border-[#2A2A2D] text-[#F9F9FB] h-9" data-testid="range-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#141415] border-[#2A2A2D]">
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          {user?.role === "ADMIN" && (
            <Button variant="outline" size="sm" onClick={handleExport} className="border-[#2A2A2D] text-[#A0A0A5] hover:bg-white/5 gap-2" data-testid="export-btn">
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_ICONS.map((s, i) => (
          <div key={s.key} className={`stat-card bg-[#141415] rounded-sm p-5 animate-fade-in stagger-${i+1}`} data-testid={`stat-${s.key}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="overline">{s.label}</span>
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
            </div>
            <p className="data-metric">{stats?.[s.key] ?? 0}</p>
            {s.key === "client_count" && stats?.pending_count > 0 && (
              <p className="text-xs text-[#FFEA00] mt-2">{stats.pending_count} pending approval</p>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-[#141415] border border-[#2A2A2D] rounded-sm p-5" data-testid="trends-chart">
          <h3 className="text-sm font-medium text-[#F9F9FB] mb-4 font-['Outfit']">Service & Visit Trends</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
                <XAxis dataKey="date" tick={{ fill: "#6E6E73", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#6E6E73", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="service_count" stroke="#0055FF" strokeWidth={2} name="Services" dot={false} />
                <Line type="monotone" dataKey="visit_count" stroke="#00E5FF" strokeWidth={2} strokeDasharray="5 5" name="Visits" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[#6E6E73]">No trend data for selected period</div>
          )}
        </div>

        {/* Outcome Chart */}
        <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-5" data-testid="outcomes-chart">
          <h3 className="text-sm font-medium text-[#F9F9FB] mb-4 font-['Outfit']">Outcome Summary</h3>
          {outcomes.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={outcomes} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {outcomes.map((entry, i) => (
                    <Cell key={i} fill={OUTCOME_COLORS[entry.status] || "#6E6E73"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#141415", border: "1px solid #2A2A2D", borderRadius: "2px", color: "#F9F9FB", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#A0A0A5" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[#6E6E73]">No outcomes recorded yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
