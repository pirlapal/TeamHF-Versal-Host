import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import ClientWizard from "@/pages/ClientWizard";
import Calendar from "@/pages/Calendar";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Messages from "@/pages/Messages";
import AdminSettings from "@/pages/AdminSettings";
import InviteAccept from "@/pages/InviteAccept";
import Layout from "@/components/Layout";
import "./App.css";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]"><div className="w-8 h-8 border-3 border-[#F97316]/20 border-t-[#F97316] rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/wizard" element={<ProtectedRoute roles={["ADMIN", "CASE_WORKER"]}><ClientWizard /></ProtectedRoute>} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<ProtectedRoute roles={["ADMIN"]}><Reports /></ProtectedRoute>} />
            <Route path="messages" element={<ProtectedRoute roles={["ADMIN", "CASE_WORKER"]}><Messages /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute roles={["ADMIN"]}><AdminSettings /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
