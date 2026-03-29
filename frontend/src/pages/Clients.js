import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, ChevronLeft, ChevronRight, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";

export default function Clients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_count: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/clients", { params: { search, page, page_size: 25 } });
      setClients(data.data || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total_count: 0 });
    } catch (err) {
      console.error("Fetch clients error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post("/clients", newClient);
      toast.success("Client created successfully");
      setShowCreate(false);
      setNewClient({ name: "", email: "", phone: "", address: "", notes: "" });
      navigate(`/clients/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setCreating(false);
    }
  };

  const role = user?.role;

  return (
    <div className="space-y-6" data-testid="clients-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium font-['Outfit'] tracking-tight text-[#F9F9FB]">Clients</h1>
          <p className="text-sm text-[#6E6E73] mt-1">{pagination.total_count} total clients</p>
        </div>
        {(role === "ADMIN" || role === "CASE_WORKER") && (
          <Button onClick={() => setShowCreate(true)} className="bg-[#0055FF] hover:bg-[#0044CC] gap-2 rounded-sm" data-testid="add-client-btn">
            <Plus className="h-4 w-4" /> Add Client
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6E73]" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-10 bg-[#141415] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] h-10"
          data-testid="client-search-input"
        />
      </div>

      {/* Client Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 bg-[#141415]" />)}</div>
      ) : clients.length === 0 ? (
        <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm p-12 text-center" data-testid="clients-empty">
          <Users className="h-12 w-12 text-[#2A2A2D] mx-auto mb-4" />
          <p className="text-[#A0A0A5] mb-4">No clients found</p>
          {(role === "ADMIN" || role === "CASE_WORKER") && (
            <Button onClick={() => setShowCreate(true)} variant="outline" className="border-[#2A2A2D] text-[#A0A0A5] hover:bg-white/5">Add your first client</Button>
          )}
        </div>
      ) : (
        <div className="bg-[#141415] border border-[#2A2A2D] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2A2D]">
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Name</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73] hidden sm:table-cell">Email</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73] hidden md:table-cell">Phone</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr
                  key={c.id}
                  className={`table-row-hover border-b border-[#2A2A2D]/50 cursor-pointer animate-fade-in stagger-${Math.min(i+1, 4)}`}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  data-testid={`client-row-${c.id}`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-[#0A0A0B] border border-[#2A2A2D] flex items-center justify-center text-xs font-medium text-[#0055FF]">
                        {c.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[#F9F9FB]">{c.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-[#A0A0A5] hidden sm:table-cell">{c.email || "—"}</td>
                  <td className="p-4 text-sm text-[#A0A0A5] hidden md:table-cell font-mono">{c.phone || "—"}</td>
                  <td className="p-4">
                    {c.pending ? (
                      <Badge variant="outline" className="border-[#FFEA00]/30 text-[#FFEA00] bg-[#FFEA00]/10 gap-1 text-xs">
                        <Clock className="h-3 w-3" /> Pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#00E676]/30 text-[#00E676] bg-[#00E676]/10 gap-1 text-xs">
                        <UserCheck className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-[#A0A0A5]">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-[#A0A0A5] font-mono">{page} / {pagination.total_pages}</span>
          <Button variant="ghost" size="icon" disabled={page >= pagination.total_pages} onClick={() => setPage(p => p + 1)} className="text-[#A0A0A5]">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#141415] border-[#2A2A2D] text-[#F9F9FB] max-w-lg" data-testid="create-client-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-xl">New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider">Full Name *</Label>
              <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} required placeholder="Client name"
                className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="new-client-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider">Email</Label>
                <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="email@example.com"
                  className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="new-client-email" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider">Phone</Label>
                <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+1 (555) 000-0000"
                  className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="new-client-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider">Address</Label>
              <Input value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} placeholder="Street address"
                className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB]" data-testid="new-client-address" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#A0A0A5] text-xs uppercase tracking-wider">Notes</Label>
              <Textarea value={newClient.notes} onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} placeholder="Initial notes..."
                className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] min-h-[80px]" data-testid="new-client-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="text-[#A0A0A5]">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-[#0055FF] hover:bg-[#0044CC] gap-2" data-testid="create-client-submit">
                {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Need Users icon
const Users = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
