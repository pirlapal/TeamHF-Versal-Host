import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Save, Database, Link, Copy, CheckCircle, KeyRound, Trash2, Shield, Mail, Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export default function AdminSettings() {
  const [vocab, setVocab] = useState([]);
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [fieldSets, setFieldSets] = useState([]);
  const [showFieldSetForm, setShowFieldSetForm] = useState(false);
  const [fieldSetName, setFieldSetName] = useState("Client Intake");
  const [fieldSetFields, setFieldSetFields] = useState([{ label: "", type: "TEXT", required: false }]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "CASE_WORKER" });
  const [inviting, setInviting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [shareableLink, setShareableLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [editingPerms, setEditingPerms] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [savingRole, setSavingRole] = useState(false);
  const [emailSettings, setEmailSettings] = useState({});

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [vocabRes, usersRes, invitesRes, fsRes, permsRes, rolesRes, emailRes] = await Promise.all([
          api.get("/admin/vocabulary"), api.get("/admin/users"), api.get("/invites"), api.get("/admin/field-sets"),
          api.get("/admin/permissions/all"), api.get("/admin/roles"), api.get("/admin/email-settings"),
        ]);
        setVocab(vocabRes.data); setUsers(usersRes.data); setInvites(invitesRes.data); setFieldSets(fsRes.data);
        setAllPerms(permsRes.data.permissions || []); setRoles(rolesRes.data || []); setEmailSettings(emailRes.data || {});
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const handleVocabSave = async () => {
    try { await api.put("/admin/vocabulary", { mappings: vocab }); toast.success("Vocabulary updated"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const handleInvite = async (e) => {
    e.preventDefault(); setInviting(true); setShareableLink(null);
    try {
      const { data } = await api.post("/invites/shareable", inviteForm);
      setShareableLink(data);
      toast.success(`Invite created for ${inviteForm.email}`);
      setInviteForm({ email: "", role: "CASE_WORKER" });
      const res = await api.get("/invites"); setInvites(res.data);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setInviting(false); }
  };

  const handleCopyLink = async () => {
    if (!shareableLink?.shareable_url) return;
    try { await navigator.clipboard.writeText(shareableLink.shareable_url); setCopied(true); toast.success("Link copied!"); setTimeout(() => setCopied(false), 2000); } catch { toast.error("Failed to copy"); }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const { data } = await api.post("/demo/seed");
      toast.success(data.message);
      if (data.demo_users) setDemoUsers(data.demo_users);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setSeeding(false); }
  };

  const handleClearData = async () => {
    if (!window.confirm("Are you sure? This will delete ALL clients, services, visits, outcomes, payment records, and notifications for your organization. Demo login accounts will be preserved. This cannot be undone.")) return;
    setClearing(true);
    try {
      const { data } = await api.post("/demo/clear");
      toast.success(data.message);
      setDemoUsers([]);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setClearing(false); }
  };

  const handleRoleChange = async (userId, role) => {
    try { await api.patch(`/admin/users/${userId}`, { role }); setUsers(users.map((u) => (u.id === userId ? { ...u, role } : u))); toast.success("Role updated"); } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const startEditRole = (role) => {
    setEditingRole(role.role_name);
    setEditingPerms([...role.permissions]);
  };

  const togglePerm = (perm) => {
    setEditingPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleSaveRolePerms = async () => {
    setSavingRole(true);
    try {
      await api.put(`/admin/roles/${editingRole}`, { permissions: editingPerms });
      toast.success(`Permissions saved for ${editingRole}`);
      const { data } = await api.get("/admin/roles");
      setRoles(data);
      setEditingRole(null);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setSavingRole(false); }
  };

  const handleResetRolePerms = async (roleName) => {
    try {
      await api.delete(`/admin/roles/${roleName}`);
      toast.success(`${roleName} reset to defaults`);
      const { data } = await api.get("/admin/roles");
      setRoles(data);
      setEditingRole(null);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const permCategories = {};
  allPerms.forEach(p => {
    const [cat] = p.split(".");
    if (!permCategories[cat]) permCategories[cat] = [];
    permCategories[cat].push(p);
  });

  const handleSaveFieldSet = async () => {
    const validFields = fieldSetFields.filter(f => f.label.trim());
    if (!fieldSetName.trim() || validFields.length === 0) { toast.error("Name and at least one field required"); return; }
    try {
      await api.put("/admin/field-sets", { name: fieldSetName, fields: validFields });
      toast.success("Field set saved");
      setShowFieldSetForm(false);
      const { data } = await api.get("/admin/field-sets");
      setFieldSets(data);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const addFieldRow = () => setFieldSetFields(prev => [...prev, { label: "", type: "TEXT", required: false }]);
  const removeFieldRow = (i) => setFieldSetFields(prev => prev.filter((_, idx) => idx !== i));
  const updateFieldRow = (i, key, val) => setFieldSetFields(prev => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));

  const editFieldSet = (fs) => {
    setFieldSetName(fs.name);
    setFieldSetFields(fs.fields?.length > 0 ? fs.fields : [{ label: "", type: "TEXT", required: false }]);
    setShowFieldSetForm(true);
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6" data-testid="admin-settings-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">Admin Settings</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">Manage your organization's configuration</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-white border border-[#E8E8E8] p-1 rounded-xl" data-testid="admin-tabs">
          <TabsTrigger value="users" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Users</TabsTrigger>
          <TabsTrigger value="invites" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Invites</TabsTrigger>
          <TabsTrigger value="vocabulary" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Vocabulary</TabsTrigger>
          <TabsTrigger value="fields" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Field Sets</TabsTrigger>
          <TabsTrigger value="demo" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">Demo Mode</TabsTrigger>
          <TabsTrigger value="permissions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">
            <Shield className="h-3.5 w-3.5 mr-1" />Permissions
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:to-[#FB923C] data-[state=active]:text-white rounded-lg text-[#6B7280] text-sm font-semibold">
            <Mail className="h-3.5 w-3.5 mr-1" />Email
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-[#F3F4F6]">
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Name</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hidden sm:table-cell">Email</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Role</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#F9FAFB] table-row-hover" data-testid={`user-row-${u.id}`}>
                    <td className="p-4 text-sm text-[#1F2937] font-medium">{u.name}</td>
                    <td className="p-4 text-sm text-[#6B7280] hidden sm:table-cell">{u.email}</td>
                    <td className="p-4">
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="w-36 h-8 text-xs bg-transparent border-[#E5E7EB] text-[#6B7280] rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="CASE_WORKER">Case Worker</SelectItem>
                          <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites" className="mt-4 space-y-4">
          <Button onClick={() => { setShowInvite(true); setShareableLink(null); }} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200" data-testid="invite-user-btn">
            <UserPlus className="h-4 w-4" /> Invite User
          </Button>
          {invites.length === 0 ? (
            <div className="text-center py-8 text-[#9CA3AF] text-sm">No invites sent yet</div>
          ) : (
            <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-[#F3F4F6]"><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Email</th><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Role</th><th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Status</th></tr></thead>
                <tbody>{invites.map((inv, i) => (
                  <tr key={i} className="border-b border-[#F9FAFB]">
                    <td className="p-4 text-sm text-[#1F2937] font-medium">{inv.email}</td>
                    <td className="p-4 text-sm text-[#6B7280]">{inv.role}</td>
                    <td className="p-4">{inv.accepted_at ? <Badge variant="outline" className="border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5] text-xs rounded-full">Accepted</Badge> : <Badge variant="outline" className="border-[#FDE68A] text-[#F59E0B] bg-[#FFFBEB] text-xs rounded-full">Pending</Badge>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Vocabulary Tab */}
        <TabsContent value="vocabulary" className="mt-4 space-y-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 space-y-4">
            <p className="text-xs text-[#9CA3AF]">Customize labels used across the application.</p>
            {vocab.map((v, i) => (
              <div key={i} className="grid grid-cols-2 gap-4 items-center">
                <Label className="text-[#9CA3AF] text-xs">Default: <span className="font-bold text-[#6B7280]">{v.default_label}</span></Label>
                <Input value={v.custom_label} onChange={(e) => { const u = [...vocab]; u[i] = { ...u[i], custom_label: e.target.value }; setVocab(u); }} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] h-9 rounded-lg" />
              </div>
            ))}
            <Button onClick={handleVocabSave} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white gap-2 rounded-lg font-bold" data-testid="save-vocab-btn"><Save className="h-4 w-4" /> Save Vocabulary</Button>
          </div>
        </TabsContent>

        {/* Field Sets Tab */}
        <TabsContent value="fields" className="mt-4 space-y-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold font-['Nunito'] text-[#1F2937]">Custom Field Sets</p>
                <p className="text-xs text-[#9CA3AF]">Define custom fields for client intake forms.</p>
              </div>
              <Button onClick={() => { setFieldSetName("Client Intake"); setFieldSetFields([{ label: "", type: "TEXT", required: false }]); setShowFieldSetForm(true); }}
                className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white gap-2 rounded-lg font-bold text-xs shadow-md shadow-orange-200" data-testid="add-fieldset-btn">
                <Plus className="h-3.5 w-3.5" /> Add Field Set
              </Button>
            </div>
            {fieldSets.length === 0 && !showFieldSetForm && <p className="text-sm text-[#6B7280] py-4 text-center">No field sets configured. Click "Add Field Set" to create one.</p>}
            {fieldSets.map((fs) => (
              <div key={fs.id} className="mb-3 p-4 border border-[#E8E8E8] rounded-xl hover:border-[#F97316]/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-[#1F2937]">{fs.name}</h4>
                  <Button size="sm" variant="outline" onClick={() => editFieldSet(fs)} className="border-[#E5E7EB] text-[#6B7280] hover:border-[#F97316] text-xs rounded-lg h-7" data-testid={`edit-fieldset-${fs.id}`}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>
                <div className="space-y-1">{(fs.fields || []).map((f, i) => (
                  <div key={i} className="text-xs text-[#6B7280] flex items-center gap-2">
                    <span className="font-mono text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[10px]">{f.type || "TEXT"}</span>
                    <span>{f.label}</span>
                    {f.required && <Badge variant="outline" className="text-[10px] border-[#FECACA] text-[#EF4444] rounded-full">Required</Badge>}
                  </div>
                ))}</div>
              </div>
            ))}

            {/* Field Set Form */}
            {showFieldSetForm && (
              <div className="border border-[#F97316]/30 bg-[#FFF7ED]/30 rounded-xl p-5 space-y-4" data-testid="fieldset-form">
                <div className="space-y-2">
                  <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Field Set Name</Label>
                  <Input value={fieldSetName} onChange={e => setFieldSetName(e.target.value)}
                    placeholder="e.g. Client Intake, Demographics" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg max-w-xs" data-testid="fieldset-name-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">Fields</Label>
                  {fieldSetFields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={f.label} onChange={e => updateFieldRow(i, "label", e.target.value)}
                        placeholder="Field label" className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg flex-1 h-8 text-xs" data-testid={`field-label-${i}`} />
                      <Select value={f.type} onValueChange={v => updateFieldRow(i, "type", v)}>
                        <SelectTrigger className="w-28 h-8 text-xs bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" data-testid={`field-type-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                          {["TEXT", "NUMBER", "DATE", "EMAIL", "PHONE", "SELECT", "TEXTAREA"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox checked={f.required} onCheckedChange={v => updateFieldRow(i, "required", v)}
                          className="border-[#D1D5DB] data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]" />
                        <span className="text-[10px] text-[#9CA3AF]">Req</span>
                      </label>
                      {fieldSetFields.length > 1 && (
                        <button onClick={() => removeFieldRow(i)} className="text-[#EF4444] hover:bg-[#FEF2F2] rounded p-1" data-testid={`remove-field-${i}`}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={addFieldRow} className="text-[#F97316] text-xs gap-1 h-7" data-testid="add-field-row-btn">
                    <Plus className="h-3 w-3" /> Add Field
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveFieldSet} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold text-xs gap-1" data-testid="save-fieldset-btn">
                    <Save className="h-3 w-3" /> Save Field Set
                  </Button>
                  <Button variant="ghost" onClick={() => setShowFieldSetForm(false)} className="text-[#9CA3AF] text-xs">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Demo Mode Tab */}
        <TabsContent value="demo" className="mt-4 space-y-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] flex items-center justify-center"><Database className="h-5 w-5 text-[#14B8A6]" /></div>
              <div>
                <h3 className="text-lg font-bold font-['Nunito'] text-[#1F2937]">Load Demo Data</h3>
                <p className="text-xs text-[#9CA3AF]">Generate 12 realistic clients, services, outcomes, visits, and demo user accounts</p>
              </div>
            </div>
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl">
              <p className="text-xs text-[#F59E0B] font-semibold">This adds new data alongside existing records. Nothing is deleted.</p>
            </div>
            <Button onClick={handleSeedDemo} disabled={seeding} className="bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] hover:from-[#0D9488] hover:to-[#14B8A6] text-white gap-2 rounded-lg font-bold shadow-md shadow-teal-200" data-testid="seed-demo-btn">
              {seeding ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</> : <><Database className="h-4 w-4" /> Load Demo Data</>}
            </Button>
            <Button onClick={handleClearData} disabled={clearing} variant="outline" className="border-[#FECACA] text-[#EF4444] hover:bg-[#FEF2F2] gap-2 rounded-lg font-bold" data-testid="clear-demo-btn">
              {clearing ? <><div className="w-4 h-4 border-2 border-[#EF4444]/30 border-t-[#EF4444] rounded-full animate-spin" /> Clearing...</> : <><Trash2 className="h-4 w-4" /> Clear All Data</>}
            </Button>

            {/* Demo Credentials */}
            {demoUsers.length > 0 && (
              <div className="mt-4 p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl space-y-3" data-testid="demo-credentials">
                <div className="flex items-center gap-2 text-sm font-bold text-[#3B82F6]"><KeyRound className="h-4 w-4" /> Demo Login Credentials</div>
                {demoUsers.map((du, i) => (
                  <div key={i} className="p-3 bg-white border border-[#E5E7EB] rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1F2937]">{du.name}</p>
                        <p className="text-xs text-[#6B7280]">{du.role?.replace("_", " ")}</p>
                      </div>
                      <Badge variant="outline" className="border-[#BFDBFE] text-[#3B82F6] bg-[#EFF6FF] text-xs rounded-full">{du.role}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-[#9CA3AF]">Email:</span> <span className="text-[#1F2937] font-mono font-bold">{du.email}</span></div>
                      <div><span className="text-[#9CA3AF]">Password:</span> <span className="text-[#1F2937] font-mono font-bold">{du.password}</span></div>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-[#6B7280]">Use these credentials to log in and test different role experiences.</p>
              </div>
            )}

            {/* Always show static credentials */}
            <div className="p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl">
              <p className="text-xs font-bold text-[#6B7280] mb-2 uppercase tracking-wider">Default Demo Accounts</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E8E8E8]">
                  <div><span className="font-bold text-[#1F2937]">Case Worker</span><span className="text-[#9CA3AF] ml-2">(Sarah Thompson)</span></div>
                  <div className="font-mono text-[#6B7280]">caseworker@demo.caseflow.io / demo1234</div>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E8E8E8]">
                  <div><span className="font-bold text-[#1F2937]">Volunteer</span><span className="text-[#9CA3AF] ml-2">(Alex Rivera)</span></div>
                  <div className="font-mono text-[#6B7280]">volunteer@demo.caseflow.io / demo1234</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="mt-4 space-y-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6" data-testid="permissions-section">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center"><Shield className="h-5 w-5 text-[#6366F1]" /></div>
              <div>
                <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937]">Role Permissions (RBAC)</h3>
                <p className="text-xs text-[#9CA3AF]">Customize what each role can access. Changes override defaults.</p>
              </div>
            </div>

            {editingRole ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#1F2937]">Editing: <span className="text-[#F97316]">{editingRole.replace("_", " ")}</span></h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleResetRolePerms(editingRole)} className="text-[#9CA3AF] text-xs rounded-lg" data-testid="reset-role-btn">Reset to Default</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingRole(null)} className="text-[#9CA3AF] text-xs rounded-lg">Cancel</Button>
                    <Button size="sm" onClick={handleSaveRolePerms} disabled={savingRole}
                      className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white text-xs rounded-lg font-bold gap-1" data-testid="save-perms-btn">
                      {savingRole ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="h-3 w-3" /> Save</>}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(permCategories).map(([cat, perms]) => (
                    <div key={cat} className="border border-[#E8E8E8] rounded-lg p-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">{cat}</h5>
                      <div className="space-y-1.5">
                        {perms.map(p => {
                          const action = p.split(".")[1];
                          return (
                            <label key={p} className="flex items-center gap-2 cursor-pointer" data-testid={`perm-${p}`}>
                              <Checkbox checked={editingPerms.includes(p)} onCheckedChange={() => togglePerm(p)}
                                className="border-[#D1D5DB] data-[state=checked]:bg-[#F97316] data-[state=checked]:border-[#F97316]" />
                              <span className="text-xs text-[#4B5563]">{action}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#9CA3AF]">Selected: {editingPerms.length}/{allPerms.length} permissions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {roles.map(role => (
                  <div key={role.role_name} className="flex items-center justify-between p-4 border border-[#E8E8E8] rounded-xl hover:border-[#F97316]/30 transition-colors" data-testid={`role-card-${role.role_name}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        role.role_name === "ADMIN" ? "bg-[#FFF7ED]" : role.role_name === "CASE_WORKER" ? "bg-[#F0FDFA]" : "bg-[#EEF2FF]"
                      }`}>
                        <Shield className={`h-4 w-4 ${
                          role.role_name === "ADMIN" ? "text-[#F97316]" : role.role_name === "CASE_WORKER" ? "text-[#14B8A6]" : "text-[#6366F1]"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1F2937]">{role.role_name.replace("_", " ")}</p>
                        <p className="text-xs text-[#9CA3AF]">{role.permissions.length} permissions {role.is_custom && <span className="text-[#F97316] font-bold">(customized)</span>}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEditRole(role)}
                      className="border-[#E5E7EB] text-[#6B7280] hover:border-[#F97316] hover:text-[#F97316] text-xs rounded-lg" data-testid={`edit-role-${role.role_name}`}>
                      Edit Permissions
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Email Settings Tab */}
        <TabsContent value="email" className="mt-4 space-y-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6" data-testid="email-settings-section">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center"><Mail className="h-5 w-5 text-[#10B981]" /></div>
              <div>
                <h3 className="text-base font-bold font-['Nunito'] text-[#1F2937]">Email Notifications</h3>
                <p className="text-xs text-[#9CA3AF]">Configure SendGrid for email delivery</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: emailSettings.sendgrid_configured ? "#A7F3D0" : "#FDE68A", backgroundColor: emailSettings.sendgrid_configured ? "#ECFDF5" : "#FFFBEB" }}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${emailSettings.sendgrid_configured ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                <span className={`text-sm font-bold ${emailSettings.sendgrid_configured ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                  {emailSettings.sendgrid_configured ? "SendGrid Connected" : "SendGrid Not Configured"}
                </span>
              </div>
              {emailSettings.sendgrid_configured ? (
                <p className="text-xs text-[#6B7280]">Emails are being sent from <span className="font-mono font-bold">{emailSettings.sender_email}</span></p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#6B7280]">Notifications are currently delivered in-app only. To enable email delivery:</p>
                  <ol className="text-xs text-[#6B7280] space-y-1 list-decimal list-inside">
                    <li>Sign up at <span className="font-mono text-[#F97316]">sendgrid.com</span> and create an API key</li>
                    <li>Add <span className="font-mono text-[#1F2937]">SENDGRID_API_KEY</span> and <span className="font-mono text-[#1F2937]">SENDER_EMAIL</span> to your environment variables</li>
                    <li>Restart the application</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Email Triggers</h4>
              <div className="space-y-2">
                {[
                  { event: "New Client Created", desc: "Notify admins when a new client is added" },
                  { event: "Visit Scheduled", desc: "Notify team when a visit is booked" },
                  { event: "Payment Request Sent", desc: "Email the client with payment details" },
                  { event: "Payment Received", desc: "Notify the requester when marked as paid" },
                  { event: "New Message", desc: "Notify recipient of new team messages" },
                  { event: "Client Onboarded", desc: "Notify admins when wizard onboarding completes" },
                ].map((trigger, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#FAFAF8] rounded-lg">
                    <div>
                      <p className="text-xs font-semibold text-[#1F2937]">{trigger.event}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{trigger.desc}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] rounded-full ${emailSettings.sendgrid_configured ? "border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5]" : "border-[#E5E7EB] text-[#9CA3AF]"}`}>
                      {emailSettings.sendgrid_configured ? "Email + In-app" : "In-app only"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] rounded-2xl" data-testid="invite-dialog">
          <DialogHeader><DialogTitle className="font-['Nunito'] font-bold">Invite Team Member</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase font-bold">Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} required placeholder="colleague@example.org"
                className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="invite-email-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase font-bold">Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({...inviteForm, role: v})}>
                <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="CASE_WORKER">Case Worker</SelectItem>
                  <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shareableLink && (
              <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl space-y-3" data-testid="shareable-link-result">
                <div className="flex items-center gap-2 text-sm text-[#10B981] font-bold"><Link className="h-4 w-4" /> Invite link created!</div>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={shareableLink.shareable_url} className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-[#6B7280] font-mono truncate" data-testid="shareable-link-url" />
                  <Button type="button" size="sm" onClick={handleCopyLink} className={`gap-1 rounded-lg ${copied ? "bg-[#10B981] text-white" : "bg-[#E5E7EB] text-[#6B7280] hover:bg-[#D1D5DB]"}`} data-testid="copy-link-btn">
                    {copied ? <><CheckCircle className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <p className="text-xs text-[#9CA3AF]">Share this link with {shareableLink.email}. Expires in 72 hours.</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button>
              <Button type="submit" disabled={inviting} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold" data-testid="send-invite-btn">
                {inviting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create & Share Invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
