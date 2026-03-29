import React, { useState, useEffect } from "react";
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
  DollarSign, Ban, FileText
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
  const [requests, setRequests] = useState([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ client_name: "", client_email: "", amount: "", description: "", due_date: "" });
  const [sendingRequest, setSendingRequest] = useState(false);
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

  const getStatusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.PENDING;

  const totalReceived = requests.filter(r => r.status === "PAID").reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPending = requests.filter(r => r.status === "PENDING").reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalOverdue = requests.filter(r => r.status === "OVERDUE").reduce((sum, r) => sum + (r.amount || 0), 0);

  const filteredRequests = filter === "ALL" ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Payments</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">Send and track payment requests</p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
          <Button onClick={() => setShowRequestDialog(true)}
            className="bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200"
            data-testid="send-payment-request-btn">
            <Send className="h-4 w-4" /> Send Payment Request
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-received">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">Received</span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] flex items-center justify-center"><DollarSign className="h-4 w-4 text-[#10B981]" /></div>
          </div>
          <p className="data-metric text-[#10B981]">${totalReceived.toFixed(2)}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{requests.filter(r => r.status === "PAID").length} payments</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-pending">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center"><Clock className="h-4 w-4 text-[#F59E0B]" /></div>
          </div>
          <p className="data-metric text-[#F59E0B]">${totalPending.toFixed(2)}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{requests.filter(r => r.status === "PENDING").length} pending</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-overdue">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">Overdue</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-[#EF4444]" /></div>
          </div>
          <p className="data-metric text-[#EF4444]">${totalOverdue.toFixed(2)}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{requests.filter(r => r.status === "OVERDUE").length} overdue</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap" data-testid="payment-filter-tabs">
        {["ALL", "PENDING", "PAID", "OVERDUE", "CANCELLED"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s ? "bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white shadow-md shadow-orange-200" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#F97316]"}`}
            data-testid={`filter-${s.toLowerCase()}`}>
            {s === "ALL" ? `All (${requests.length})` : `${s} (${requests.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Payment Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center" data-testid="no-payment-requests">
          <FileText className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" />
          <p className="text-[#6B7280] mb-2">No payment requests {filter !== "ALL" && `with status "${filter}"`}</p>
          <p className="text-xs text-[#9CA3AF]">Send a payment request to a client to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden" data-testid="payment-requests-table">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Client</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Description</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Amount</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Due Date</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Status</th>
                {user?.role === "ADMIN" && <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Actions</th>}
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
                        <div className="flex gap-1">
                          {req.status === "PENDING" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "PAID")}
                                className="text-[#10B981] hover:bg-[#ECFDF5] h-7 text-xs rounded-lg" data-testid={`mark-paid-${req.id}`}>Paid</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "OVERDUE")}
                                className="text-[#EF4444] hover:bg-[#FEF2F2] h-7 text-xs rounded-lg" data-testid={`mark-overdue-${req.id}`}>Overdue</Button>
                            </>
                          )}
                          {req.status === "OVERDUE" && (
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "PAID")}
                              className="text-[#10B981] hover:bg-[#ECFDF5] h-7 text-xs rounded-lg">Paid</Button>
                          )}
                          {(req.status === "PENDING" || req.status === "OVERDUE") && (
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "CANCELLED")}
                              className="text-[#6B7280] hover:bg-[#F3F4F6] h-7 text-xs rounded-lg">Cancel</Button>
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
          <DialogHeader><DialogTitle className="font-['Nunito'] text-xl font-bold">Send Payment Request</DialogTitle></DialogHeader>
          <form onSubmit={handleSendRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Client Name *</Label>
                <Input value={requestForm.client_name} onChange={e => setRequestForm({ ...requestForm, client_name: e.target.value })} required
                  placeholder="Client full name" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-client-name" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Client Email *</Label>
                <Input type="email" value={requestForm.client_email} onChange={e => setRequestForm({ ...requestForm, client_email: e.target.value })} required
                  placeholder="client@example.com" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-client-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Amount ($) *</Label>
                <Input type="number" step="0.01" min="0.01" value={requestForm.amount} onChange={e => setRequestForm({ ...requestForm, amount: e.target.value })} required
                  placeholder="0.00" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-amount" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Due Date</Label>
                <Input type="date" value={requestForm.due_date} onChange={e => setRequestForm({ ...requestForm, due_date: e.target.value })}
                  className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="request-due-date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Description *</Label>
              <Textarea value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} required
                placeholder="What is this payment for?" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[80px] rounded-lg" data-testid="request-description" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowRequestDialog(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button>
              <Button type="submit" disabled={sendingRequest}
                className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold gap-2" data-testid="send-request-submit">
                {sendingRequest ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="h-4 w-4" /> Send Request</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
