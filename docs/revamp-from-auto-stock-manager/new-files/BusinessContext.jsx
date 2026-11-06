import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "./AuthContext";
import { ALL_MODULE_IDS } from "../utils/modules";

const BusinessContext = createContext({ ready: false, onboarded: true, enabled: ALL_MODULE_IDS, has: () => true });

// The company's builder answers and the services it switched on. A company that predates the
// builder (profile {legacy: true}) keeps every service; a new one starts with onboarded=false.
export function BusinessProvider({ children }) {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);

  const username = user?.username;
  const refresh = useCallback(async () => {
    try { setProfile((await api.get("/business-profile")).data); }
    catch { setProfile({ onboarded: true, legacy: true }); } // never lock people out over this
    setLoadedFor(username);
  }, [username]);

  const needsProfile = !!(user && token) && user.role !== "platform_owner";
  useEffect(() => { if (needsProfile) refresh(); else setProfile(null); }, [needsProfile, refresh]);
  // Not ready until the profile for THIS login has arrived, so no one flashes a dashboard first.
  const ready = !needsProfile || loadedFor === username;

  const enabled = !profile || profile.legacy || !profile.modules?.length ? ALL_MODULE_IDS : profile.modules;
  const value = {
    ready, profile, refresh, enabled,
    onboarded: profile ? profile.onboarded !== false : true,
    has: (id) => enabled.includes(id),
  };
  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export const useBusiness = () => useContext(BusinessContext);
