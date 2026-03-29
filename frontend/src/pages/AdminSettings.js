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
import { UserPlus, Save, Trash2, Plus } from "lucide-react";
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

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [vocabRes, usersRes, invitesRes, fsRes] = await Promise.all([
          api.get("/admin/vocabulary"),
          api.get("/admin/users"),
          api.get("/invites"),
          api.get("/admin/field-sets"),
        ]);
        setVocab(vocabRes.data);
        setUsers(usersRes.data);
        setInvites(invitesRes.data);
        setFieldSets(fsRes.data);
      } catch (err) {
        console.error("Admin settings fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleVocabSave = async () => {
    try {
      await api.put("/admin/vocabulary", { mappings: vocab });
      toast.success("Vocabulary updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post("/invites", inviteForm);
      toast.success(`Invite sent to ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: "", role: "CASE_WORKER" });
      const { data } = await api.get("/invites");
      setInvites(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await api.patch(`/admin/users/${userId}`, { role });
      setUsers(users.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success("Role updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  if (loading) return (
    <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-[#141415]" />)}</div>
  );

  return (
    <div className="space-y-6" data-testid="admin-settings-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">Admin Settings</h1>
        <p className="text-sm text-[#6E6E73] mt-1">Manage your organization's configuration</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-[#141415] border border-[#2A2A2D] p-1 rounded-sm" data-testid="admin-tabs">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Users</TabsTrigger>
          <TabsTrigger value="invites" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Invites</TabsTrigger>
          <TabsTrigger value="vocabulary" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Vocabulary</TabsTrigger>
          <TabsTrigger value="fields" className="data-[state=active]:bg-[#0055FF] data-[state=active]:text-white rounded-sm text-[#A0A0A5] text-sm">Field Sets</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A2D]">
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Name</th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73] hidden sm:table-cell">Email</th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#2A2A2D]/50 table-row-hover" data-testid={`user-row-${u.id}`}>
                    <td className="p-4 text-sm text-[#F9F9FB]">{u.name}</td>
                    <td className="p-4 text-sm text-[#A0A0A5] hidden sm:table-cell">{u.email}</td>
                    <td className="p-4">
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="w-36 h-8 text-xs bg-transparent border-[#2A2A2D] text-[#A0A0A5]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#141415] border-[#2A2A2D]">
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
          <Button onClick={() => setShowInvite(true)} className="bg-[#0055FF] hover:bg-[#0044CC] gap-2 rounded-sm" data-testid="invite-user-btn">
            <UserPlus className="h-4 w-4" /> Invite User
          </Button>
          {invites.length === 0 ? (
            <div className="text-center py-8 text-[#6E6E73] text-sm">No invites sent yet</div>
          ) : (
            <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2A2A2D]">
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Email</th>
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Role</th>
                    <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv, i) => (
                    <tr key={i} className="border-b border-[#2A2A2D]/50">
                      <td className="p-4 text-sm text-[#F9F9FB]">{inv.email}</td>
                      <td className="p-4 text-sm text-[#A0A0A5]">{inv.role}</td>
                      <td className="p-4">
                        {inv.accepted_at ? (
                          <Badge variant="outline" className="border-[#00E676]/30 text-[#00E676] bg-[#00E676]/10 text-xs">Accepted</Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#FFEA00]/30 text-[#FFEA00] bg-[#FFEA00]/10 text-xs">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Vocabulary Tab */}
        <TabsContent value="vocabulary" className="mt-4 space-y-4">
          <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-5 space-y-4">
            <p className="text-xs text-[#6E6E73]">Customize labels used across the application for your organization.</p>
            {vocab.map((v, i) => (
              <div key={i} className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <Label className="text-[#6E6E73] text-xs">Default: {v.default_label}</Label>
                </div>
                <Input
                  value={v.custom_label}
                  onChange={(e) => {
                    const updated = [...vocab];
                    updated[i] = { ...updated[i], custom_label: e.target.value };
                    setVocab(updated);
                  }}
                  className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] h-9"
                />
              </div>
            ))}
            <Button onClick={handleVocabSave} className="bg-[#0055FF] hover:bg-[#0044CC] gap-2 rounded-sm" data-testid="save-vocab-btn">
              <Save className="h-4 w-4" /> Save Vocabulary
            </Button>
          </div>
        </TabsContent>

        {/* Field Sets Tab */}
        <TabsContent value="fields" className="mt-4 space-y-4">
          <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-5">
            <p className="text-xs text-[#6E6E73] mb-4">Define custom fields for client intake forms.</p>
            {fieldSets.length === 0 ? (
              <p className="text-sm text-[#A0A0A5]">No field sets configured. Default fields will be used.</p>
            ) : (
              fieldSets.map((fs) => (
                <div key={fs.id} className="mb-4 p-3 border border-[#2A2A2D] rounded-sm">
                  <h4 className="text-sm font-medium text-[#F9F9FB] mb-2">{fs.name}</h4>
                  <div className="space-y-1">
                    {(fs.fields || []).map((f, i) => (
                      <div key={i} className="text-xs text-[#A0A0A5] flex items-center gap-2">
                        <span className="font-mono text-[#6E6E73]">{f.type || "TEXT"}</span>
                        <span>{f.label}</span>
                        {f.required && <Badge variant="outline" className="text-[10px] border-[#FF1744]/30 text-[#FF1744]">Required</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB]" data-testid="invite-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Invite User</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} required placeholder="colleague@example.org"
                className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="invite-email-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase">Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({...inviteForm, role: v})}>
                <SelectTrigger className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#141415] border-[#2A2A2D]">
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="CASE_WORKER">Case Worker</SelectItem>
                  <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" disabled={inviting} className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="send-invite-btn">
                {inviting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send Invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
