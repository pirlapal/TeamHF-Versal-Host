import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex" data-testid="login-page">
      {/* Left panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center">
                <Heart className="h-5 w-5 text-white fill-white" />
              </div>
              <span className="text-2xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">HackForge</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">
              Welcome back
            </h1>
            <p className="text-[#6B7280] text-sm">
              Sign in to continue making a difference.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-sm text-[#DC2626]" data-testid="login-error" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" required
                className="bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-11 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent" data-testid="login-email-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Password</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required
                  className="bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] h-11 pr-10 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent" data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D1D5DB] hover:text-[#6B7280]">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white font-bold rounded-xl gap-2 shadow-md shadow-orange-200" data-testid="login-submit-btn">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-[#9CA3AF]">
              New organization?{" "}
              <Link to="/onboarding" className="text-[#F97316] hover:underline font-semibold" data-testid="onboard-link">Create account</Link>
            </p>
          </div>

          {/* Demo Login Shortcuts */}
          <div className="border-t border-[#F3F4F6] pt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold text-center">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => { setEmail("admin@caseflow.io"); setPassword("admin123"); }}
                className="p-2 rounded-lg border border-[#E5E7EB] hover:border-[#F97316] hover:bg-[#FFF7ED] transition-all text-center"
                data-testid="demo-login-admin">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center mx-auto mb-1"><span className="text-white text-[9px] font-bold">A</span></div>
                <span className="text-[10px] font-bold text-[#1F2937]">Admin</span>
              </button>
              <button type="button" onClick={() => { setEmail("caseworker@demo.caseflow.io"); setPassword("demo1234"); }}
                className="p-2 rounded-lg border border-[#E5E7EB] hover:border-[#14B8A6] hover:bg-[#F0FDFA] transition-all text-center"
                data-testid="demo-login-worker">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#2DD4BF] flex items-center justify-center mx-auto mb-1"><span className="text-white text-[9px] font-bold">CW</span></div>
                <span className="text-[10px] font-bold text-[#1F2937]">Case Worker</span>
              </button>
              <button type="button" onClick={() => { setEmail("volunteer@demo.caseflow.io"); setPassword("demo1234"); }}
                className="p-2 rounded-lg border border-[#E5E7EB] hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-all text-center"
                data-testid="demo-login-volunteer">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6366F1] to-[#818CF8] flex items-center justify-center mx-auto mb-1"><span className="text-white text-[9px] font-bold">V</span></div>
                <span className="text-[10px] font-bold text-[#1F2937]">Volunteer</span>
              </button>
            </div>
            <p className="text-[9px] text-[#D1D5DB] text-center">Seed demo data first from Admin Settings</p>
          </div>
        </div>
      </div>

      {/* Right panel - decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-[#FFF1E6] to-[#E0F2FE] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#F97316]/20" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-[#14B8A6]/20" />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-[#F59E0B]/20" />
        </div>
        <div className="text-center space-y-4 relative z-10 px-12">
          <div className="w-24 h-24 rounded-2xl bg-white/80 border border-[#E8E8E8] flex items-center justify-center mx-auto shadow-lg">
            <Heart className="h-12 w-12 text-[#F97316] fill-[#F97316]/20" />
          </div>
          <h2 className="text-2xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">
            Empowering<br />Communities
          </h2>
          <p className="text-sm text-[#6B7280] max-w-xs mx-auto">
            Smart case management with AI assistance. Built with love for nonprofits.
          </p>
        </div>
      </div>
    </div>
  );
}
