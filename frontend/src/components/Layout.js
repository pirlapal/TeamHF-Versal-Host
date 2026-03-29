import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import AICopilot from "@/components/AICopilot";
import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#FFF8F0] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-14 border-b border-[#E8E8E8] bg-white flex items-center justify-between px-4 shrink-0 sticky top-0 z-30" data-testid="top-header">
          <Button variant="ghost" size="icon" className="md:hidden text-[#6B7280]" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-btn">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAiOpen(!aiOpen)}
            className="text-[#14B8A6] hover:bg-[#14B8A6]/10 gap-2 rounded-lg"
            data-testid="ai-copilot-toggle"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline text-sm font-medium">AI Assistant</span>
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      {aiOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setAiOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-50 md:static md:w-[420px] md:z-auto">
            <AICopilot onClose={() => setAiOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
