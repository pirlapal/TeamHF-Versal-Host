import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText, Download, BarChart3, Users, Briefcase,
  CalendarDays, Target, DollarSign, FileDown, Sparkles, Loader2
} from "lucide-react";
import { toast } from "sonner";

const REPORT_TYPES = [
  { id: "services", labelKey: "reports.services", icon: Briefcase, color: "#F97316", bg: "#FFF7ED" },
  { id: "visits", labelKey: "reports.visits", icon: CalendarDays, color: "#6366F1", bg: "#EEF2FF" },
  { id: "outcomes", labelKey: "reports.outcomes", icon: Target, color: "#14B8A6", bg: "#F0FDFA" },
  { id: "payments", labelKey: "reports.payments", icon: DollarSign, color: "#10B981", bg: "#ECFDF5" },
];

export default function Reports() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [outcomeStats, setOutcomeStats] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [downloading, setDownloading] = useState(null);
  const [selectedNarrativeClients, setSelectedNarrativeClients] = useState([]);
  const [narrativeAll, setNarrativeAll] = useState(true);
  const [narrativeResult, setNarrativeResult] = useState(null);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [{ data: oc }, { data: cl }] = await Promise.all([
          api.get("/dashboard/outcomes"),
          api.get("/clients?page_size=100"),
        ]);
        setOutcomeStats(oc);
        setClients(cl.data || []);
      } catch {}
    };
    fetch();
  }, []);

  const handleCSVExport = useCallback(async (type) => {
    setDownloading(type);
    try {
      const url = type === "clients" ? "/reports/export" : `/reports/export/${type}`;
      const response = await api.get(url, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${type}_export.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${type} CSV downloaded`);
    } catch {
      toast.error("Export failed");
    } finally { setDownloading(null); }
  }, []);

  const handlePDFExport = useCallback(async (type, clientId) => {
    setDownloading(type);
    try {
      const url = type === "client" ? `/reports/client/${clientId}/pdf` : "/reports/org/pdf";
      const response = await api.get(url, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = type === "client" ? "client_report.pdf" : "organization_report.pdf";
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF generation failed");
    } finally { setDownloading(null); }
  }, []);

  const handleNarrativeReport = useCallback(async () => {
    setGeneratingNarrative(true);
    setNarrativeResult(null);
    try {
      const payload = narrativeAll ? { client_ids: [] } : { client_ids: selectedNarrativeClients };
      const { data } = await api.post("/reports/narrative", payload);
      setNarrativeResult(data);
      toast.success(`Generated narratives for ${data.total_clients} client(s)`);
    } catch (err) {
      toast.error("Narrative report generation failed");
    } finally { setGeneratingNarrative(false); }
  }, [narrativeAll, selectedNarrativeClients]);

  const toggleNarrativeClient = (clientId) => {
    setSelectedNarrativeClients(prev =>
      prev.includes(clientId) ? prev.filter(c => c !== clientId) : [...prev, clientId]
    );
  };

  const OUTCOME_COLORS = { "ACHIEVED": "#10B981", "IN_PROGRESS": "#F59E0B", "NOT_STARTED": "#9CA3AF", "NOT_ACHIEVED": "#EF4444" };
  const totalOutcomes = outcomeStats.reduce((s, o) => s + o.count, 0);

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">{t("reports.title")}</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">{t("reports.subtitle")}</p>
      </div>

      {/* PDF Reports */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Org Report */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4" data-testid="org-report-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-[#F97316]" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937]">{t("reports.organizationReport")}</h3>
              <p className="text-xs text-[#9CA3AF]">{t("reports.orgReportDesc")}</p>
            </div>
          </div>
          {user?.role === "ADMIN" && (
            <Button onClick={() => handlePDFExport("org")} disabled={downloading === "org"}
              className="w-full bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200"
              data-testid="download-org-pdf">
              {downloading === "org" ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FileDown className="h-4 w-4" /> {t("reports.downloadPDF")}</>}
            </Button>
          )}
        </div>

        {/* Client Report */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4" data-testid="client-report-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] flex items-center justify-center">
              <Users className="h-5 w-5 text-[#14B8A6]" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937]">{t("reports.clientReport")}</h3>
              <p className="text-xs text-[#9CA3AF]">{t("reports.clientReportDesc")}</p>
            </div>
          </div>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="select-client-report">
              <SelectValue placeholder={t("reports.selectClient")} />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#E8E8E8] rounded-xl max-h-56">
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => handlePDFExport("client", selectedClient)} disabled={!selectedClient || downloading === "client"}
            className="w-full bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] hover:from-[#0D9488] hover:to-[#14B8A6] text-white gap-2 rounded-lg font-bold shadow-md shadow-teal-200"
            data-testid="download-client-pdf">
            {downloading === "client" ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FileDown className="h-4 w-4" /> {t("reports.downloadClientPDF")}</>}
          </Button>
        </div>
      </div>

      {/* Outcome Tracking Chart */}
      {totalOutcomes > 0 && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6" data-testid="outcome-chart">
          <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937] mb-4">{t("reports.outcomeTracking")}</h3>
          <div className="flex items-center gap-3 mb-4">
            {outcomeStats.map((o) => (
              <div key={o.status} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: OUTCOME_COLORS[o.status] || "#9CA3AF" }} />
                <span className="text-[#6B7280]">{o.status?.replace("_", " ")}: {o.count}</span>
              </div>
            ))}
          </div>
          {/* Bar chart visual */}
          <div className="flex items-end gap-2 h-32">
            {outcomeStats.map((o) => {
              const pct = totalOutcomes > 0 ? (o.count / totalOutcomes) * 100 : 0;
              return (
                <div key={o.status} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-[#1F2937]">{o.count}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 8)}%`, backgroundColor: OUTCOME_COLORS[o.status] || "#9CA3AF", opacity: 0.8 }} />
                  <span className="text-[9px] text-[#9CA3AF] text-center leading-tight">{o.status?.replace("_", " ")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Narrative Reports (R35.4) */}
      {user?.role === "ADMIN" && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4" data-testid="narrative-report-section">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937]">{t("reports.aiNarrativeReports")}</h3>
              <p className="text-xs text-[#9CA3AF]">{t("reports.aiNarrativeDesc")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="all-clients" checked={narrativeAll} onCheckedChange={(v) => { setNarrativeAll(!!v); if (v) setSelectedNarrativeClients([]); }} data-testid="narrative-all-toggle" />
                <label htmlFor="all-clients" className="text-sm font-semibold text-[#1F2937] cursor-pointer">{t("reports.allClients")}</label>
              </div>
              <span className="text-xs text-[#9CA3AF]">{t("reports.orSelectClients")}</span>
            </div>

            {!narrativeAll && (
              <div className="border border-[#E5E7EB] rounded-lg p-3 max-h-48 overflow-y-auto space-y-1" data-testid="narrative-client-list">
                {clients.length === 0 && <p className="text-xs text-[#9CA3AF]">{t("reports.noClients")}</p>}
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-[#FAFAF8] transition-colors">
                    <Checkbox id={`nc-${c.id}`} checked={selectedNarrativeClients.includes(c.id)}
                      onCheckedChange={() => toggleNarrativeClient(c.id)} data-testid={`narrative-client-${c.id}`} />
                    <label htmlFor={`nc-${c.id}`} className="text-sm text-[#4B5563] cursor-pointer flex-1">{c.name}</label>
                  </div>
                ))}
                {selectedNarrativeClients.length > 0 && (
                  <p className="text-xs font-semibold text-[#8B5CF6] pt-1">{selectedNarrativeClients.length} {t("reports.clientsSelected")}</p>
                )}
              </div>
            )}

            <Button onClick={handleNarrativeReport} disabled={generatingNarrative || (!narrativeAll && selectedNarrativeClients.length === 0)}
              className="bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] hover:from-[#7C3AED] hover:to-[#8B5CF6] text-white gap-2 rounded-lg font-bold shadow-md shadow-purple-200"
              data-testid="generate-narrative-btn">
              {generatingNarrative ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("reports.generating")}</> : <><Sparkles className="h-4 w-4" /> {t("reports.generateNarrative")}</>}
            </Button>
          </div>

          {/* Narrative Results */}
          {narrativeResult && (
            <div className="space-y-3 mt-4" data-testid="narrative-results">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#1F2937]">{narrativeResult.total_clients} {t("reports.narrativesGenerated")}</p>
                <span className="text-[10px] text-[#9CA3AF]">{new Date(narrativeResult.generated_at).toLocaleString()}</span>
              </div>
              {narrativeResult.narratives.map((n) => (
                <div key={n.client_id} className="border border-[#E5E7EB] rounded-xl p-4 bg-[#FAFAF8]" data-testid={`narrative-${n.client_id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-[#1F2937]">{n.client_name}</h4>
                    <div className="flex gap-2 text-[10px] text-[#9CA3AF]">
                      <span>{n.stats.services} svc</span>
                      <span>{n.stats.outcomes} goals</span>
                      <span>{n.stats.visits} visits</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#4B5563] leading-relaxed">{n.narrative}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSV Exports */}
      <div>
        <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937] mb-3">{t("reports.csvExports")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Clients export */}
          <button onClick={() => handleCSVExport("clients")} disabled={downloading === "clients"}
            className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all text-center"
            data-testid="export-clients-csv">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
              <Users className="h-4 w-4" style={{ color: "#6366F1" }} />
            </div>
            <span className="text-xs font-bold text-[#1F2937]">{t("reports.clients")}</span>
            <Badge variant="outline" className="border-[#E5E7EB] text-[#9CA3AF] text-[9px] rounded-full">CSV</Badge>
          </button>
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon;
            return (
              <button key={rt.id} onClick={() => handleCSVExport(rt.id)} disabled={downloading === rt.id}
                className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all text-center"
                data-testid={`export-${rt.id}-csv`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: rt.bg }}>
                  <Icon className="h-4 w-4" style={{ color: rt.color }} />
                </div>
                <span className="text-xs font-bold text-[#1F2937]">{t(rt.labelKey)}</span>
                <Badge variant="outline" className="border-[#E5E7EB] text-[#9CA3AF] text-[9px] rounded-full">CSV</Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
