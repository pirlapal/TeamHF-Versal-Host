import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, ChevronLeft, ChevronRight, UserCheck, Clock, Upload, Download, Users, Wand2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { sendClientOnboardingNotification } from "@/lib/emailService";

export default function Clients() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_count: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/clients", { params: { search, page, page_size: 25, status: statusFilter === "all" ? "" : statusFilter, date_from: dateFrom, date_to: dateTo } });
      setClients(data.data || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total_count: 0 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, page, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleCreate = async (e) => {
    e.preventDefault();
    // Check duplicates first
    if (!duplicateWarning && (newClient.email || newClient.phone)) {
      try {
        const { data: dupCheck } = await api.post("/clients/check-duplicate", newClient);
        if (dupCheck.has_duplicates) {
          setDuplicateWarning(dupCheck.duplicates);
          setCreating(false);
          return;
        }
      } catch {}
    }
    setCreating(true);
    setDuplicateWarning(null);
    try {
      const { data } = await api.post("/clients", newClient);
      toast.success("Client created successfully");
      setShowCreate(false);
      setNewClient({ name: "", email: "", phone: "", address: "", notes: "" });
      navigate(`/clients/${data.id}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setCreating(false); }
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Please select a CSV file"); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData(); formData.append("file", file);
      const { data } = await api.post("/clients/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setImportResult(data);
      if (data.imported > 0) { toast.success(`Imported ${data.imported} clients`); fetchClients(); }
      else { toast.error("No clients imported"); }
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/reports/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = "clients_export.csv"; a.click();
    } catch (err) { toast.error("Export failed"); }
  };

  const role = user?.role;

  return (
    <div className="space-y-6" data-testid="clients-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">{t("clients.title")}</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">{pagination.total_count} {t("clients.totalClients")}</p>
        </div>
        {(role === "ADMIN" || role === "CASE_WORKER") && (
          <div className="flex items-center gap-2">
            {role === "ADMIN" && (
              <>
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} disabled={importing} data-testid="csv-import-input" />
                  <div className="flex items-center gap-2 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:bg-[#FFF7ED] transition-colors h-9" data-testid="csv-import-btn">
                    {importing ? <div className="w-3.5 h-3.5 border-2 border-[#6B7280]/30 border-t-[#6B7280] rounded-full animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{importing ? t("common.loading") : t("clients.importClients")}</span>
                  </div>
                </label>
                <Button variant="outline" size="sm" onClick={handleExport} className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] gap-2 h-9 rounded-lg" data-testid="csv-export-btn">
                  <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t("common.export")}</span>
                </Button>
              </>
            )}
            <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200" data-testid="add-client-btn">
              <Plus className="h-4 w-4" /> {t("clients.addClient")}
            </Button>
            <Button onClick={() => navigate("/clients/wizard")} variant="outline" className="border-[#14B8A6] text-[#14B8A6] hover:bg-[#F0FDFA] gap-2 rounded-lg font-bold" data-testid="wizard-client-btn">
              <Wand2 className="h-4 w-4" /> {t("clients.onboardClient")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D1D5DB]" />
          <Input placeholder={t("clients.searchClients")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-10 rounded-lg" data-testid="client-search-input" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32 h-10 bg-white border-[#E5E7EB] text-[#6B7280] rounded-lg text-xs" data-testid="status-filter">
            <SelectValue placeholder={t("common.all") + " " + t("common.status")} />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
            <SelectItem value="all">{t("common.all")} {t("common.status")}</SelectItem>
            <SelectItem value="active">{t("status.active")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          placeholder="From" className="w-36 h-10 bg-white border-[#E5E7EB] text-[#6B7280] rounded-lg text-xs" data-testid="date-from-filter" />
        <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          placeholder="To" className="w-36 h-10 bg-white border-[#E5E7EB] text-[#6B7280] rounded-lg text-xs" data-testid="date-to-filter" />
        {(statusFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
            className="text-[#9CA3AF] text-xs h-10 rounded-lg" data-testid="clear-filters-btn">{t("clients.clearFilters")}</Button>
        )}
      </div>

      {importResult && (
        <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-between" data-testid="import-result-banner">
          <span className="text-sm text-[#6B7280]">
            {t("clients.importComplete")} <span className="text-[#10B981] font-mono font-bold">{importResult.imported}</span> {t("clients.imported")}, <span className="text-[#F59E0B] font-mono font-bold">{importResult.skipped}</span> {t("clients.skipped")}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setImportResult(null)} className="text-[#9CA3AF] h-7">{t("clients.dismiss")}</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center" data-testid="clients-empty">
          <Users className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" />
          <p className="text-[#6B7280] mb-4">{t("clients.noClients")}</p>
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <Button onClick={() => setShowCreate(true)} variant="outline" className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] rounded-lg">{t("clients.addFirstClient")}</Button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("clients.tableName")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hidden sm:table-cell">{t("clients.tableEmail")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hidden md:table-cell">{t("clients.tablePhone")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("clients.tableStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} className={`table-row-hover border-b border-[#F9FAFB] cursor-pointer animate-fade-in stagger-${Math.min(i+1, 4)}`}
                  onClick={() => navigate(`/clients/${c.id}`)} data-testid={`client-row-${c.id}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFF7ED] to-[#FED7AA] flex items-center justify-center text-xs font-bold text-[#F97316]">
                        {c.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-[#1F2937]">{c.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-[#6B7280] hidden sm:table-cell">{c.email || "\u2014"}</td>
                  <td className="p-4 text-sm text-[#6B7280] hidden md:table-cell font-mono">{c.phone || "\u2014"}</td>
                  <td className="p-4">
                    {c.pending ? (
                      <Badge variant="outline" className="border-[#F59E0B]/30 text-[#F59E0B] bg-[#FFFBEB] gap-1 text-xs rounded-full">
                        <Clock className="h-3 w-3" /> {t("status.pending")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#10B981]/30 text-[#10B981] bg-[#ECFDF5] gap-1 text-xs rounded-full">
                        <UserCheck className="h-3 w-3" /> {t("status.active")}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-[#6B7280] rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-[#6B7280] font-mono">{page} / {pagination.total_pages}</span>
          <Button variant="ghost" size="icon" disabled={page >= pagination.total_pages} onClick={() => setPage(p => p + 1)} className="text-[#6B7280] rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] max-w-lg rounded-2xl" data-testid="create-client-dialog">
          <DialogHeader><DialogTitle className="font-['Nunito'] text-xl font-bold">{t("clients.newClient")}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("clients.fullNameRequired")}</Label>
              <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} required placeholder={t("clients.clientName")}
                className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="new-client-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("common.email")}</Label>
                <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder={t("clients.emailPlaceholder")}
                  className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="new-client-email" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("common.phone")}</Label>
                <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder={t("clients.phonePlaceholder")}
                  className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="new-client-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("common.address")}</Label>
              <Input value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} placeholder={t("clients.streetAddress")}
                className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="new-client-address" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("common.notes")}</Label>
              <Textarea value={newClient.notes} onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} placeholder={t("clients.initialNotes")}
                className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[80px] rounded-lg" data-testid="new-client-notes" />
            </div>
            <DialogFooter>
              {duplicateWarning && (
                <div className="w-full p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl mb-3 space-y-2" data-testid="duplicate-warning">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#F59E0B]">
                    <AlertTriangle className="h-4 w-4" /> {t("clients.duplicateDetected")}
                  </div>
                  {duplicateWarning.map((d, i) => (
                    <div key={i} className="text-xs text-[#6B7280] bg-white p-2 rounded-lg border border-[#E5E7EB]">
                      <span className="font-semibold text-[#1F2937]">{d.name}</span>
                      <span className="mx-1">—</span>
                      <span>{t("clients.matchedOn")} {d.match_type}: {d.match_type === "email" ? d.email : d.phone}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-[#9CA3AF]">{t("clients.clickToCreate")}</p>
                </div>
              )}
              <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setDuplicateWarning(null); }} className="text-[#9CA3AF] rounded-lg">{t("common.cancel")}</Button>
              <Button type="submit" disabled={creating} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold gap-2" data-testid="create-client-submit">
                {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : duplicateWarning ? t("clients.createAnyway") : t("clients.createClient")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
