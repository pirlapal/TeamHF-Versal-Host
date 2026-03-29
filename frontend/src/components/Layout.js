import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import AICopilot from "@/components/AICopilot";
import { Menu, BotMessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#0A0A0B] overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-[#2A2A2D] bg-[#0A0A0B] flex items-center justify-between px-4 shrink-0 sticky top-0 z-30" data-testid="top-header">
          <Button variant="ghost" size="icon" className="md:hidden text-[#A0A0A5]" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-btn">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAiOpen(!aiOpen)}
            className="text-[#00E5FF] hover:bg-[#00E5FF]/10 gap-2"
            data-testid="ai-copilot-toggle"
          >
            <BotMessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">AI Copilot</span>
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* AI Copilot Panel */}
      {aiOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setAiOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 z-50 md:static md:w-96 md:z-auto">
            <AICopilot onClose={() => setAiOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
