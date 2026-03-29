import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PACKAGES = [
  { id: "basic", name: "Basic", price: "$10", description: "Essential case management", features: ["Up to 50 clients", "Basic reporting", "Email support"] },
  { id: "standard", name: "Standard", price: "$25", description: "For growing organizations", features: ["Up to 200 clients", "Advanced analytics", "Priority support", "AI suggestions"], popular: true },
  { id: "premium", name: "Premium", price: "$50", description: "Full-featured suite", features: ["Unlimited clients", "AI Copilot", "Custom fields", "CSV import/export", "Dedicated support"] },
  { id: "enterprise", name: "Enterprise", price: "$100", description: "For large nonprofits", features: ["Everything in Premium", "Multi-tenant", "SLA guarantee", "On-boarding assistance", "API access"] },
];

export default function Payments() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [polling, setPolling] = useState(false);
  const [processingPkg, setProcessingPkg] = useState(null);

  useEffect(() => {
    if (sessionId) {
      let attempts = 0; setPolling(true);
      const poll = async () => { if (attempts >= 5) { setPolling(false); return; } try { const { data } = await api.get(`/payments/status/${sessionId}`); setPaymentStatus(data); if (data.payment_status === "paid" || data.status === "expired") { setPolling(false); if (data.payment_status === "paid") toast.success("Payment successful!"); fetchHistory(); return; } } catch {} attempts++; setTimeout(poll, 2000); };
      poll();
    }
  }, [sessionId]);

  const fetchHistory = async () => { try { const { data } = await api.get("/payments/history"); setHistory(data); } catch {} };
  useEffect(() => { fetchHistory(); }, []);

  const handleCheckout = async (packageId) => { setProcessingPkg(packageId); try { const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin, package_id: packageId }); if (data.url) window.location.href = data.url; } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); setProcessingPkg(null); } };

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div><h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Payments</h1><p className="text-sm text-[#9CA3AF] mt-1">Manage your subscription and billing</p></div>

      {sessionId && (
        <div className={`p-4 rounded-xl border ${paymentStatus?.payment_status === "paid" ? "bg-[#ECFDF5] border-[#A7F3D0]" : polling ? "bg-[#FFFBEB] border-[#FDE68A]" : "bg-white border-[#E8E8E8]"}`} data-testid="payment-status-banner">
          <div className="flex items-center gap-3">
            {paymentStatus?.payment_status === "paid" ? <><CheckCircle className="h-5 w-5 text-[#10B981]" /><span className="text-sm text-[#10B981] font-semibold">Payment successful! Thank you.</span></>
              : polling ? <><div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" /><span className="text-sm text-[#F59E0B]">Processing payment...</span></>
              : <><AlertTriangle className="h-5 w-5 text-[#6B7280]" /><span className="text-sm text-[#6B7280]">Payment status check completed.</span></>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PACKAGES.map((pkg) => (
          <div key={pkg.id} className={`bg-white border rounded-xl p-5 flex flex-col transition-all hover:shadow-lg ${pkg.popular ? "border-[#F97316] shadow-md shadow-orange-100" : "border-[#E8E8E8]"}`} data-testid={`package-${pkg.id}`}>
            {pkg.popular && <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316] mb-2">Most Popular</span>}
            <h3 className="text-lg font-bold font-['Nunito'] text-[#1F2937]">{pkg.name}</h3>
            <p className="data-metric my-2">{pkg.price}<span className="text-sm text-[#9CA3AF] font-normal">/mo</span></p>
            <p className="text-xs text-[#9CA3AF] mb-4">{pkg.description}</p>
            <ul className="space-y-2 mb-6 flex-1">{pkg.features.map((f, i) => <li key={i} className="text-xs text-[#6B7280] flex items-start gap-2"><CheckCircle className="h-3 w-3 text-[#10B981] mt-0.5 shrink-0" />{f}</li>)}</ul>
            <Button onClick={() => handleCheckout(pkg.id)} disabled={processingPkg === pkg.id}
              className={`w-full rounded-lg font-bold ${pkg.popular ? "bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white shadow-md shadow-orange-200" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED]"}`} data-testid={`checkout-${pkg.id}`}>
              {processingPkg === pkg.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Subscribe"}
            </Button>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div><h2 className="text-lg font-bold font-['Nunito'] text-[#1F2937] mb-4">Payment History</h2>
          <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
            <table className="w-full"><thead><tr className="border-b border-[#F3F4F6]"><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Package</th><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Amount</th><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Status</th><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hidden sm:table-cell">Date</th></tr></thead>
              <tbody>{history.map((p, i) => <tr key={i} className="border-b border-[#F9FAFB]"><td className="p-4 text-sm text-[#1F2937] capitalize font-medium">{p.package_id}</td><td className="p-4 text-sm text-[#1F2937] font-mono font-bold">${p.amount?.toFixed(2)}</td><td className="p-4"><Badge variant="outline" className={`text-xs rounded-full ${p.payment_status === "paid" ? "border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5]" : "border-[#FDE68A] text-[#F59E0B] bg-[#FFFBEB]"}`}>{p.payment_status || "pending"}</Badge></td><td className="p-4 text-xs text-[#9CA3AF] font-mono hidden sm:table-cell">{p.created_at?.split("T")[0]}</td></tr>)}</tbody>
            </table></div></div>)}
    </div>
  );
}
