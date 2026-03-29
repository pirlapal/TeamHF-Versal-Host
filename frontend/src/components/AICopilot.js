import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Send, Sparkles, User, UserPlus, CalendarPlus, ClipboardList, Target } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";

const QUICK_ACTIONS = [
  { label: "Summarize client", prompt: "Summarize this client's case history" },
  { label: "Suggest tags", prompt: "Suggest tags for this client" },
  { label: "Next actions", prompt: "Suggest next actions for this case" },
  { label: "Missing fields", prompt: "What fields are missing for this client?" },
];

const TEMPLATE_ICONS = { "create_client": UserPlus, "schedule_visit": CalendarPlus, "log_service": ClipboardList, "add_outcome": Target };

export default function AICopilot({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-detect client_id from URL (e.g. /clients/abc123)
  const getClientIdFromUrl = () => {
    const match = location.pathname.match(/\/clients\/([a-f0-9]{24})/);
    return match ? match[1] : "";
  };
  const activeClientId = getClientIdFromUrl();
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hi there! I'm your AI assistant. I can help with case summaries, suggestions, and I can also help you create clients, schedule visits, and log services. Try a quick action or pick a template below!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTemplate, setConfirmTemplate] = useState(null);
  const [confirmData, setConfirmData] = useState({});
  const [clients, setClients] = useState([]);
  const [executing, setExecuting] = useState(false);
  const scrollRef = useRef(null);

  const fetchClients = async () => {
    try {
      const { data } = await api.get("/clients", { params: { page_size: 100 } });
      setClients(data?.data || []);
    } catch {}
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const [tRes, cRes] = await Promise.all([api.get("/ai/templates"), api.get("/clients", { params: { page_size: 100 } })]);
        setTemplates(tRes.data);
        setClients(cRes.data?.data || []);
      } catch {}
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (msg) => {
    const text = msg || input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/copilot", { message: text, client_id: activeClientId });
      let aiContent = "";
      if (data.type === "tags" && Array.isArray(data.content)) aiContent = `Suggested tags: ${data.content.join(", ")}`;
      else if (data.type === "actions" && Array.isArray(data.content)) aiContent = `Recommended actions:\n${data.content.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      else if (data.type === "missing_fields" && Array.isArray(data.content)) aiContent = `Missing fields: ${data.content.join(", ")}`;
      else aiContent = data.content || "I couldn't process that request.";
      setMessages((prev) => [...prev, { role: "ai", content: aiContent, model: data.model }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Sorry, something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  };

  const handleTemplateClick = async (template) => {
    setMessages((prev) => [...prev, { role: "ai", content: `Opening "${template.label}" form. Fill in the details and confirm to proceed.` }]);
    try {
      const { data } = await api.post("/ai/generate-form", { template_id: template.id });
      setConfirmTemplate(data.template);
      setConfirmData(data.prefill);
      setShowConfirm(true);
    } catch {
      const fallback = {};
      (template.fields || []).forEach(f => { fallback[f.key] = f.default || ""; });
      setConfirmTemplate(template);
      setConfirmData(fallback);
      setShowConfirm(true);
    }
  };

  const handleConfirmExecute = async () => {
    if (!confirmTemplate) return;
    setExecuting(true);
    try {
      let endpoint = "";
      let payload = { ...confirmData };
      const clientId = payload.client_id;

      if (confirmTemplate.id === "create_client") {
        endpoint = "/clients";
        delete payload.client_id;
      } else if (confirmTemplate.id === "schedule_visit") {
        endpoint = "/visits";
      } else if (confirmTemplate.id === "log_service") {
        endpoint = `/clients/${clientId}/services`;
        delete payload.client_id;
      } else if (confirmTemplate.id === "add_outcome") {
        endpoint = `/clients/${clientId}/outcomes`;
        delete payload.client_id;
      }

      const { data } = await api.post(endpoint, payload);
      setShowConfirm(false);
      setMessages((prev) => [...prev, { role: "ai", content: `Done! "${confirmTemplate.label}" completed successfully. ${data.id ? `ID: ${data.id}` : ""}` }]);
      toast.success(`${confirmTemplate.label} completed!`);

      // Refresh clients list after creating a new client so it's available for scheduling visits
      if (confirmTemplate.id === "create_client") {
        await fetchClients();
        if (data.id) {
          navigate(`/clients/${data.id}`);
        }
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
      setMessages((prev) => [...prev, { role: "ai", content: `Oops, there was an error: ${formatApiError(err.response?.data?.detail)}` }]);
    } finally { setExecuting(false); }
  };

  const updateField = (key, value) => setConfirmData(prev => ({ ...prev, [key]: value }));

  return (
    <div className="ai-panel h-full flex flex-col bg-white" data-testid="ai-copilot-panel">
      {/* Header */}
      <div className="h-14 border-b border-[#E8E8E8] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#2DD4BF] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-[#1F2937] font-['Nunito']">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-[#9CA3AF] hover:text-[#1F2937] rounded-lg" data-testid="close-ai-panel"><X className="h-4 w-4" /></Button>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-[#F3F4F6] flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((action) => (
          <button key={action.label} onClick={() => sendMessage(action.prompt)} disabled={loading}
            className="text-[10px] px-2.5 py-1.5 bg-[#F0FDFA] text-[#14B8A6] border border-[#99F6E4] rounded-full hover:bg-[#CCFBF1] transition-colors disabled:opacity-50 font-semibold"
            data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
            {action.label}
          </button>
        ))}
      </div>

      {/* AI Action Templates */}
      {templates.length > 0 && (
        <div className="p-3 border-b border-[#F3F4F6]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => {
              const Icon = TEMPLATE_ICONS[t.id] || Sparkles;
              return (
                <button key={t.id} onClick={() => handleTemplateClick(t)}
                  className="flex items-center gap-2 p-2.5 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-left hover:bg-[#FFEDD5] transition-colors"
                  data-testid={`template-${t.id}`}>
                  <Icon className="h-4 w-4 text-[#F97316] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#1F2937]">{t.label}</p>
                    <p className="text-[10px] text-[#9CA3AF] line-clamp-1">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#2DD4BF] flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                msg.role === "user" ? "bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white whitespace-pre-wrap" : "bg-[#F3F4F6] text-[#374151]"
              }`}>
                {msg.role === "ai" ? (
                  <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-[#1F2937] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n- /g, '\n<br/>• ')
                      .replace(/\n(\d+)\. /g, '\n<br/>$1. ')
                      .replace(/\n{2,}/g, '<br/><br/>')
                      .replace(/\n/g, '<br/>')
                    }} />
                ) : msg.content}
                {msg.model && <p className="text-[10px] mt-2 font-mono opacity-60">{msg.model}</p>}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-[#6B7280]" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#2DD4BF] flex items-center justify-center"><Sparkles className="h-3 w-3 text-white" /></div>
              <div className="p-3 bg-[#F3F4F6] rounded-xl"><div className="flex gap-1"><div className="w-2 h-2 bg-[#14B8A6]/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} /><div className="w-2 h-2 bg-[#14B8A6]/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} /><div className="w-2 h-2 bg-[#14B8A6]/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} /></div></div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-[#E8E8E8] relative z-[60]">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..." disabled={loading}
            className="bg-[#FAFAF8] border-[#E5E7EB] text-[#1F2937] placeholder:text-[#D1D5DB] flex-1 rounded-lg" data-testid="ai-chat-input" />
          <Button type="submit" disabled={loading || !input.trim()} size="icon" className="bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] hover:from-[#0D9488] hover:to-[#14B8A6] text-white shrink-0 rounded-lg" data-testid="ai-send-btn">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-white border-[#E8E8E8] text-[#1F2937] max-w-lg rounded-2xl" data-testid="ai-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Nunito'] font-bold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                {confirmTemplate && TEMPLATE_ICONS[confirmTemplate.id] ? React.createElement(TEMPLATE_ICONS[confirmTemplate.id], { className: "h-4 w-4 text-[#F97316]" }) : <Sparkles className="h-4 w-4 text-[#F97316]" />}
              </div>
              {confirmTemplate?.label || "Confirm Action"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#9CA3AF]">{confirmTemplate?.description} Review and edit the details below, then confirm.</p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {(confirmTemplate?.fields || []).map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-[#6B7280] text-xs uppercase font-bold">{field.label} {field.required && "*"}</Label>
                {field.type === "client_select" ? (
                  <Select value={confirmData[field.key] || ""} onValueChange={(v) => updateField(field.key, v)}>
                    <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" data-testid={`confirm-${field.key}`}><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent className="bg-white border-[#E8E8E8] max-h-48 rounded-xl">
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === "select" ? (
                  <Select value={confirmData[field.key] || ""} onValueChange={(v) => updateField(field.key, v)}>
                    <SelectTrigger className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" data-testid={`confirm-${field.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white border-[#E8E8E8] rounded-xl">
                      {(field.options || []).map((opt) => <SelectItem key={opt} value={opt}>{opt.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea value={confirmData[field.key] || ""} onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder || ""} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg min-h-[60px]" data-testid={`confirm-${field.key}`} />
                ) : (
                  <Input type={field.type || "text"} value={confirmData[field.key] || ""} onChange={(e) => updateField(field.key, field.type === "number" ? parseInt(e.target.value) || 0 : e.target.value)}
                    placeholder={field.placeholder || ""} className="bg-[#FAFAF8] border-[#E5E7EB] rounded-lg" data-testid={`confirm-${field.key}`} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowConfirm(false)} className="text-[#9CA3AF] rounded-lg">Cancel</Button>
            <Button onClick={handleConfirmExecute} disabled={executing} className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-lg font-bold gap-2" data-testid="confirm-action-btn">
              {executing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Confirm & Execute</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
