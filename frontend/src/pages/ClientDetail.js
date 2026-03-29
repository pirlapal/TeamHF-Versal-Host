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
import { ArrowLeft, Edit, Archive, Plus, CheckCircle, Clock, XCircle, Target, BotMessageSquare } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  NOT_STARTED: "bg-[#6E6E73]/10 text-[#6E6E73] border-[#6E6E73]/30",
  IN_PROGRESS: "bg-[#FFEA00]/10 text-[#FFEA00] border-[#FFEA00]/30",
  ACHIEVED: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30",
  NOT_ACHIEVED: "bg-[#FF1744]/10 text-[#FF1744] border-[#FF1744]/30",
  SCHEDULED: "bg-[#0055FF]/10 text-[#0055FF] border-[#0055FF]/30",
  COMPLETED: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30",
  CANCELLED: "bg-[#6E6E73]/10 text-[#6E6E73] border-[#6E6E73]/30",
  OPEN: "bg-[#0055FF]/10 text-[#0055FF] border-[#0055FF]/30",
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
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
        const [clientRes, servicesRes, outcomesRes, fuRes] = await Promise.all([
          api.get(`/clients/${id}`),
          api.get(`/clients/${id}/services`),
          api.get(`/clients/${id}/outcomes`),
          api.get(`/clients/${id}/follow-ups`),
        ]);
        setClient(clientRes.data);
        setServices(servicesRes.data);
        setOutcomes(outcomesRes.data);
        setFollowUps(fuRes.data);
        setEditData(clientRes.data);
      } catch (err) {
        toast.error("Failed to load client");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const handleApprove = async () => {
    try {
      const { data } = await api.patch(`/clients/${id}`, { pending: false });
      setClient(data);
      toast.success("Client approved");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const handleArchive = async () => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Client archived");
      navigate("/clients");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch(`/clients/${id}`, {
        name: editData.name, email: editData.email, phone: editData.phone, address: editData.address, notes: editData.notes,
      });
      setClient(data);
      setShowEdit(false);
      toast.success("Client updated");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/clients/${id}/services`, serviceForm);
      setServices([data, ...services]);
      setShowServiceForm(false);
      setServiceForm({ service_date: new Date().toISOString().split("T")[0], service_type: "", provider_name: "", notes: "" });
      toast.success("Service logged");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const handleAddOutcome = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/clients/${id}/outcomes`, outcomeForm);
      setOutcomes([data, ...outcomes]);
      setShowOutcomeForm(false);
      setOutcomeForm({ goal_description: "", target_date: "", status: "NOT_STARTED" });
      toast.success("Outcome created");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const handleAddFollowUp = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/clients/${id}/follow-ups`, followUpForm);
      setFollowUps([data, ...followUps]);
      setShowFollowUpForm(false);
      setFollowUpForm({ title: "", description: "", due_date: "", urgency: "NORMAL" });
      toast.success("Follow-up created");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const role = user?.role;

  if (loading) return (
    <div className="space-y-6"><Skeleton className="h-10 w-48 bg-[#141415]" /><Skeleton className="h-40 bg-[#141415]" /><Skeleton className="h-64 bg-[#141415]" /></div>
  );

  if (!client) return <div className="text-[#A0A0A5] text-center py-20">Client not found</div>;

  return (
    <div className="space-y-6" data-testid="client-detail-page">
      {/* Back + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button variant="ghost" onClick={() => navigate("/clients")} className="text-[#A0A0A5] hover:text-[#F9F9FB] gap-2" data-testid="back-to-clients">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Button>
        <div className="flex items-center gap-2">
          {client.pending && role === "ADMIN" && (
            <Button onClick={handleApprove} className="bg-[#00E676] hover:bg-[#00E676]/80 text-black gap-2 rounded-sm" data-testid="approve-client-btn">
              <CheckCircle className="h-4 w-4" /> Approve
            </Button>
          )}
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <Button variant="outline" onClick={() => setShowEdit(true)} className="border-[#2A2A2D] text-[#A0A0A5] gap-2 rounded-sm" data-testid="edit-client-btn">
              <Edit className="h-4 w-4" /> Edit
            </Button>
          )}
          {role === "ADMIN" && (
            <Button variant="outline" onClick={handleArchive} className="border-[#FF1744]/30 text-[#FF1744] hover:bg-[#FF1744]/10 gap-2 rounded-sm" data-testid="archive-client-btn">
              <Archive className="h-4 w-4" /> Archive
            </Button>
          )}
        </div>
      </div>

      {/* Client Header */}
      <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-sm bg-[#0A0A0B] border border-[#2A2A2D] flex items-center justify-center text-xl font-medium text-[#0055FF]">
            {client.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]" data-testid="client-name">{client.name}</h1>
              {client.pending ? (
                <Badge variant="outline" className="border-[#FFEA00]/30 text-[#FFEA00] bg-[#FFEA00]/10 text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
              ) : (
                <Badge variant="outline" className="border-[#00E676]/30 text-[#00E676] bg-[#00E676]/10 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-sm">
              {client.email && <div><span className="text-[#6E6E73]">Email:</span> <span className="text-[#A0A0A5]">{client.email}</span></div>}
              {client.phone && <div><span className="text-[#6E6E73]">Phone:</span> <span className="text-[#A0A0A5] font-mono">{client.phone}</span></div>}
              {client.address && <div><span className="text-[#6E6E73]">Address:</span> <span className="text-[#A0A0A5]">{client.address}</span></div>}
            </div>
            {client.notes && <p className="text-sm text-[#6E6E73] mt-3 border-t border-[#2A2A2D] pt-3">{client.notes}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="bg-[#141415] border border-[#2A2A2D] p-1 rounded-sm" data-testid="client-tabs">
          <TabsTrigger value="services" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="outcomes" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Outcomes ({outcomes.length})</TabsTrigger>
          <TabsTrigger value="follow-ups" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Follow-ups ({followUps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <Button onClick={() => setShowServiceForm(true)} variant="outline" className="border-[#2A2A2D] text-[#A0A0A5] hover:bg-white/5 gap-2 rounded-sm" data-testid="add-service-btn">
              <Plus className="h-4 w-4" /> Log Service
            </Button>
          )}
          {services.length === 0 ? (
            <div className="text-center py-12 text-[#6E6E73] text-sm">No services recorded yet</div>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.id} className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-4 table-row-hover" data-testid={`service-${s.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#F9F9FB]">{s.service_type}</span>
                    <span className="text-xs text-[#6E6E73] font-mono">{s.service_date}</span>
                  </div>
                  <p className="text-xs text-[#A0A0A5]">Provider: {s.provider_name}</p>
                  {s.notes && <p className="text-xs text-[#6E6E73] mt-1">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outcomes" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <Button onClick={() => setShowOutcomeForm(true)} variant="outline" className="border-[#2A2A2D] text-[#A0A0A5] hover:bg-white/5 gap-2 rounded-sm" data-testid="add-outcome-btn">
              <Plus className="h-4 w-4" /> Add Outcome
            </Button>
          )}
          {outcomes.length === 0 ? (
            <div className="text-center py-12 text-[#6E6E73] text-sm">No outcomes recorded yet</div>
          ) : (
            <div className="space-y-2">
              {outcomes.map((o) => (
                <div key={o.id} className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-4" data-testid={`outcome-${o.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#F9F9FB]">{o.goal_description}</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[o.status] || ""}`}>{o.status?.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-[#6E6E73] font-mono">Target: {o.target_date}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="follow-ups" className="mt-4 space-y-4">
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <Button onClick={() => setShowFollowUpForm(true)} variant="outline" className="border-[#2A2A2D] text-[#A0A0A5] hover:bg-white/5 gap-2 rounded-sm" data-testid="add-followup-btn">
              <Plus className="h-4 w-4" /> Add Follow-up
            </Button>
          )}
          {followUps.length === 0 ? (
            <div className="text-center py-12 text-[#6E6E73] text-sm">No follow-ups yet</div>
          ) : (
            <div className="space-y-2">
              {followUps.map((f) => (
                <div key={f.id} className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-4" data-testid={`followup-${f.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#F9F9FB]">{f.title}</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[f.status] || ""}`}>{f.status}</Badge>
                  </div>
                  {f.description && <p className="text-xs text-[#6E6E73]">{f.description}</p>}
                  {f.due_date && <p className="text-xs text-[#A0A0A5] mt-1 font-mono">Due: {f.due_date}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Dialog */}
      <Dialog open={showServiceForm} onOpenChange={setShowServiceForm}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB]" data-testid="service-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Log Service</DialogTitle></DialogHeader>
          <form onSubmit={handleAddService} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Service Date *</Label>
                <Input type="date" value={serviceForm.service_date} onChange={(e) => setServiceForm({...serviceForm, service_date: e.target.value})} required className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Service Type *</Label>
                <Input value={serviceForm.service_type} onChange={(e) => setServiceForm({...serviceForm, service_type: e.target.value})} required placeholder="e.g., Counseling" className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Provider Name *</Label>
              <Input value={serviceForm.provider_name} onChange={(e) => setServiceForm({...serviceForm, provider_name: e.target.value})} required placeholder="Provider name" className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Notes</Label>
              <Textarea value={serviceForm.notes} onChange={(e) => setServiceForm({...serviceForm, notes: e.target.value})} placeholder="Session notes..." className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowServiceForm(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="submit-service">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Outcome Dialog */}
      <Dialog open={showOutcomeForm} onOpenChange={setShowOutcomeForm}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB]" data-testid="outcome-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Add Outcome</DialogTitle></DialogHeader>
          <form onSubmit={handleAddOutcome} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Goal Description *</Label>
              <Input value={outcomeForm.goal_description} onChange={(e) => setOutcomeForm({...outcomeForm, goal_description: e.target.value})} required placeholder="Describe the goal" className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Target Date *</Label>
                <Input type="date" value={outcomeForm.target_date} onChange={(e) => setOutcomeForm({...outcomeForm, target_date: e.target.value})} required className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Status</Label>
                <Select value={outcomeForm.status} onValueChange={(v) => setOutcomeForm({...outcomeForm, status: v})}>
                  <SelectTrigger className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#141415] border-[#2A2A2D]">
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="ACHIEVED">Achieved</SelectItem>
                    <SelectItem value="NOT_ACHIEVED">Not Achieved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowOutcomeForm(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="submit-outcome">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Follow-Up Dialog */}
      <Dialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB]" data-testid="followup-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Add Follow-up</DialogTitle></DialogHeader>
          <form onSubmit={handleAddFollowUp} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Title *</Label>
              <Input value={followUpForm.title} onChange={(e) => setFollowUpForm({...followUpForm, title: e.target.value})} required placeholder="Follow-up title" className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Description</Label>
              <Textarea value={followUpForm.description} onChange={(e) => setFollowUpForm({...followUpForm, description: e.target.value})} placeholder="Details..." className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Due Date</Label>
                <Input type="date" value={followUpForm.due_date} onChange={(e) => setFollowUpForm({...followUpForm, due_date: e.target.value})} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Urgency</Label>
                <Select value={followUpForm.urgency} onValueChange={(v) => setFollowUpForm({...followUpForm, urgency: v})}>
                  <SelectTrigger className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#141415] border-[#2A2A2D]">
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowFollowUpForm(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="submit-followup">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB] max-w-lg" data-testid="edit-client-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Edit Client</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Name</Label>
              <Input value={editData.name || ""} onChange={(e) => setEditData({...editData, name: e.target.value})} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Email</Label>
                <Input value={editData.email || ""} onChange={(e) => setEditData({...editData, email: e.target.value})} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase">Phone</Label>
                <Input value={editData.phone || ""} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Address</Label>
              <Input value={editData.address || ""} onChange={(e) => setEditData({...editData, address: e.target.value})} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Notes</Label>
              <Textarea value={editData.notes || ""} onChange={(e) => setEditData({...editData, notes: e.target.value})} className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowEdit(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="save-edit-btn">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
