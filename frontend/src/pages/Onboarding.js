import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-6" data-testid="onboard-page">
      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center">
              <Heart className="h-5 w-5 text-white fill-white" />
            </div>
            <span className="text-2xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">HackForge</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Create Organization</h1>
          <p className="text-[#6B7280] text-sm">Set up your nonprofit's case management in seconds.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-sm text-[#DC2626]" data-testid="onboard-error" role="alert">{error}</div>}
          <div className="space-y-2">
            <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Organization Name</Label>
            <Input value={form.organization_name} onChange={update("organization_name")} placeholder="Your nonprofit name" required maxLength={100}
              className="bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316]" data-testid="onboard-org-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Admin Full Name</Label>
            <Input value={form.admin_name} onChange={update("admin_name")} placeholder="Jane Doe" required maxLength={100}
              className="bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316]" data-testid="onboard-name-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Email</Label>
            <Input type="email" value={form.email} onChange={update("email")} placeholder="admin@example.org" required
              className="bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316]" data-testid="onboard-email-input" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Password</Label>
            <Input type="password" value={form.password} onChange={update("password")} placeholder="Minimum 8 characters" required minLength={8}
              className="bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316]" data-testid="onboard-password-input" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white font-bold rounded-xl gap-2 shadow-md shadow-orange-200" data-testid="onboard-submit-btn">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Organization <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
        <p className="text-center text-sm text-[#9CA3AF]">
          Already have an account? <Link to="/login" className="text-[#F97316] hover:underline font-semibold" data-testid="login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
