import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Mail, Send, Inbox, Reply, Check, Clock, ChevronLeft
} from "lucide-react";
import { toast } from "sonner";

export default function Messages() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [composeForm, setComposeForm] = useState({ to_user_id: "", subject: "", body: "" });
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    try { const { data } = await api.get("/messages"); setMessages(data); } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/messages/users");
      setUsers(data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    }
  }, []);

  useEffect(() => { fetchMessages(); fetchUsers(); }, [fetchMessages, fetchUsers]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/messages", composeForm);
      toast.success("Message sent");
      setShowCompose(false);
      setComposeForm({ to_user_id: "", subject: "", body: "" });
      fetchMessages();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSending(false); }
  };

  const handleReply = async (msgId) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api.post(`/messages/${msgId}/reply`, { body: replyText });
      toast.success("Reply sent");
      setReplyText("");
      fetchMessages();
      // Refresh selected
      const { data } = await api.get(`/messages/${msgId}`);
      setSelectedMsg(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSending(false); }
  };

  const openMessage = async (msg) => {
    try {
      const { data } = await api.get(`/messages/${msg.id}`);
      setSelectedMsg(data);
    } catch { setSelectedMsg(msg); }
  };

  if (selectedMsg) {
    const isFrom = selectedMsg.from_user_id === user?.id;
    return (
      <div className="space-y-4" data-testid="message-detail">
        <Button variant="ghost" onClick={() => setSelectedMsg(null)} className="text-[#9CA3AF] gap-2 rounded-lg" data-testid="back-to-messages">
          <ChevronLeft className="h-4 w-4" /> {t("messages.backToMessages")}
        </Button>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-['Nunito'] text-[#1F2937]">{selectedMsg.subject}</h2>
            <Badge variant="outline" className={`text-xs rounded-full ${selectedMsg.is_read ? "border-[#E5E7EB] text-[#9CA3AF]" : "border-[#A7F3D0] text-[#10B981] bg-[#ECFDF5]"}`}>
              {selectedMsg.is_read ? t("messages.read") : t("messages.unread")}
            </Badge>
          </div>
          <div className="text-xs text-[#9CA3AF]">
            <span className="font-semibold text-[#6B7280]">{isFrom ? t("messages.to") : t("messages.from")}:</span> {isFrom ? selectedMsg.to_user_name : selectedMsg.from_user_name}
            <span className="ml-3">{selectedMsg.created_at?.split("T")[0]}</span>
          </div>
          <p className="text-sm text-[#4B5563] whitespace-pre-wrap">{selectedMsg.body}</p>
          {/* Replies */}
          {selectedMsg.replies?.length > 0 && (
            <div className="space-y-3 border-t border-[#F3F4F6] pt-4">
              {selectedMsg.replies.map((r, i) => (
                <div key={i} className={`p-3 rounded-lg ${r.from_user_id === user?.id ? "bg-[#FFF7ED] ml-8" : "bg-[#F9FAFB] mr-8"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#6B7280]">{r.from_user_name}</span>
                    <span className="text-[10px] text-[#9CA3AF]">{r.created_at?.split("T")[0]}</span>
                  </div>
                  <p className="text-sm text-[#4B5563]">{r.body}</p>
                </div>
              ))}
            </div>
          )}
          {/* Reply box */}
          {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
            <div className="flex gap-2 border-t border-[#F3F4F6] pt-4">
              <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t("messages.writeReply")}
                className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[60px] rounded-lg flex-1" data-testid="reply-input" />
              <Button onClick={() => handleReply(selectedMsg.id)} disabled={sending || !replyText.trim()}
                className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg self-end" data-testid="send-reply-btn">
                <Reply className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="messages-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Nunito'] tracking-tight text-[#1F2937]">{t("messages.title")}</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">{t("messages.subtitle")}</p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "CASE_WORKER") && (
          <Button onClick={() => setShowCompose(true)}
            className="bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white gap-2 rounded-lg font-bold shadow-md shadow-orange-200"
            data-testid="compose-message-btn">
            <Send className="h-4 w-4" /> {t("messages.newMessage")}
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
          <Inbox className="h-12 w-12 text-[#E5E7EB] mx-auto mb-4" />
          <p className="text-[#6B7280]">{t("messages.noMessagesYet")}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{t("messages.sendToTeamMember")}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden divide-y divide-[#F3F4F6]" data-testid="messages-list">
          {messages.map((msg) => {
            const isFrom = msg.from_user_id === user?.id;
            return (
              <button key={msg.id} onClick={() => openMessage(msg)}
                className={`w-full text-left p-4 flex items-center gap-4 table-row-hover ${!msg.is_read && !isFrom ? "bg-[#FFFBEB]/30" : ""}`}
                data-testid={`message-row-${msg.id}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${!msg.is_read && !isFrom ? "bg-[#FFF7ED]" : "bg-[#F3F4F6]"}`}>
                  <Mail className={`h-4 w-4 ${!msg.is_read && !isFrom ? "text-[#F97316]" : "text-[#9CA3AF]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#1F2937] truncate">{msg.subject}</span>
                    {!msg.is_read && !isFrom && <div className="w-2 h-2 rounded-full bg-[#F97316] shrink-0" />}
                  </div>
                  <p className="text-xs text-[#9CA3AF] truncate mt-0.5">
                    {isFrom ? `To: ${msg.to_user_name}` : `From: ${msg.from_user_name}`} — {msg.body?.slice(0, 60)}...
                  </p>
                </div>
                <div className="text-[10px] text-[#9CA3AF] font-mono shrink-0">{msg.created_at?.split("T")[0]}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] max-w-lg rounded-2xl" data-testid="compose-dialog">
          <DialogHeader><DialogTitle className="font-['Nunito'] text-xl font-bold">{t("messages.newMessage")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("messages.to")}</Label>
              <Select value={composeForm.to_user_id} onValueChange={v => setComposeForm({ ...composeForm, to_user_id: v })}>
                <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="compose-to"><SelectValue placeholder={t("messages.selectRecipient")} /></SelectTrigger>
                <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("messages.subject")}</Label>
              <Input value={composeForm.subject} onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })} required
                placeholder={t("messages.messageSubject")} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] rounded-lg" data-testid="compose-subject" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] text-xs uppercase tracking-wider font-bold">{t("messages.message")}</Label>
              <Textarea value={composeForm.body} onChange={e => setComposeForm({ ...composeForm, body: e.target.value })} required
                placeholder={t("messages.writeMessage")} className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] min-h-[120px] rounded-lg" data-testid="compose-body" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCompose(false)} className="text-[#9CA3AF] rounded-lg">{t("common.cancel")}</Button>
              <Button type="submit" disabled={sending || !composeForm.to_user_id}
                className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold gap-2" data-testid="compose-send-btn">
                {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="h-4 w-4" /> {t("messages.send")}</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
