import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get(`/invitations/validate/${token}`);
        setInvitation(data);
      } catch (err) {
        setError(formatApiError(err.response?.data?.detail) || "Invalid or expired invitation");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleAccept = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setAccepting(true);
    try {
      await api.post("/invitations/accept", { token, password });
      setSuccess(true);
      toast.success("Account created successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF7ED] to-[#F0FDFA]">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="h-12 w-12 text-[#F97316] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Validating invitation...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF7ED] to-[#F0FDFA] p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertCircle className="h-12 w-12 text-[#EF4444] mx-auto mb-4" />
          <h1 className="text-xl font-bold font-['Nunito'] text-[#1F2937] mb-2">Invalid Invitation</h1>
          <p className="text-[#6B7280] mb-6">{error}</p>
          <Button onClick={() => navigate("/login")} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF7ED] to-[#F0FDFA] p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle className="h-12 w-12 text-[#10B981] mx-auto mb-4" />
          <h1 className="text-xl font-bold font-['Nunito'] text-[#1F2937] mb-2">Welcome to HackForge!</h1>
          <p className="text-[#6B7280] mb-4">Your account has been created successfully.</p>
          <p className="text-sm text-[#9CA3AF]">Redirecting to login...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF7ED] to-[#F0FDFA] p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F97316] to-[#FB923C] flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold font-['Nunito'] text-[#1F2937] mb-2">
            You're Invited!
          </h1>
          <p className="text-sm text-[#6B7280]">
            {invitation?.invited_by} has invited you to join HackForge
          </p>
        </div>

        <div className="bg-[#F9FAFB] rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Name:</span>
            <span className="font-semibold text-[#1F2937]">{invitation?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Email:</span>
            <span className="font-semibold text-[#1F2937]">{invitation?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Role:</span>
            <span className="font-semibold text-[#1F2937]">{invitation?.role}</span>
          </div>
        </div>

        <form onSubmit={handleAccept} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">
              Create Password *
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Enter your password"
              className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">
              Confirm Password *
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm your password"
              className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg"
            />
          </div>

          <Button
            type="submit"
            disabled={accepting || !password || !confirmPassword}
            className="w-full bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold h-11"
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <p className="text-xs text-[#9CA3AF] text-center mt-4">
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#F97316] hover:underline font-semibold"
          >
            Sign in
          </button>
        </p>
      </Card>
    </div>
  );
}
