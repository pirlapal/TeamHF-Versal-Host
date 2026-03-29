import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import InviteAccept from "@/pages/InviteAccept";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import CalendarPage from "@/pages/Calendar";
import AdminSettings from "@/pages/AdminSettings";
import Payments from "@/pages/Payments";
import ClientWizard from "@/pages/ClientWizard";
import Layout from "@/components/Layout";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0055FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0055FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/onboard" element={<Onboarding />} />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/wizard" element={<ProtectedRoute roles={["ADMIN", "CASE_WORKER"]}><ClientWizard /></ProtectedRoute>} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/success" element={<Payments />} />
        <Route path="admin" element={<ProtectedRoute roles={["ADMIN"]}><AdminSettings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" theme="dark" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
