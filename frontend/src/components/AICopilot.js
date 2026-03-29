import React, { useState, useRef, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, BotMessageSquare, User, Sparkles } from "lucide-react";

const QUICK_ACTIONS = [
  { label: "Summarize client", prompt: "Summarize this client's case history" },
  { label: "Suggest tags", prompt: "Suggest tags for this client" },
  { label: "Next actions", prompt: "Suggest next actions for this case" },
  { label: "Missing fields", prompt: "What fields are missing for this client?" },
];

export default function AICopilot({ onClose }) {
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hello! I'm your AI Copilot. I can help you summarize cases, suggest tags, recommend next actions, and identify missing information. How can I help?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (msg) => {
    const text = msg || input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/copilot", { message: text });
      let aiContent = "";
      if (data.type === "tags" && Array.isArray(data.content)) {
        aiContent = `Suggested tags: ${data.content.join(", ")}`;
      } else if (data.type === "actions" && Array.isArray(data.content)) {
        aiContent = `Recommended actions:\n${data.content.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      } else if (data.type === "missing_fields" && Array.isArray(data.content)) {
        aiContent = `Missing fields: ${data.content.join(", ")}`;
      } else {
        aiContent = data.content || "I couldn't process that request.";
      }
      setMessages((prev) => [...prev, { role: "ai", content: aiContent, model: data.model }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel h-full flex flex-col" data-testid="ai-copilot-panel">
      {/* Header */}
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <BotMessageSquare className="h-5 w-5 text-[#00E5FF]" />
          <span className="text-sm font-medium text-[#F9F9FB] font-['Outfit']">AI Copilot</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded-sm border border-[#00E5FF]/20 font-mono">AI</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-[#6E6E73] hover:text-[#F9F9FB]" data-testid="close-ai-panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-white/5 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            disabled={loading}
            className="text-[10px] px-2.5 py-1.5 bg-[#00E5FF]/5 text-[#00E5FF] border border-[#00E5FF]/20 rounded-sm hover:bg-[#00E5FF]/10 transition-colors disabled:opacity-50"
            data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Sparkles className="h-3 w-3 inline mr-1" />{action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="w-6 h-6 rounded-sm bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center shrink-0">
                  <BotMessageSquare className="h-3 w-3 text-[#00E5FF]" />
                </div>
              )}
              <div className={`max-w-[80%] p-3 rounded-sm text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#2A2A2D] text-[#F9F9FB]"
                  : "bg-transparent border border-[#00E5FF]/20 text-[#A0A0A5]"
              }`}>
                {msg.content}
                {msg.model && <p className="text-[10px] text-[#6E6E73] mt-2 font-mono">{msg.model}</p>}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-sm bg-[#2A2A2D] flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-[#A0A0A5]" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-sm bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center">
                <BotMessageSquare className="h-3 w-3 text-[#00E5FF]" />
              </div>
              <div className="p-3 border border-[#00E5FF]/20 rounded-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-[#00E5FF]/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-[#00E5FF]/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-[#00E5FF]/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-white/10 relative z-[60]">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI Copilot..."
            disabled={loading}
            className="bg-[#0A0A0B] border-[#2A2A2D] text-[#F9F9FB] placeholder:text-[#6E6E73] flex-1"
            data-testid="ai-chat-input"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon" className="bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-black shrink-0" data-testid="ai-send-btn">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
