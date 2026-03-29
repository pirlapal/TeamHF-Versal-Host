import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = { SCHEDULED: "border-[#BFDBFE] text-[#3B82F6] bg-[#EFF6FF]", COMPLETED: "border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5]", CANCELLED: "border-[#E5E7EB] text-[#6B7280] bg-[#F3F4F6]", NO_SHOW: "border-[#FECACA] text-[#EF4444] bg-[#FEF2F2]" };
const STATUS_ICONS = { SCHEDULED: Clock, COMPLETED: CheckCircle, CANCELLED: XCircle, NO_SHOW: AlertTriangle };

export default function CalendarPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [visits, setVisits] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ client_id: "", date: "", duration: 60, notes: "" });
  const [creating, setCreating] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);
  const [timeRange, setTimeRange] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const rangeParam = timeRange === "all" ? "" : `?range=${timeRange}`;
        const [v, c] = await Promise.all([
          api.get(`/visits${rangeParam}`),
          api.get("/clients", { params: { page_size: 100 } })
        ]);
        setVisits(v.data);
        setClients(c.data?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange]);

  const handleCreate = async (e) => {
    e.preventDefault();
    // Check conflicts before creating
    if (!conflictWarning && form.client_id && form.date) {
      try {
        const { data: conflictCheck } = await api.post("/visits/check-conflicts", form);
        if (conflictCheck.has_conflicts) {
          setConflictWarning(conflictCheck.conflicts);
          return;
        }
      } catch {}
    }
    setCreating(true);
    setConflictWarning(null);
    try {
      const { data } = await api.post("/visits", form);
      setVisits([...visits, data]);
      setShowCreate(false);
      setForm({ client_id: "", date: "", duration: 60, notes: "" });
      toast.success("Visit scheduled");
      if (data.conflicts?.length > 0) {
        toast.warning(`Note: ${data.conflicts.length} scheduling conflict(s) detected`);
      }
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setCreating(false); }
  };
  const handleStatusChange = async (visitId, status) => { try { const { data } = await api.patch(`/visits/${visitId}`, { status }); setVisits(visits.map((v) => (v.id === visitId ? { ...v, ...data } : v))); toast.success(`Visit marked as ${status.toLowerCase()}`); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };

  const visitsByDate = {};
  visits.forEach((v) => { const d = (v.date || "").split("T")[0]; if (!visitsByDate[d]) visitsByDate[d] = []; visitsByDate[d].push(v); });
  const sortedDates = Object.keys(visitsByDate).sort();

  if (loading) return <div className="space-y-4" data-testid="calendar-loading">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">{t("calendar.title")}</h1><p className="text-sm text-[#9CA3AF] mt-1">{visits.length} {t("calendar.scheduledVisits")}</p></div>
        {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200" data-testid="schedule-visit-btn"><Plus className="h-4 w-4" /> {t("calendar.scheduleVisit")}</Button>
        )}
      </div>

      {/* Time Range Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#6B7280] mr-1">{t("dashboard.timePeriod")}</span>
        {[
          { label: t("time.allTime"), value: "all" },
          { label: t("time.thisWeek"), value: "week" },
          { label: t("time.thisMonth"), value: "month" },
          { label: t("time.lastQuarter"), value: "quarter" },
          { label: t("time.lastYear"), value: "year" },
        ].map((range) => (
          <button
            key={range.value}
            onClick={() => setTimeRange(range.value)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              timeRange === range.value
                ? "bg-[#F97316] text-white shadow-sm"
                : "bg-white text-[#6B7280] border border-[#E8E8E8] hover:border-[#F97316] hover:text-[#F97316]"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center" data-testid="calendar-empty"><Clock className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" /><p className="text-[#6B7280] mb-4">No visits scheduled</p><Button onClick={() => setShowCreate(true)} variant="outline" className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] rounded-lg">Schedule your first visit</Button></div>
      ) : (
        <div className="space-y-6">{sortedDates.map((date) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3"><div className="h-px flex-1 bg-[#E5E7EB]" /><span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] font-mono px-2 py-1 bg-[#FFF7ED] rounded-full">{date}</span><div className="h-px flex-1 bg-[#E5E7EB]" /></div>
            <div className="space-y-2">{visitsByDate[date].map((v) => { const Icon = STATUS_ICONS[v.status] || Clock; return (
              <div key={v.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4 table-row-hover" data-testid={`visit-${v.id}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[#6B7280]" /><div><span className="text-sm font-semibold text-[#1F2937]">{v.client_name || "Client"}</span><span className="text-xs text-[#9CA3AF] ml-3 font-mono">{v.duration}min</span></div></div>
                  <div className="flex items-center gap-2"><Badge variant="outline" className={`text-xs rounded-full ${STATUS_COLORS[v.status] || ""}`}>{v.status}</Badge>
                    {v.status === "SCHEDULED" && (user?.role === "ADMIN" || user?.role === "CASE_WORKER") && <Select onValueChange={(val) => handleStatusChange(v.id, val)}><SelectTrigger className="h-7 w-28 text-xs bg-transparent border-[#E5E7EB] text-[#6B7280] rounded-lg" data-testid={`visit-status-${v.id}`}><SelectValue placeholder="Update" /></SelectTrigger><SelectContent className="bg-white border-[#E8E8E8] rounded-xl"><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem><SelectItem value="NO_SHOW">No Show</SelectItem></SelectContent></Select>}
                  </div>
                </div>
                {v.notes && <p className="text-xs text-[#9CA3AF] mt-2 pl-7">{v.notes}</p>}
              </div>); })}</div>
          </div>))}</div>)}

      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setConflictWarning(null); }}>
        <DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] rounded-2xl" data-testid="create-visit-dialog">
          <DialogHeader><DialogTitle className="font-['Nunito'] font-bold">Schedule Visit</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase font-bold">Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => { setForm({...form, client_id: v}); setConflictWarning(null); }}>
                <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" data-testid="visit-client-select"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent className="bg-white border-[#E8E8E8] max-h-48 rounded-xl">{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase font-bold">Date & Time *</Label>
                <Input type="datetime-local" value={form.date} onChange={(e) => { setForm({...form, date: e.target.value}); setConflictWarning(null); }} required className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" data-testid="visit-date-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase font-bold">Duration (min)</Label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({...form, duration: parseInt(e.target.value) || 60})} min={15} max={480} step={15} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase font-bold">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" />
            </div>
            {conflictWarning && (
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl space-y-2" data-testid="conflict-warning">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F59E0B]">
                  <AlertTriangle className="h-4 w-4" /> Scheduling Conflict Detected
                </div>
                {conflictWarning.map((c, i) => (
                  <div key={i} className="text-xs text-[#6B7280] bg-white p-2 rounded-lg border border-[#E5E7EB]">
                    <span className="font-semibold text-[#1F2937]">{c.client_name}</span>
                    <span className="mx-1">—</span>
                    <span className="font-mono">{c.date?.slice(0,16).replace("T"," ")}</span>
                    <span className="ml-1 text-[#9CA3AF]">({c.duration}min)</span>
                  </div>
                ))}
                <p className="text-[10px] text-[#9CA3AF]">Click "Schedule Anyway" to proceed or change the date/time.</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setConflictWarning(null); }} className="text-[#9CA3AF] rounded-lg">Cancel</Button>
              <Button type="submit" disabled={creating || !form.client_id} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold" data-testid="submit-visit">
                {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : conflictWarning ? "Schedule Anyway" : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
