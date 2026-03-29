import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const { onboard } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organization_name: "", admin_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await onboard(form);
      toast.success("Organization created! Welcome aboard.");
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6" data-testid="onboard-page">
      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-8">
            <Hexagon className="h-8 w-8 text-[#0055FF]" />
            <span className="text-2xl font-semibold font-['Outfit'] tracking-tight">CaseFlow</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium font-['Outfit'] tracking-tight">Create Organization</h1>
          <p className="text-[#A0A0A5] text-sm">Set up your nonprofit's case management system in seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-sm text-sm text-[#FF1744]" data-testid="onboard-error" role="alert">{error}</div>
          )}
          <div className="space-y-2">
            <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Organization Name</Label>
            <Input value={form.organization_name} onChange={update("organization_name")} placeholder="Your nonprofit name" required maxLength={100}
              className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-11 focus:ring-2 focus:ring-[#0055FF]" data-testid="onboard-org-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Admin Full Name</Label>
            <Input value={form.admin_name} onChange={update("admin_name")} placeholder="Jane Doe" required maxLength={100}
              className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-11 focus:ring-2 focus:ring-[#0055FF]" data-testid="onboard-name-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Email</Label>
            <Input type="email" value={form.email} onChange={update("email")} placeholder="admin@example.org" required
              className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-11 focus:ring-2 focus:ring-[#0055FF]" data-testid="onboard-email-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Password</Label>
            <Input type="password" value={form.password} onChange={update("password")} placeholder="Minimum 8 characters" required minLength={8}
              className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-11 focus:ring-2 focus:ring-[#0055FF]" data-testid="onboard-password-input" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-[#0055FF] hover:bg-[#0044CC] text-white font-medium rounded-sm gap-2" data-testid="onboard-submit-btn">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Organization <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>

        <p className="text-center text-sm text-[#6E6E73]">
          Already have an account? <Link to="/login" className="text-[#0055FF] hover:underline" data-testid="login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
