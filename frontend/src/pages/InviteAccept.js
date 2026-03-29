import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const { data } = await api.get(`/invitations/validate/${token}`);
        setInvite({ ...data, organization: "HackForge" });
        setForm({ ...form, name: data.name }); // Pre-fill name from invitation
      }
      catch (err) { setError(formatApiError(err.response?.data?.detail) || "Invalid or expired invite link"); }
      finally { setLoading(false); }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true); setError("");
    try {
      await api.post(`/invitations/accept`, { token, password: form.password });
      toast.success("Account created successfully! Please log in.");
      navigate("/login");
    } catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-6" data-testid="invite-accept-page">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center"><Heart className="h-5 w-5 text-white fill-white" /></div>
            <span className="text-2xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">HackForge</span>
          </div>
          {error && !invite ? (
            <div className="p-6 bg-white border border-[#E8E8E8] rounded-xl text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-[#EF4444] mx-auto" />
              <p className="text-[#6B7280]">{error}</p>
              <Button onClick={() => navigate("/login")} variant="outline" className="border-[#E5E7EB] text-[#6B7280] rounded-lg">Go to Login</Button>
            </div>
          ) : invite && (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Join {invite.organization}</h1>
              <p className="text-[#6B7280] text-sm">You've been invited as a <span className="text-[#F97316] font-bold">{invite.role?.replace("_", " ")}</span>. Set up your account to get started.</p>
              <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                {error && <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-sm text-[#DC2626]" role="alert">{error}</div>}
                <div className="space-y-2">
                  <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Email</Label>
                  <Input value={invite.email} disabled className="bg-[#F3F4F6] border-[#E5E7EB] text-[#9CA3AF] h-11 rounded-xl cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Full Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Your full name"
                    className="bg-white border-[#E5E7EB] text-[#1F2937] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316]" data-testid="invite-name-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Min 8 characters" minLength={8}
                    className="bg-white border-[#E5E7EB] text-[#1F2937] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316]" data-testid="invite-password-input" />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-11 bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white font-bold rounded-xl gap-2 shadow-md shadow-orange-200" data-testid="invite-accept-btn">
                  {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Join Team <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
