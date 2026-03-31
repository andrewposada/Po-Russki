// src/context/SettingsContext.jsx
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { getSettings, saveSettings } from "../storage";

const SettingsContext = createContext(null);

// ── Detect device dark mode preference ──────────────────────────────────────
function getDeviceDarkMode() {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; }
  catch { return false; }
}

// ── Has the user ever manually set night mode? ───────────────────────────────
function getStoredNightMode() {
  try {
    const stored = localStorage.getItem("night_mode");
    if (stored === null) return null;          // never touched → follow device
    return stored === "true";
  } catch { return null; }
}

export function SettingsProvider({ children }) {
  const { user } = useAuth();

  const [settings, setSettings] = useState({
    level:      "B1",
    cursive:    false,
    translitOn: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Night mode: null in localStorage means "follow device"
  const [nightMode, setNightModeState] = useState(() => {
    const stored = getStoredNightMode();
    return stored !== null ? stored : getDeviceDarkMode();
  });

  // Track whether user has manually overridden
  const userOverrodeRef = useRef(getStoredNightMode() !== null);

  // ── Follow device preference live (unless user has overridden) ────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!userOverrodeRef.current) {
        setNightModeState(e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Apply data-night to <html> so ALL CSS can react to it ─────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-night", String(nightMode));
  }, [nightMode]);

  // ── Public setter — marks as manual override ──────────────────────────────
  const setNightMode = (val) => {
    userOverrodeRef.current = true;
    setNightModeState(val);
    try { localStorage.setItem("night_mode", String(val)); } catch {}
  };

  // ── Reset to device default (optional, exposed for future use) ────────────
  const resetNightModeToDevice = () => {
    userOverrodeRef.current = false;
    try { localStorage.removeItem("night_mode"); } catch {}
    setNightModeState(getDeviceDarkMode());
  };

  // ── Alt key toggles Russian keyboard globally ─────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Alt") {
        e.preventDefault();
        toggleTranslitOn();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Load settings from Supabase ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getSettings(user.uid).then(s => {
      if (s) {
        setSettings({
          level:      s.cefr_level      ?? "B1",
          cursive:    s.cursive_font    ?? false,
          translitOn: s.transliteration ?? false,
        });
      }
      setLoaded(true);
    });
  }, [user]);

  // ── Auto-save a single field to Supabase ─────────────────────────────────
  const saveField = async (field, value) => {
    if (!user) return;
    const fieldMap = {
      level:      "cefrLevel",
      cursive:    "cursiveFont",
      translitOn: "transliteration",
    };
    await saveSettings(user.uid, {
      cefrLevel:       field === "level"      ? value : settings.level,
      cursiveFont:     field === "cursive"    ? value : settings.cursive,
      transliteration: field === "translitOn" ? value : settings.translitOn,
    });
  };

  // ── Individual setters that update context + auto-save ───────────────────
  const setLevel = (val) => {
    setSettings(s => ({ ...s, level: val }));
    saveField("level", val);
  };

  const setCursive = (val) => {
    setSettings(s => ({ ...s, cursive: val }));
    saveField("cursive", val);
  };

  const setTranslitOn = (val) => {
    setSettings(s => ({ ...s, translitOn: val }));
    saveField("translitOn", val);
  };

  const toggleTranslitOn = () => {
    setSettings(s => {
      const next = !s.translitOn;
      saveField("translitOn", next);
      return { ...s, translitOn: next };
    });
  };

  return (
    <SettingsContext.Provider value={{
      ...settings,
      setLevel,
      setCursive,
      setTranslitOn,
      toggleTranslitOn,
      setSettings,
      loaded,
      nightMode,
      setNightMode,
      resetNightModeToDevice,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);