import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PACKAGES = [
  { id: "basic", name: "Basic", price: "$10", description: "Essential case management", features: ["Up to 50 clients", "Basic reporting", "Email support"] },
  { id: "standard", name: "Standard", price: "$25", description: "For growing organizations", features: ["Up to 200 clients", "Advanced analytics", "Priority support", "AI suggestions"] },
  { id: "premium", name: "Premium", price: "$50", description: "Full-featured suite", features: ["Unlimited clients", "AI Copilot", "Custom fields", "CSV import/export", "Dedicated support"] },
  { id: "enterprise", name: "Enterprise", price: "$100", description: "For large nonprofits", features: ["Everything in Premium", "Multi-tenant", "SLA guarantee", "On-boarding assistance", "API access"] },
];

export default function Payments() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [processingPkg, setProcessingPkg] = useState(null);

  // Poll payment status on success redirect
  useEffect(() => {
    if (sessionId) {
      let attempts = 0;
      const maxAttempts = 5;
      const pollInterval = 2000;
      setPolling(true);
      const poll = async () => {
        if (attempts >= maxAttempts) {
          setPolling(false);
          return;
        }
        try {
          const { data } = await api.get(`/payments/status/${sessionId}`);
          setPaymentStatus(data);
          if (data.payment_status === "paid" || data.status === "expired") {
            setPolling(false);
            if (data.payment_status === "paid") toast.success("Payment successful!");
            fetchHistory();
            return;
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
        attempts++;
        setTimeout(poll, pollInterval);
      };
      poll();
    }
  }, [sessionId]);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get("/payments/history");
      setHistory(data);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleCheckout = async (packageId) => {
    setProcessingPkg(packageId);
    try {
      const origin = window.location.origin;
      const { data } = await api.post("/payments/checkout", { origin_url: origin, package_id: packageId });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
      setProcessingPkg(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">Payments</h1>
        <p className="text-sm text-[#6E6E73] mt-1">Manage your subscription and billing</p>
      </div>

      {/* Payment Status Banner */}
      {sessionId && (
        <div className={`p-4 rounded-sm border ${paymentStatus?.payment_status === "paid" ? "bg-[#00E676]/10 border-[#00E676]/30" : polling ? "bg-[#FFEA00]/10 border-[#FFEA00]/30" : "bg-[#141415] border-[#2A2A2D]"}`} data-testid="payment-status-banner">
          <div className="flex items-center gap-3">
            {paymentStatus?.payment_status === "paid" ? (
              <><CheckCircle className="h-5 w-5 text-[#00E676]" /><span className="text-sm text-[#00E676] font-medium">Payment successful! Thank you.</span></>
            ) : polling ? (
              <><div className="w-4 h-4 border-2 border-[#FFEA00]/30 border-t-[#FFEA00] rounded-full animate-spin" /><span className="text-sm text-[#FFEA00]">Processing payment...</span></>
            ) : (
              <><AlertTriangle className="h-5 w-5 text-[#A0A0A5]" /><span className="text-sm text-[#A0A0A5]">Payment status check completed.</span></>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PACKAGES.map((pkg) => (
          <div key={pkg.id} className={`bg-[#141415] border rounded-sm p-5 flex flex-col ${pkg.id === "standard" ? "border-[#0055FF] glow-blue" : "border-[#2A2A2D]"}`} data-testid={`package-${pkg.id}`}>
            {pkg.id === "standard" && <span className="text-[10px] font-bold uppercase tracking-wider text-[#0055FF] mb-2">Most Popular</span>}
            <h3 className="text-lg font-medium font-['Outfit'] text-[#F9F9FB]">{pkg.name}</h3>
            <p className="data-metric my-2">{pkg.price}<span className="text-sm text-[#6E6E73] font-normal">/mo</span></p>
            <p className="text-xs text-[#6E6E73] mb-4">{pkg.description}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {pkg.features.map((f, i) => (
                <li key={i} className="text-xs text-[#A0A0A5] flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-[#00E676] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handleCheckout(pkg.id)}
              disabled={processingPkg === pkg.id}
              className={`w-full rounded-sm ${pkg.id === "standard" ? "bg-[#0055FF] hover:bg-[#0044CC]" : "bg-transparent border border-[#2A2A2D] hover:bg-white/5 text-[#A0A0A5]"}`}
              data-testid={`checkout-${pkg.id}`}
            >
              {processingPkg === pkg.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Subscribe"}
            </Button>
          </div>
        ))}
      </div>

      {/* Payment History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-medium font-['Outfit'] text-[#F9F9FB] mb-4">Payment History</h2>
          <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A2D]">
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Package</th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Amount</th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Status</th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73] hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p, i) => (
                  <tr key={i} className="border-b border-[#2A2A2D]/50">
                    <td className="p-4 text-sm text-[#F9F9FB] capitalize">{p.package_id}</td>
                    <td className="p-4 text-sm text-[#F9F9FB] font-mono">${p.amount?.toFixed(2)}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={`text-xs ${p.payment_status === "paid" ? "border-[#00E676]/30 text-[#00E676] bg-[#00E676]/10" : "border-[#FFEA00]/30 text-[#FFEA00] bg-[#FFEA00]/10"}`}>
                        {p.payment_status || "pending"}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs text-[#6E6E73] font-mono hidden sm:table-cell">{p.created_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
