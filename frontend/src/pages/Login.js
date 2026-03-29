import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, ArrowRight, Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen bg-[#0A0A0B] flex" data-testid="login-page">
      {/* Left panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-8">
              <Hexagon className="h-8 w-8 text-[#0055FF]" />
              <span className="text-2xl font-semibold font-['Outfit'] tracking-tight">CaseFlow</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">
              Sign in
            </h1>
            <p className="text-[#A0A0A5] text-sm">
              Enter your credentials to access your case management dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-sm text-sm text-[#FF1744]" data-testid="login-error" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.org"
                required
                className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-11 focus:ring-2 focus:ring-[#0055FF] focus:border-transparent"
                data-testid="login-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#A0A0A5] text-xs uppercase tracking-wider font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-11 pr-10 focus:ring-2 focus:ring-[#0055FF] focus:border-transparent"
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-[#A0A0A5]">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#0055FF] hover:bg-[#0044CC] text-white font-medium rounded-sm gap-2"
              data-testid="login-submit-btn"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-[#6E6E73]">
              New organization?{" "}
              <Link to="/onboard" className="text-[#0055FF] hover:underline" data-testid="onboard-link">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-[#141415] border-l border-[#2A2A2D] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 border border-[#0055FF] rotate-45" />
          <div className="absolute top-1/3 right-1/4 w-48 h-48 border border-[#00E5FF] rotate-12" />
          <div className="absolute bottom-1/4 left-1/3 w-32 h-32 border border-[#0055FF] -rotate-12" />
        </div>
        <div className="text-center space-y-4 relative z-10 px-12">
          <div className="w-20 h-20 rounded-sm bg-[#0055FF]/10 border border-[#0055FF]/30 flex items-center justify-center mx-auto">
            <Hexagon className="h-10 w-10 text-[#0055FF]" />
          </div>
          <h2 className="text-2xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">
            Case Management<br />Reimagined
          </h2>
          <p className="text-sm text-[#6E6E73] max-w-xs mx-auto">
            AI-powered insights. Multi-tenant security. Built for nonprofits that mean business.
          </p>
        </div>
      </div>
    </div>
  );
}
