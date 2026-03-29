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
import { UserPlus, Save, Database, Link, Copy, CheckCircle, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const [vocab, setVocab] = useState([]);
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [fieldSets, setFieldSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "CASE_WORKER" });
  const [inviting, setInviting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [shareableLink, setShareableLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [vocabRes, usersRes, invitesRes, fsRes] = await Promise.all([
          api.get("/admin/vocabulary"), api.get("/admin/users"), api.get("/invites"), api.get("/admin/field-sets"),
        ]);
        setVocab(vocabRes.data); setUsers(usersRes.data); setInvites(invitesRes.data); setFieldSets(fsRes.data);
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
    if (!window.confirm("Are you sure? This will delete ALL clients, services, visits, outcomes, payment records, and demo users for your organization. This cannot be undone.")) return;
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
            <p className="text-xs text-[#9CA3AF] mb-4">Define custom fields for client intake forms.</p>
            {fieldSets.length === 0 ? <p className="text-sm text-[#6B7280]">No field sets configured. Default fields will be used.</p>
              : fieldSets.map((fs) => (
                <div key={fs.id} className="mb-4 p-3 border border-[#E8E8E8] rounded-xl">
                  <h4 className="text-sm font-bold text-[#1F2937] mb-2">{fs.name}</h4>
                  <div className="space-y-1">{(fs.fields || []).map((f, i) => (
                    <div key={i} className="text-xs text-[#6B7280] flex items-center gap-2"><span className="font-mono text-[#9CA3AF]">{f.type || "TEXT"}</span><span>{f.label}</span>{f.required && <Badge variant="outline" className="text-[10px] border-[#FECACA] text-[#EF4444] rounded-full">Required</Badge>}</div>
                  ))}</div>
                </div>
              ))}
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
