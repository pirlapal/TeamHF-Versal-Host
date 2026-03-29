import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, ArrowRight, AlertTriangle } from "lucide-react";
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
        const { data } = await api.get(`/invites/${token}`);
        setInvite(data);
      } catch (err) {
        setError(formatApiError(err.response?.data?.detail) || "Invalid or expired invite link");
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post(`/invites/${token}/accept`, form);
      if (data.access_token) localStorage.setItem("access_token", data.access_token);
      await checkAuth();
      toast.success("Welcome to the team!");
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0055FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6" data-testid="invite-accept-page">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-8">
            <Hexagon className="h-8 w-8 text-[#0055FF]" />
            <span className="text-2xl font-semibold font-['Outfit'] tracking-tight">CaseFlow</span>
          </div>

          {error && !invite ? (
            <div className="p-6 bg-[#141415] border border-[#2A2A2D] rounded-sm text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-[#FF1744] mx-auto" />
              <p className="text-[#A0A0A5]">{error}</p>
              <Button onClick={() => navigate("/login")} variant="outline" className="border-[#2A2A2D] text-[#A0A0A5]">
                Go to Login
              </Button>
            </div>
          ) : invite && (
            <>
              <h1 className="text-3xl sm:text-4xl font-medium font-['Outfit'] tracking-tight">Join {invite.organization}</h1>
              <p className="text-[#A0A0A5] text-sm">
                You've been invited as a <span className="text-[#0055FF] font-medium">{invite.role?.replace("_", " ")}</span>. Set up your account to get started.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                {error && (
                  <div className="p-3 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-sm text-sm text-[#FF1744]" role="alert">{error}</div>
                )}
                <div className="space-y-2">
                  <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Email</Label>
                  <Input value={invite.email} disabled className="bg-[#141415] border-[#2A2A2D] text-[#6E6E73] h-11 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Full Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Your full name"
                    className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] h-11" data-testid="invite-name-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Min 8 characters" minLength={8}
                    className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] h-11" data-testid="invite-password-input" />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-11 bg-[#0055FF] hover:bg-[#0044CC] text-white font-medium rounded-sm gap-2" data-testid="invite-accept-btn">
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
