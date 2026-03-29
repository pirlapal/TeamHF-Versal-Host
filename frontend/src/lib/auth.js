import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      console.log('[AuthContext] User loaded:', { email: data.email, role: data.role, permissionCount: data.permissions?.length });
      setUser(data);
      return data;
    } catch (error) {
      console.error('[AuthContext] checkAuth failed:', error.message);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    // Fetch full user profile with permissions
    const userWithPermissions = await checkAuth();
    console.log('[AuthContext] Login complete with permissions:', userWithPermissions?.permissions?.length);
    return userWithPermissions || data;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    // Fetch full user profile with permissions
    await checkAuth();
    return data;
  };

  const onboard = async (formData) => {
    const { data } = await api.post("/onboard", formData);
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    // Fetch full user profile with permissions
    await checkAuth();
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, onboard, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
