// src/context/SettingsContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { getSettings } from "../storage";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();

  const [settings, setSettings] = useState({
    level:      "B1",
    cursive:    false,
    translitOn: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Night mode lives in localStorage — it's device-specific, not synced to Supabase
  const [nightMode, setNightModeState] = useState(() => {
    try { return localStorage.getItem("night_mode") === "true"; }
    catch { return false; }
  });

  const setNightMode = (val) => {
    setNightModeState(val);
    try { localStorage.setItem("night_mode", String(val)); } catch {}
  };

  useEffect(() => {
    if (!user) return;
    getSettings(user.uid).then(s => {
      if (s) {
        setSettings({
          level:      s.cefr_level     ?? "B1",
          cursive:    s.cursive_font   ?? false,
          translitOn: s.transliteration ?? false,
        });
      }
      setLoaded(true);
    });
  }, [user]);

  return (
  <SettingsContext.Provider value={{ ...settings, setSettings, loaded, nightMode, setNightMode }}>
    {children}
  </SettingsContext.Provider>
);
}

export const useSettings = () => useContext(SettingsContext);