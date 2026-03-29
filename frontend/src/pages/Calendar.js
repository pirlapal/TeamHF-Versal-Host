import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
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

const STATUS_COLORS = {
  SCHEDULED: "border-[#0055FF]/30 text-[#0055FF] bg-[#0055FF]/10",
  COMPLETED: "border-[#00E676]/30 text-[#00E676] bg-[#00E676]/10",
  CANCELLED: "border-[#6E6E73]/30 text-[#6E6E73] bg-[#6E6E73]/10",
  NO_SHOW: "border-[#FF1744]/30 text-[#FF1744] bg-[#FF1744]/10",
};

const STATUS_ICONS = {
  SCHEDULED: Clock,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  NO_SHOW: AlertTriangle,
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [visits, setVisits] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ client_id: "", date: "", duration: 60, notes: "" });
  const [creating, setCreating] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [visitsRes, clientsRes] = await Promise.all([
          api.get("/visits"),
          api.get("/clients", { params: { page_size: 100 } }),
        ]);
        setVisits(visitsRes.data);
        setClients(clientsRes.data?.data || []);
      } catch (err) {
        console.error("Calendar fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post("/visits", form);
      setVisits([...visits, data]);
      setShowCreate(false);
      setForm({ client_id: "", date: "", duration: 60, notes: "" });
      toast.success("Visit scheduled");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (visitId, status) => {
    try {
      const { data } = await api.patch(`/visits/${visitId}`, { status });
      setVisits(visits.map((v) => (v.id === visitId ? { ...v, ...data } : v)));
      toast.success(`Visit marked as ${status.toLowerCase()}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  // Group visits by date
  const visitsByDate = {};
  visits.forEach((v) => {
    const d = (v.date || "").split("T")[0];
    if (!visitsByDate[d]) visitsByDate[d] = [];
    visitsByDate[d].push(v);
  });

  const sortedDates = Object.keys(visitsByDate).sort();

  if (loading) return (
    <div className="space-y-4" data-testid="calendar-loading">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-[#141415]" />)}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">Calendar</h1>
          <p className="text-sm text-[#6E6E73] mt-1">{visits.length} scheduled visits</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#0055FF] hover:bg-[#0044CC] gap-2 rounded-sm" data-testid="schedule-visit-btn">
          <Plus className="h-4 w-4" /> Schedule Visit
        </Button>
      </div>

      {/* Visit List grouped by date */}
      {sortedDates.length === 0 ? (
        <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-12 text-center" data-testid="calendar-empty">
          <Clock className="h-12 w-12 text-[#2A2A2D] mx-auto mb-4" />
          <p className="text-[#A0A0A5] mb-4">No visits scheduled</p>
          <Button onClick={() => setShowCreate(true)} variant="outline" className="border-[#2A2A2D] text-[#A0A0A5] hover:bg-white/5">Schedule your first visit</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-[#2A2A2D]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#6E6E73] font-mono">{date}</span>
                <div className="h-px flex-1 bg-[#2A2A2D]" />
              </div>
              <div className="space-y-2">
                {visitsByDate[date].map((v) => {
                  const Icon = STATUS_ICONS[v.status] || Clock;
                  return (
                    <div key={v.id} className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-4 table-row-hover" data-testid={`visit-${v.id}`}>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-[#A0A0A5]" />
                          <div>
                            <span className="text-sm font-medium text-[#F9F9FB]">{v.client_name || "Client"}</span>
                            <span className="text-xs text-[#6E6E73] ml-3 font-mono">{v.duration}min</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[v.status] || ""}`}>{v.status}</Badge>
                          {v.status === "SCHEDULED" && (
                            <Select onValueChange={(val) => handleStatusChange(v.id, val)}>
                              <SelectTrigger className="h-7 w-28 text-xs bg-transparent border-[#2A2A2D] text-[#A0A0A5]" data-testid={`visit-status-${v.id}`}>
                                <SelectValue placeholder="Update" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#141415] border-[#2A2A2D]">
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                <SelectItem value="NO_SHOW">No Show</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      {v.notes && <p className="text-xs text-[#6E6E73] mt-2 pl-7">{v.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB]" data-testid="create-visit-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Schedule Visit</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({...form, client_id: v})}>
                <SelectTrigger className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="visit-client-select"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent className="bg-[#141415] border-[#2A2A2D] max-h-48">
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Date & Time *</Label>
                <Input type="datetime-local" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} required className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="visit-date-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Duration (min)</Label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({...form, duration: parseInt(e.target.value) || 60})} min={15} max={480} step={15} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Visit notes..." className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" disabled={creating || !form.client_id} className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="submit-visit">
                {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
