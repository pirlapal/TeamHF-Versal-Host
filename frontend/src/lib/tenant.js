import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEFAULT_VOCAB = {
  clients: "Clients",
  client: "Client",
  services: "Services",
  visits: "Visits",
  outcomes: "Outcomes",
  dashboard: "Dashboard",
  calendar: "Calendar",
  payments: "Payments",
  reports: "Reports",
  messages: "Messages",
  settings: "Settings",
};

const TenantContext = createContext({
  vocab: DEFAULT_VOCAB,
  v: (key) => key,
  fieldSets: [],
  refreshVocab: () => {},
  refreshFieldSets: () => {},
});

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [vocab, setVocab] = useState(DEFAULT_VOCAB);
  const [fieldSets, setFieldSets] = useState([]);

  const refreshVocab = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/admin/vocabulary");
      // Handle both array format [{default_label, custom_label}] and object format {key: value}
      let mappings = {};
      if (Array.isArray(data)) {
        // Convert array to object: {default_label.toLowerCase(): custom_label}
        data.forEach(item => {
          if (item.default_label && item.custom_label) {
            const key = item.default_label.toLowerCase().replace(/\s+/g, '_');
            mappings[key] = item.custom_label;
            // Also add plural variant for singular terms
            if (key === 'client') mappings['clients'] = item.custom_label.endsWith('s') ? item.custom_label : item.custom_label + 's';
            if (key === 'service') mappings['services'] = item.custom_label.endsWith('s') ? item.custom_label : item.custom_label + 's';
            if (key === 'visit') mappings['visits'] = item.custom_label.endsWith('s') ? item.custom_label : item.custom_label + 's';
            if (key === 'outcome') mappings['outcomes'] = item.custom_label.endsWith('s') ? item.custom_label : item.custom_label + 's';
          }
        });
      } else {
        mappings = data.mappings || data || {};
      }
      setVocab((prev) => ({ ...prev, ...mappings }));
    } catch {}
  }, [user]);

  const refreshFieldSets = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/admin/field-sets");
      setFieldSets(data || []);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshVocab();
      refreshFieldSets();
    }
  }, [user, refreshVocab, refreshFieldSets]);

  // v() = vocabulary lookup helper. Returns custom label or falls back to key.
  const v = useCallback(
    (key) => {
      const k = key.toLowerCase();
      return vocab[k] || DEFAULT_VOCAB[k] || key;
    },
    [vocab]
  );

  return (
    <TenantContext.Provider value={{ vocab, v, fieldSets, refreshVocab, refreshFieldSets }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
