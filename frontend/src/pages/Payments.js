import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CreditCard, CheckCircle, Clock, AlertTriangle, Send,
  DollarSign, ArrowUpRight, Ban, FileText
} from "lucide-react";
import { toast } from "sonner";

const PACKAGES = [
  { id: "basic", name: "Basic", price: 10, description: "Essential case management", features: ["Up to 50 clients", "Basic reporting", "Email support"], interval: "month" },
  { id: "standard", name: "Standard", price: 25, description: "For growing organizations", features: ["Up to 200 clients", "Advanced analytics", "Priority support", "AI suggestions"], popular: true, interval: "month" },
  { id: "premium", name: "Premium", price: 50, description: "Full-featured suite", features: ["Unlimited clients", "AI Copilot", "Custom fields", "CSV import/export", "Dedicated support"], interval: "month" },
  { id: "enterprise", name: "Enterprise", price: 100, description: "For large nonprofits", features: ["Everything in Premium", "Multi-tenant", "SLA guarantee", "On-boarding assistance", "API access"], interval: "month" },
];

const STATUS_STYLES = {
  paid: { bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]", text: "text-[#10B981]", icon: CheckCircle },
  PAID: { bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]", text: "text-[#10B981]", icon: CheckCircle },
  PENDING: { bg: "bg-[#FFFBEB]", border: "border-[#FDE68A]", text: "text-[#F59E0B]", icon: Clock },
  INITIATED: { bg: "bg-[#FFFBEB]", border: "border-[#FDE68A]", text: "text-[#F59E0B]", icon: Clock },
  OVERDUE: { bg: "bg-[#FEF2F2]", border: "border-[#FECACA]", text: "text-[#EF4444]", icon: AlertTriangle },
  CANCELLED: { bg: "bg-[#F3F4F6]", border: "border-[#E5E7EB]", text: "text-[#6B7280]", icon: Ban },
};

export default function Payments() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [polling, setPolling] = useState(false);
  const [processingPkg, setProcessingPkg] = useState(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ client_name: "", client_email: "", amount: "", description: "", due_date: "" });
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (sessionId) {
      let attempts = 0;
      setPolling(true);
      const poll = async () => {
        if (attempts >= 5) { setPolling(false); return; }
        try {
          const { data } = await api.get(`/payments/status/${sessionId}`);
          setPaymentStatus(data);
          if (data.payment_status === "paid" || data.status === "expired") {
            setPolling(false);
            if (data.payment_status === "paid") toast.success("Payment successful!");
            fetchHistory();
            return;
          }
        } catch {}
        attempts++;
        setTimeout(poll, 2000);
      };
      poll();
    }
  }, [sessionId]);

  const fetchHistory = async () => { try { const { data } = await api.get("/payments/history"); setHistory(data); } catch {} };
  const fetchRequests = async () => { try { const { data } = await api.get("/payments/requests"); setRequests(data); } catch {} };

  useEffect(() => { fetchHistory(); fetchRequests(); }, []);

  const handleCheckout = async (packageId) => {
    setProcessingPkg(packageId);
    try {
      const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin, package_id: packageId });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
      setProcessingPkg(null);
    }
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    setSendingRequest(true);
    try {
      await api.post("/payments/request", {
        ...requestForm,
        amount: parseFloat(requestForm.amount),
      });
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

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Payments</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">Manage subscriptions, billing, and payment requests</p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
          <Button onClick={() => setShowRequestDialog(true)}
            className="bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200"
            data-testid="send-payment-request-btn">
            <Send className="h-4 w-4" /> Send Payment Request
          </Button>
        )}
      </div>

      {sessionId && (
        <div className={`p-4 rounded-xl border ${paymentStatus?.payment_status === "paid" ? "bg-[#ECFDF5] border-[#A7F3D0]" : polling ? "bg-[#FFFBEB] border-[#FDE68A]" : "bg-white border-[#E8E8E8]"}`} data-testid="payment-status-banner">
          <div className="flex items-center gap-3">
            {paymentStatus?.payment_status === "paid" ? <><CheckCircle className="h-5 w-5 text-[#10B981]" /><span className="text-sm text-[#10B981] font-semibold">Payment successful! Thank you.</span></>
              : polling ? <><div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" /><span className="text-sm text-[#F59E0B]">Processing payment...</span></>
              : <><AlertTriangle className="h-5 w-5 text-[#6B7280]" /><span className="text-sm text-[#6B7280]">Payment status check completed.</span></>}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-received">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">Received</span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] flex items-center justify-center"><DollarSign className="h-4 w-4 text-[#10B981]" /></div>
          </div>
          <p className="data-metric text-[#10B981]">${totalReceived.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-pending">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center"><Clock className="h-4 w-4 text-[#F59E0B]" /></div>
          </div>
          <p className="data-metric text-[#F59E0B]">${totalPending.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 stat-card" data-testid="payment-summary-overdue">
          <div className="flex items-center justify-between mb-2">
            <span className="overline">Overdue</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-[#EF4444]" /></div>
          </div>
          <p className="data-metric text-[#EF4444]">${totalOverdue.toFixed(2)}</p>
        </div>
      </div>

      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList className="bg-white border border-[#E8E8E8] p-1 rounded-xl" data-testid="payment-tabs">
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Subscriptions
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Payment Requests
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">
            <DollarSign className="h-3.5 w-3.5 mr-1.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKAGES.map((pkg) => (
              <div key={pkg.id} className={`bg-white border rounded-xl p-5 flex flex-col transition-all hover:shadow-lg ${pkg.popular ? "border-[#F97316] shadow-md shadow-orange-100" : "border-[#E8E8E8]"}`} data-testid={`package-${pkg.id}`}>
                {pkg.popular && <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316] mb-2">Most Popular</span>}
                <h3 className="text-lg font-bold font-['Nunito'] text-[#1F2937]">{pkg.name}</h3>
                <div className="my-2">
                  <span className="data-metric">${pkg.price}</span>
                  <span className="text-sm text-[#9CA3AF] font-normal">/{pkg.interval}</span>
                </div>
                <p className="text-xs text-[#9CA3AF] mb-4">{pkg.description}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {pkg.features.map((f, i) => (
                    <li key={i} className="text-xs text-[#6B7280] flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-[#10B981] mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Button onClick={() => handleCheckout(pkg.id)} disabled={processingPkg === pkg.id}
                  className={`w-full rounded-lg font-bold ${pkg.popular ? "bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white shadow-md shadow-orange-200" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED]"}`}
                  data-testid={`checkout-${pkg.id}`}>
                  {processingPkg === pkg.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Subscribe <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></>}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Payment Requests Tab */}
        <TabsContent value="requests" className="mt-4">
          {requests.length === 0 ? (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center" data-testid="no-payment-requests">
              <FileText className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" />
              <p className="text-[#6B7280] mb-2">No payment requests yet</p>
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
                  {requests.map((req) => {
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
                                    className="text-[#10B981] hover:bg-[#ECFDF5] h-7 text-xs rounded-lg" data-testid={`mark-paid-${req.id}`}>
                                    Paid
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleUpdateRequestStatus(req.id, "OVERDUE")}
                                    className="text-[#EF4444] hover:bg-[#FEF2F2] h-7 text-xs rounded-lg" data-testid={`mark-overdue-${req.id}`}>
                                    Overdue
                                  </Button>
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
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
              <DollarSign className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" />
              <p className="text-[#6B7280]">No subscription payments yet</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden" data-testid="payment-history-table">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Package</th>
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Amount</th>
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Status</th>
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p, i) => (
                    <tr key={i} className="border-b border-[#F9FAFB] table-row-hover">
                      <td className="p-4 text-sm text-[#1F2937] capitalize font-medium">{p.package_id}</td>
                      <td className="p-4 text-sm text-[#1F2937] font-mono font-bold">${p.amount?.toFixed(2)}</td>
                      <td className="p-4">
                        <Badge variant="outline" className={`text-xs rounded-full ${p.payment_status === "paid" ? "border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5]" : "border-[#FDE68A] text-[#F59E0B] bg-[#FFFBEB]"}`}>
                          {p.payment_status || "pending"}
                        </Badge>
                      </td>
                      <td className="p-4 text-xs text-[#9CA3AF] font-mono hidden sm:table-cell">{p.created_at?.split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
