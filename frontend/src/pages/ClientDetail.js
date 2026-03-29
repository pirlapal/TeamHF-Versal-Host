import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Archive, Plus, CheckCircle, Clock, XCircle, Target, Paperclip, Upload, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  NOT_STARTED: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  IN_PROGRESS: "bg-[#FFFBEB] text-[#F59E0B] border-[#FDE68A]",
  ACHIEVED: "bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]",
  NOT_ACHIEVED: "bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]",
  SCHEDULED: "bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE]",
  COMPLETED: "bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]",
  CANCELLED: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  OPEN: "bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE]",
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({});
  const [serviceForm, setServiceForm] = useState({ service_date: new Date().toISOString().split("T")[0], service_type: "", provider_name: "", notes: "" });
  const [outcomeForm, setOutcomeForm] = useState({ goal_description: "", target_date: "", status: "NOT_STARTED" });
  const [followUpForm, setFollowUpForm] = useState({ title: "", description: "", due_date: "", urgency: "NORMAL" });

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [clientRes, servicesRes, outcomesRes, fuRes, attRes] = await Promise.all([
          api.get(`/clients/${id}`), api.get(`/clients/${id}/services`), api.get(`/clients/${id}/outcomes`),
          api.get(`/clients/${id}/follow-ups`), api.get(`/clients/${id}/attachments`),
        ]);
        setClient(clientRes.data); setServices(servicesRes.data); setOutcomes(outcomesRes.data);
        setFollowUps(fuRes.data); setAttachments(attRes.data); setEditData(clientRes.data);
      } catch (err) { toast.error("Failed to load client"); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [id]);

  const handleApprove = async () => { try { const { data } = await api.patch(`/clients/${id}`, { pending: false }); setClient(data); toast.success("Client approved"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleArchive = async () => { try { await api.delete(`/clients/${id}`); toast.success("Client archived"); navigate("/clients"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleEdit = async (e) => { e.preventDefault(); try { const { data } = await api.patch(`/clients/${id}`, { name: editData.name, email: editData.email, phone: editData.phone, address: editData.address, notes: editData.notes }); setClient(data); setShowEdit(false); toast.success("Client updated"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleAddService = async (e) => { e.preventDefault(); try { const { data } = await api.post(`/clients/${id}/services`, serviceForm); setServices([data, ...services]); setShowServiceForm(false); setServiceForm({ service_date: new Date().toISOString().split("T")[0], service_type: "", provider_name: "", notes: "" }); toast.success("Service logged"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleAddOutcome = async (e) => { e.preventDefault(); try { const { data } = await api.post(`/clients/${id}/outcomes`, outcomeForm); setOutcomes([data, ...outcomes]); setShowOutcomeForm(false); setOutcomeForm({ goal_description: "", target_date: "", status: "NOT_STARTED" }); toast.success("Outcome created"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleAddFollowUp = async (e) => { e.preventDefault(); try { const { data } = await api.post(`/clients/${id}/follow-ups`, followUpForm); setFollowUps([data, ...followUps]); setShowFollowUpForm(false); setFollowUpForm({ title: "", description: "", due_date: "", urgency: "NORMAL" }); toast.success("Follow-up created"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleFileUpload = async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10*1024*1024) { toast.error("File too large (max 10MB)"); return; } setUploading(true); try { const fd = new FormData(); fd.append("file", file); const { data } = await api.post(`/clients/${id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } }); setAttachments([data, ...attachments]); toast.success("File uploaded"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } finally { setUploading(false); e.target.value = ""; } };
  const handleDeleteAttachment = async (attId) => { try { await api.delete(`/attachments/${attId}`); setAttachments(attachments.filter(a => a.id !== attId)); toast.success("Deleted"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); } };
  const handleDownloadAttachment = async (att) => { try { const res = await api.get(`/files/${att.storage_path}`, { responseType: "blob" }); const url = window.URL.createObjectURL(new Blob([res.data])); const a = document.createElement("a"); a.href = url; a.download = att.original_filename; a.click(); } catch { toast.error("Download failed"); } };
  const role = user?.role;

  if (loading) return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  if (!client) return <div className="text-[#6B7280] text-center py-20">Client not found</div>;

  return (
    <div className="space-y-6" data-testid="client-detail-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button variant="ghost" onClick={() => navigate("/clients")} className="text-[#6B7280] hover:text-[#1F2937] gap-2 rounded-lg" data-testid="back-to-clients"><ArrowLeft className="h-4 w-4" /> Clients</Button>
        <div className="flex items-center gap-2">
          {client.pending && role === "ADMIN" && <Button onClick={handleApprove} className="bg-[#10B981] hover:bg-[#059669] text-white gap-2 rounded-lg font-bold" data-testid="approve-client-btn"><CheckCircle className="h-4 w-4" /> Approve</Button>}
          {(role === "ADMIN" || role === "CASE_WORKER") && <Button variant="outline" onClick={() => setShowEdit(true)} className="border-[#E5E7EB] text-[#6B7280] gap-2 rounded-lg" data-testid="edit-client-btn"><Edit className="h-4 w-4" /> Edit</Button>}
          {role === "ADMIN" && <Button variant="outline" onClick={handleArchive} className="border-[#FECACA] text-[#EF4444] hover:bg-[#FEF2F2] gap-2 rounded-lg" data-testid="archive-client-btn"><Archive className="h-4 w-4" /> Archive</Button>}
        </div>
      </div>

      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFF7ED] to-[#FED7AA] flex items-center justify-center text-xl font-bold text-[#F97316]">{client.name?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]" data-testid="client-name">{client.name}</h1>
              {client.pending ? <Badge variant="outline" className="border-[#FDE68A] text-[#F59E0B] bg-[#FFFBEB] text-xs rounded-full"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                : <Badge variant="outline" className="border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5] text-xs rounded-full"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-sm">
              {client.email && <div><span className="text-[#9CA3AF]">Email:</span> <span className="text-[#6B7280]">{client.email}</span></div>}
              {client.phone && <div><span className="text-[#9CA3AF]">Phone:</span> <span className="text-[#6B7280] font-mono">{client.phone}</span></div>}
              {client.address && <div><span className="text-[#9CA3AF]">Address:</span> <span className="text-[#6B7280]">{client.address}</span></div>}
            </div>
            {client.notes && <p className="text-sm text-[#9CA3AF] mt-3 border-t border-[#F3F4F6] pt-3">{client.notes}</p>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="bg-white border border-[#E8E8E8] p-1 rounded-xl" data-testid="client-tabs">
          <TabsTrigger value="services" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="outcomes" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Outcomes ({outcomes.length})</TabsTrigger>
          <TabsTrigger value="follow-ups" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Follow-ups ({followUps.length})</TabsTrigger>
          <TabsTrigger value="attachments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Files ({attachments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && <Button onClick={() => setShowServiceForm(true)} variant="outline" className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] gap-2 rounded-lg" data-testid="add-service-btn"><Plus className="h-4 w-4" /> Log Service</Button>}
          {services.length === 0 ? <div className="text-center py-12 text-[#9CA3AF] text-sm">No services recorded yet</div> : (
            <div className="space-y-2">{services.map((s) => (
              <div key={s.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4 table-row-hover" data-testid={`service-${s.id}`}>
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold text-[#1F2937]">{s.service_type}</span><span className="text-xs text-[#9CA3AF] font-mono">{s.service_date}</span></div>
                <p className="text-xs text-[#6B7280]">Provider: {s.provider_name}</p>
                {s.notes && <p className="text-xs text-[#9CA3AF] mt-1">{s.notes}</p>}
              </div>))}</div>)}
        </TabsContent>

        <TabsContent value="outcomes" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && <Button onClick={() => setShowOutcomeForm(true)} variant="outline" className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] gap-2 rounded-lg" data-testid="add-outcome-btn"><Plus className="h-4 w-4" /> Add Outcome</Button>}
          {outcomes.length === 0 ? <div className="text-center py-12 text-[#9CA3AF] text-sm">No outcomes recorded yet</div> : (
            <div className="space-y-2">{outcomes.map((o) => (
              <div key={o.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4" data-testid={`outcome-${o.id}`}>
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold text-[#1F2937]">{o.goal_description}</span><Badge variant="outline" className={`text-xs rounded-full ${STATUS_COLORS[o.status] || ""}`}>{o.status?.replace("_", " ")}</Badge></div>
                <p className="text-xs text-[#9CA3AF] font-mono">Target: {o.target_date}</p>
              </div>))}</div>)}
        </TabsContent>

        <TabsContent value="follow-ups" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && <Button onClick={() => setShowFollowUpForm(true)} variant="outline" className="border-[#E5E7EB] text-[#6B7280] hover:bg-[#FFF7ED] gap-2 rounded-lg" data-testid="add-followup-btn"><Plus className="h-4 w-4" /> Add Follow-up</Button>}
          {followUps.length === 0 ? <div className="text-center py-12 text-[#9CA3AF] text-sm">No follow-ups yet</div> : (
            <div className="space-y-2">{followUps.map((f) => (
              <div key={f.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4" data-testid={`followup-${f.id}`}>
                <div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold text-[#1F2937]">{f.title}</span><Badge variant="outline" className={`text-xs rounded-full ${STATUS_COLORS[f.status] || ""}`}>{f.status}</Badge></div>
                {f.description && <p className="text-xs text-[#9CA3AF]">{f.description}</p>}
                {f.due_date && <p className="text-xs text-[#6B7280] mt-1 font-mono">Due: {f.due_date}</p>}
              </div>))}</div>)}
        </TabsContent>

        <TabsContent value="attachments" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <div className="flex items-center gap-3">
              <label className="cursor-pointer"><input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} data-testid="file-upload-input" />
                <div className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:bg-[#FFF7ED] transition-colors" data-testid="upload-file-btn">
                  {uploading ? <div className="w-4 h-4 border-2 border-[#6B7280]/30 border-t-[#6B7280] rounded-full animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "Uploading..." : "Upload File"}
                </div>
              </label>
              <span className="text-xs text-[#9CA3AF]">Max 10MB per file</span>
            </div>)}
          {attachments.length === 0 ? <div className="text-center py-12 text-[#9CA3AF] text-sm">No files attached yet</div> : (
            <div className="space-y-2">{attachments.map((att) => (
              <div key={att.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex items-center justify-between" data-testid={`attachment-${att.id}`}>
                <div className="flex items-center gap-3 min-w-0"><FileText className="h-5 w-5 text-[#F97316] shrink-0" /><div className="min-w-0"><p className="text-sm text-[#1F2937] truncate font-medium">{att.original_filename}</p><p className="text-xs text-[#9CA3AF] font-mono">{(att.size / 1024).toFixed(1)} KB</p></div></div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadAttachment(att)} className="text-[#F97316] hover:bg-[#FFF7ED] rounded-lg" data-testid={`download-${att.id}`}>Download</Button>
                  {(role === "ADMIN" || role === "CASE_WORKER") && <Button variant="ghost" size="icon" onClick={() => handleDeleteAttachment(att.id)} className="text-[#EF4444] hover:bg-[#FEF2F2] h-8 w-8 rounded-lg" data-testid={`delete-att-${att.id}`}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              </div>))}</div>)}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={showServiceForm} onOpenChange={setShowServiceForm}><DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] rounded-2xl" data-testid="service-dialog"><DialogHeader><DialogTitle className="font-['Nunito'] font-bold">Log Service</DialogTitle></DialogHeader><form onSubmit={handleAddService} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Date *</Label><Input type="date" value={serviceForm.service_date} onChange={(e) => setServiceForm({...serviceForm, service_date: e.target.value})} required className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Type *</Label><Input value={serviceForm.service_type} onChange={(e) => setServiceForm({...serviceForm, service_type: e.target.value})} required placeholder="e.g., Counseling" className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Provider *</Label><Input value={serviceForm.provider_name} onChange={(e) => setServiceForm({...serviceForm, provider_name: e.target.value})} required className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Notes</Label><Textarea value={serviceForm.notes} onChange={(e) => setServiceForm({...serviceForm, notes: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setShowServiceForm(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button><Button type="submit" className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold" data-testid="submit-service">Save</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={showOutcomeForm} onOpenChange={setShowOutcomeForm}><DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] rounded-2xl" data-testid="outcome-dialog"><DialogHeader><DialogTitle className="font-['Nunito'] font-bold">Add Outcome</DialogTitle></DialogHeader><form onSubmit={handleAddOutcome} className="space-y-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Goal *</Label><Input value={outcomeForm.goal_description} onChange={(e) => setOutcomeForm({...outcomeForm, goal_description: e.target.value})} required className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Target Date *</Label><Input type="date" value={outcomeForm.target_date} onChange={(e) => setOutcomeForm({...outcomeForm, target_date: e.target.value})} required className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Status</Label><Select value={outcomeForm.status} onValueChange={(v) => setOutcomeForm({...outcomeForm, status: v})}><SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg"><SelectValue /></SelectTrigger><SelectContent className="bg-white border-[#E8E8E8] rounded-xl"><SelectItem value="NOT_STARTED">Not Started</SelectItem><SelectItem value="IN_PROGRESS">In Progress</SelectItem><SelectItem value="ACHIEVED">Achieved</SelectItem><SelectItem value="NOT_ACHIEVED">Not Achieved</SelectItem></SelectContent></Select></div></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setShowOutcomeForm(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button><Button type="submit" className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold" data-testid="submit-outcome">Save</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm}><DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] rounded-2xl" data-testid="followup-dialog"><DialogHeader><DialogTitle className="font-['Nunito'] font-bold">Add Follow-up</DialogTitle></DialogHeader><form onSubmit={handleAddFollowUp} className="space-y-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Title *</Label><Input value={followUpForm.title} onChange={(e) => setFollowUpForm({...followUpForm, title: e.target.value})} required className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Description</Label><Textarea value={followUpForm.description} onChange={(e) => setFollowUpForm({...followUpForm, description: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Due Date</Label><Input type="date" value={followUpForm.due_date} onChange={(e) => setFollowUpForm({...followUpForm, due_date: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Urgency</Label><Select value={followUpForm.urgency} onValueChange={(v) => setFollowUpForm({...followUpForm, urgency: v})}><SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg"><SelectValue /></SelectTrigger><SelectContent className="bg-white border-[#E8E8E8] rounded-xl"><SelectItem value="LOW">Low</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></div></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setShowFollowUpForm(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button><Button type="submit" className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold" data-testid="submit-followup">Save</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={showEdit} onOpenChange={setShowEdit}><DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] max-w-lg rounded-2xl" data-testid="edit-client-dialog"><DialogHeader><DialogTitle className="font-['Nunito'] font-bold">Edit Client</DialogTitle></DialogHeader><form onSubmit={handleEdit} className="space-y-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Name</Label><Input value={editData.name || ""} onChange={(e) => setEditData({...editData, name: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Email</Label><Input value={editData.email || ""} onChange={(e) => setEditData({...editData, email: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Phone</Label><Input value={editData.phone || ""} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Address</Label><Input value={editData.address || ""} onChange={(e) => setEditData({...editData, address: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><div className="space-y-2"><Label className="text-[#6B7280] text-xs uppercase font-bold">Notes</Label><Textarea value={editData.notes || ""} onChange={(e) => setEditData({...editData, notes: e.target.value})} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" /></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setShowEdit(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button><Button type="submit" className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold" data-testid="save-edit-btn">Save Changes</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
