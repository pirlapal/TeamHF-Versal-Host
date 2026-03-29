import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CheckCircle, Clock, AlertTriangle, Send,
  DollarSign, Ban, FileText, Bell
} from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES = {
  PAID: { bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]", text: "text-[#10B981]", icon: CheckCircle },
  PENDING: { bg: "bg-[#FFFBEB]", border: "border-[#FDE68A]", text: "text-[#F59E0B]", icon: Clock },
  OVERDUE: { bg: "bg-[#FEF2F2]", border: "border-[#FECACA]", text: "text-[#EF4444]", icon: AlertTriangle },
  CANCELLED: { bg: "bg-[#F3F4F6]", border: "border-[#E5E7EB]", text: "text-[#6B7280]", icon: Ban },
};

export default function Payments() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ client_name: "", client_email: "", amount: "", description: "", due_date: "" });
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const fetchRequests = async () => { try { const { data } = await api.get("/payments/requests"); setRequests(data); } catch {} };
  useEffect(() => { fetchRequests(); }, []);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    setSendingRequest(true);
    try {
      await api.post("/payments/request", { ...requestForm, amount: parseFloat(requestForm.amount) });
      toast.success(`Payment request sent to ${requestForm.client_name}`);
      setShowRequestDialog(false);
      setRequestForm({ client_name: "", client_email: "", amount: "", description: "", due_date: "" });
      fetchRequests();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSendingRequest(false); }
  };

  const handleUpdateRequestStatus = async (reqId, status) => {
    try {
      await api.patch(`/payments/requests/${reqId}`, { status });
      toast.success(`Request marked as ${status}`);
      fetchRequests();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const handleSendReminder = async (reqId, clientName) => {
    setSendingReminder(reqId);
    try {
      await api.post(`/payments/requests/${reqId}/reminder`);
      toast.success(`Reminder sent to ${clientName}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.PENDING;

  const totalReceived = requests.filter(r => r.status === "PAID").reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPending = requests.filter(r => r.status === "PENDING").reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalOverdue = requests.filter(r => r.status === "OVERDUE").reduce((sum, r) => sum + (r.amount || 0), 0);

  const filteredRequests = filter === "ALL" ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">{t("payments.title")}</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">{t("payments.subtitle")}</p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
          <Button onClick={() => setShowRequestDialog(true)}
            className="bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200"
            data-testid="send-payment-request-btn">
            <Send className="h-4 w-4" /> {t("payments.sendPaymentRequest")}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-received">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">{t("payments.received")}</span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] flex items-center justify-center"><DollarSign className="h-4 w-4 text-[#10B981]" /></div>
          </div>
          <p className="data-metric text-[#10B981]">${totalReceived.toFixed(2)}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{requests.filter(r => r.status === "PAID").length} {t("payments.paymentsCount")}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-pending">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">{t("payments.pending")}</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center"><Clock className="h-4 w-4 text-[#F59E0B]" /></div>
          </div>
          <p className="data-metric text-[#F59E0B]">${totalPending.toFixed(2)}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{requests.filter(r => r.status === "PENDING").length} {t("payments.pendingCount")}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-overdue">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">{t("payments.overdue")}</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-[#EF4444]" /></div>
          </div>
          <p className="data-metric text-[#EF4444]">${totalOverdue.toFixed(2)}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{requests.filter(r => r.status === "OVERDUE").length} {t("payments.overdueCount")}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap" data-testid="payment-filter-tabs">
        {["ALL", "PENDING", "PAID", "OVERDUE", "CANCELLED"].map(s => {
          const statusLabels = {
            "ALL": t("payments.all"),
            "PENDING": t("payments.pending"),
            "PAID": t("payments.paid"),
            "OVERDUE": t("payments.overdue"),
            "CANCELLED": t("payments.cancelled")
          };
          const count = s === "ALL" ? requests.length : requests.filter(r => r.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s ? "bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white shadow-md shadow-orange-200" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#F97316]"}`}
              data-testid={`filter-${s.toLowerCase()}`}>
              {statusLabels[s]} ({count})
            </button>
          );
        })}
      </div>

      {/* Payment Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center" data-testid="no-payment-requests">
          <FileText className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" />
          <p className="text-[#6B7280] mb-2">{t("payments.noRequestsFound")} {filter !== "ALL" && `with status "${filter}"`}</p>
          <p className="text-xs text-[#9CA3AF]">{t("payments.noRequestsDesc")}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden" data-testid="payment-requests-table">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("payments.client")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("payments.description")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("payments.amount")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("payments.dueDate")}</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("common.status")}</th>
                {user?.role === "ADMIN" && <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{t("common.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => {
                const style = getStatusStyle(req.status);
                const StatusIcon = style.icon;
                return (
                  <tr key={req.id} className="border-b border-[#F9FAFB] table-row-hover" data-testid={`payment-request-row-${req.id}`}>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-[#1F2937]">{req.client_name}</div>
                      <div className="text-xs text-[#9CA3AF]">{req.client_email}</div>
                    </td>
                    <td className="p-4 text-sm text-[#6B7280]">{req.description}</td>
                    <td className="p-4 text-sm font-mono font-bold text-[#1F2937]">${req.amount?.toFixed(2)}</td>
                    <td className="p-4 text-xs text-[#9CA3AF] font-mono">{req.due_date || "—"}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={`${style.border} ${style.text} ${style.bg} text-xs rounded-full gap-1`}>
                        <StatusIcon className="h-3 w-3" /> {req.status}
                      </Badge>
                    </td>
                    {user?.role === "ADMIN" && (
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {req.status === "PENDING" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "PAID")}
                                className="text-[#10B981] hover:bg-[#ECFDF5] h-7 text-xs rounded-lg" data-testid={`mark-paid-${req.id}`}>{t("payments.markPaid")}</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "OVERDUE")}
                                className="text-[#EF4444] hover:bg-[#FEF2F2] h-7 text-xs rounded-lg" data-testid={`mark-overdue-${req.id}`}>{t("payments.markOverdue")}</Button>
                            </>
                          )}
                          {req.status === "OVERDUE" && (
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "PAID")}
                              className="text-[#10B981] hover:bg-[#ECFDF5] h-7 text-xs rounded-lg">{t("payments.markPaid")}</Button>
                          )}
                          {(req.status === "PENDING" || req.status === "OVERDUE") && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleSendReminder(req.id, req.client_name)}
                                disabled={sendingReminder === req.id}
                                className="text-[#F97316] hover:bg-[#FFF7ED] h-7 text-xs rounded-lg gap-1" data-testid={`send-reminder-${req.id}`}>
                                {sendingReminder === req.id ? (
                                  <div className="w-3 h-3 border-2 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
                                ) : (
                                  <><Bell className="h-3 w-3" /> {t("payments.sendReminder")}</>
                                )}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "CANCELLED")}
                                className="text-[#6B7280] hover:bg-[#F3F4F6] h-7 text-xs rounded-lg">{t("common.cancel")}</Button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Send Payment Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] max-w-lg rounded-2xl" data-testid="payment-request-dialog">
          <DialogHeader><DialogTitle className="font-['Nunito'] text-xl font-bold">{t("payments.sendPaymentRequest")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSendRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("payments.clientName")} *</Label>
                <Input value={requestForm.client_name} onChange={e => setRequestForm({ ...requestForm, client_name: e.target.value })} required
                  placeholder={t("payments.clientFullName")} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-client-name" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("payments.clientEmail")} *</Label>
                <Input type="email" value={requestForm.client_email} onChange={e => setRequestForm({ ...requestForm, client_email: e.target.value })} required
                  placeholder={t("payments.clientEmailPlaceholder")} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-client-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("payments.amountDollars")} *</Label>
                <Input type="number" step="0.01" min="0.01" value={requestForm.amount} onChange={e => setRequestForm({ ...requestForm, amount: e.target.value })} required
                  placeholder={t("payments.amountPlaceholder")} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-amount" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("payments.dueDate")}</Label>
                <Input type="date" value={requestForm.due_date} onChange={e => setRequestForm({ ...requestForm, due_date: e.target.value })}
                  className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-due-date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("payments.description")} *</Label>
              <Textarea value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} required
                placeholder={t("payments.descriptionPlaceholder")} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[80px] rounded-lg" data-testid="request-description" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowRequestDialog(false)} className="text-[#9CA3AF] rounded-lg">{t("common.cancel")}</Button>
              <Button type="submit" disabled={sendingRequest}
                className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold gap-2" data-testid="send-request-submit">
                {sendingRequest ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="h-4 w-4" /> {t("payments.sendRequest")}</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
