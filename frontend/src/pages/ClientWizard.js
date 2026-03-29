import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  User, MapPin, Briefcase, CalendarDays,
  ChevronLeft, ChevronRight, Check, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "demographics", label: "Demographics", icon: MapPin },
  { id: "services", label: "Initial Services", icon: Briefcase },
  { id: "visit", label: "First Visit", icon: CalendarDays },
];

const SERVICE_OPTIONS = [
  "Housing Assistance", "Mental Health Counseling", "Job Training", "Legal Aid",
  "Food Assistance", "Health Screening", "Financial Literacy", "ESL Classes",
  "Childcare Support", "Transportation Aid", "Substance Abuse Counseling",
];

export default function ClientWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("next");
  const [workers, setWorkers] = useState([]);

  const [form, setForm] = useState({
    personal: { first_name: "", last_name: "", email: "", phone: "", address: "", emergency_contact: "", notes: "" },
    demographics: { age_group: "", gender: "", ethnicity: "", housing_status: "", income_level: "", preferred_language: "English" },
    services: { service_types: [], assigned_worker: user?.name || "", priority: "NORMAL" },
    visit: { date: "", duration: 60, location: "", notes: "" },
  });

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        if (user?.role === "ADMIN") {
          const { data } = await api.get("/admin/users");
          setWorkers(data.filter(u => u.role === "CASE_WORKER" || u.role === "ADMIN"));
        }
      } catch {}
    };
    fetchWorkers();
  }, [user]);

  const updateField = useCallback((section, field, value) => {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  }, []);

  const toggleService = useCallback((svc) => {
    setForm(prev => {
      const list = prev.services.service_types;
      const newList = list.includes(svc) ? list.filter(s => s !== svc) : [...list, svc];
      return { ...prev, services: { ...prev.services, service_types: newList } };
    });
  }, []);

  const goNext = () => {
    if (step === 0 && !form.personal.first_name.trim()) {
      toast.error("First name is required"); return;
    }
    setDirection("next");
    setAnimating(true);
    setTimeout(() => { setStep(s => Math.min(s + 1, STEPS.length - 1)); setAnimating(false); }, 200);
  };

  const goBack = () => {
    setDirection("back");
    setAnimating(true);
    setTimeout(() => { setStep(s => Math.max(s - 1, 0)); setAnimating(false); }, 200);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.visit.date) payload.visit = null;
      if (payload.services.service_types.length === 0) payload.services = null;
      const { data } = await api.post("/clients/wizard", payload);
      toast.success(data.message);
      navigate(`/clients/${data.client.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSubmitting(false); }
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = STEPS[step].icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="client-wizard-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clients")} className="text-[#9CA3AF] rounded-lg" data-testid="wizard-back-btn">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Client Onboarding</h1>
          <p className="text-sm text-[#9CA3AF] mt-0.5">Step-by-step client intake wizard</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { if (i < step) { setDirection("back"); setAnimating(true); setTimeout(() => { setStep(i); setAnimating(false); }, 200); } }}
              className={`flex items-center gap-2 text-xs font-bold transition-all ${
                i === step ? "text-[#F97316]" : i < step ? "text-[#10B981] cursor-pointer" : "text-[#D1D5DB]"
              }`}
              data-testid={`wizard-step-${s.id}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i === step ? "bg-gradient-to-br from-[#F97316] to-[#FB923C] text-white shadow-md shadow-orange-200"
                : i < step ? "bg-[#10B981] text-white" : "bg-[#F3F4F6] text-[#D1D5DB]"
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
        <Progress value={progress} className="h-1.5 bg-[#F3F4F6]" data-testid="wizard-progress" />
      </div>

      {/* Step Content */}
      <div className={`bg-white border border-[#E8E8E8] rounded-xl p-6 transition-all duration-200 ${animating ? (direction === "next" ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4") : "opacity-100 translate-x-0"}`} data-testid="wizard-step-content">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center">
            <StepIcon className="h-5 w-5 text-[#F97316]" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-['Nunito'] text-[#1F2937]">{STEPS[step].label}</h2>
            <p className="text-xs text-[#9CA3AF]">
              {step === 0 && "Basic contact and personal information"}
              {step === 1 && "Demographic details for reporting and eligibility"}
              {step === 2 && "Select initial services for this client"}
              {step === 3 && "Schedule the first in-person or virtual visit"}
            </p>
          </div>
        </div>

        {/* Step 1: Personal Info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">First Name *</Label>
                <Input value={form.personal.first_name} onChange={e => updateField("personal", "first_name", e.target.value)}
                  placeholder="First name" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-first-name" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Last Name</Label>
                <Input value={form.personal.last_name} onChange={e => updateField("personal", "last_name", e.target.value)}
                  placeholder="Last name" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-last-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Email</Label>
                <Input type="email" value={form.personal.email} onChange={e => updateField("personal", "email", e.target.value)}
                  placeholder="client@example.com" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-email" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Phone</Label>
                <Input value={form.personal.phone} onChange={e => updateField("personal", "phone", e.target.value)}
                  placeholder="+1 (555) 000-0000" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Address</Label>
              <Input value={form.personal.address} onChange={e => updateField("personal", "address", e.target.value)}
                placeholder="Full street address" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-address" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Emergency Contact</Label>
              <Input value={form.personal.emergency_contact} onChange={e => updateField("personal", "emergency_contact", e.target.value)}
                placeholder="Name & phone number" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-emergency" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Notes</Label>
              <Textarea value={form.personal.notes} onChange={e => updateField("personal", "notes", e.target.value)}
                placeholder="Referral source, special considerations..." className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[80px] rounded-lg" data-testid="wizard-notes" />
            </div>
          </div>
        )}

        {/* Step 2: Demographics */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Age Group</Label>
                <Select value={form.demographics.age_group} onValueChange={v => updateField("demographics", "age_group", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-age-group"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {["Under 18", "18-25", "26-35", "36-45", "46-55", "56-65", "65+"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Gender</Label>
                <Select value={form.demographics.gender} onValueChange={v => updateField("demographics", "gender", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-gender"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Ethnicity</Label>
                <Select value={form.demographics.ethnicity} onValueChange={v => updateField("demographics", "ethnicity", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-ethnicity"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {["Hispanic/Latino", "Black/African American", "White/Caucasian", "Asian", "Native American", "Pacific Islander", "Mixed/Multi-racial", "Other", "Prefer not to say"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Housing Status</Label>
                <Select value={form.demographics.housing_status} onValueChange={v => updateField("demographics", "housing_status", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-housing"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {["Housed - Own", "Housed - Rent", "Temporary/Transitional", "Shelter", "Unhoused", "Other"].map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Income Level</Label>
                <Select value={form.demographics.income_level} onValueChange={v => updateField("demographics", "income_level", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-income"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {["No income", "Below poverty line", "Low income", "Moderate income", "Above moderate", "Prefer not to say"].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Preferred Language</Label>
                <Select value={form.demographics.preferred_language} onValueChange={v => updateField("demographics", "preferred_language", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-language"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {["English", "Spanish", "Mandarin", "French", "Arabic", "Vietnamese", "Korean", "Tagalog", "Other"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Initial Services */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Select Services</Label>
              <div className="grid grid-cols-2 gap-2" data-testid="wizard-services-grid">
                {SERVICE_OPTIONS.map(svc => (
                  <label key={svc} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    form.services.service_types.includes(svc) ? "border-[#F97316] bg-[#FFF7ED]" : "border-[#E5E7EB] bg-[#FAFAF8] hover:border-[#F9731680]"
                  }`} data-testid={`wizard-service-${svc.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Checkbox checked={form.services.service_types.includes(svc)} onCheckedChange={() => toggleService(svc)}
                      className="border-[#D1D5DB] data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]" />
                    <span className="text-sm text-[#1F2937]">{svc}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.services.service_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.services.service_types.map(s => (
                  <Badge key={s} variant="outline" className="border-[#F97316]/30 text-[#F97316] bg-[#FFF7ED] text-xs rounded-full">{s}</Badge>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Assigned Worker</Label>
                {workers.length > 0 ? (
                  <Select value={form.services.assigned_worker} onValueChange={v => updateField("services", "assigned_worker", v)}>
                    <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-assigned-worker"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                      {workers.map(w => <SelectItem key={w.id} value={w.name}>{w.name} ({w.role?.replace("_", " ")})</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.services.assigned_worker} onChange={e => updateField("services", "assigned_worker", e.target.value)}
                    placeholder="Case worker name" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-assigned-worker" />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Priority</Label>
                <Select value={form.services.priority} onValueChange={v => updateField("services", "priority", v)}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-priority"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: First Visit */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Visit Date & Time</Label>
                <Input type="datetime-local" value={form.visit.date} onChange={e => updateField("visit", "date", e.target.value)}
                  className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-visit-date" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Duration (min)</Label>
                <Select value={String(form.visit.duration)} onValueChange={v => updateField("visit", "duration", parseInt(v))}>
                  <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-visit-duration"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                    {[15, 30, 45, 60, 90, 120].map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Location</Label>
              <Input value={form.visit.location} onChange={e => updateField("visit", "location", e.target.value)}
                placeholder="Office, home visit, virtual..." className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="wizard-visit-location" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Visit Notes</Label>
              <Textarea value={form.visit.notes} onChange={e => updateField("visit", "notes", e.target.value)}
                placeholder="Purpose of first visit, items to bring..." className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[80px] rounded-lg" data-testid="wizard-visit-notes" />
            </div>

            {/* Review Summary */}
            <div className="mt-4 p-4 bg-[#F0FDFA] border border-[#99F6E4] rounded-xl space-y-3" data-testid="wizard-review-summary">
              <h3 className="text-sm font-bold text-[#0D9488] font-['Nunito']">Review Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#9CA3AF] uppercase tracking-wider font-bold">Client</span>
                  <p className="text-[#1F2937] font-semibold mt-0.5">{form.personal.first_name} {form.personal.last_name}</p>
                </div>
                {form.personal.email && <div>
                  <span className="text-[#9CA3AF] uppercase tracking-wider font-bold">Email</span>
                  <p className="text-[#1F2937] font-semibold mt-0.5">{form.personal.email}</p>
                </div>}
                {form.demographics.age_group && <div>
                  <span className="text-[#9CA3AF] uppercase tracking-wider font-bold">Age Group</span>
                  <p className="text-[#1F2937] font-semibold mt-0.5">{form.demographics.age_group}</p>
                </div>}
                {form.demographics.housing_status && <div>
                  <span className="text-[#9CA3AF] uppercase tracking-wider font-bold">Housing</span>
                  <p className="text-[#1F2937] font-semibold mt-0.5">{form.demographics.housing_status}</p>
                </div>}
                {form.services.service_types.length > 0 && <div className="col-span-2">
                  <span className="text-[#9CA3AF] uppercase tracking-wider font-bold">Services</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {form.services.service_types.map(s => <Badge key={s} variant="outline" className="border-[#14B8A6]/30 text-[#0D9488] bg-[#F0FDFA] text-[10px] rounded-full">{s}</Badge>)}
                  </div>
                </div>}
                {form.visit.date && <div>
                  <span className="text-[#9CA3AF] uppercase tracking-wider font-bold">First Visit</span>
                  <p className="text-[#1F2937] font-semibold mt-0.5">{new Date(form.visit.date).toLocaleString()}</p>
                </div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={step === 0 ? () => navigate("/clients") : goBack}
          className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] gap-2 rounded-lg" data-testid="wizard-prev-btn">
          <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={goNext}
            className="bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200"
            data-testid="wizard-next-btn">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}
            className="bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] hover:from-[#0D9488] hover:to-[#14B8A6] text-white gap-2 rounded-lg font-bold shadow-md shadow-teal-200"
            data-testid="wizard-submit-btn">
            {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="h-4 w-4" /> Complete Onboarding</>}
          </Button>
        )}
      </div>
    </div>
  );
}
