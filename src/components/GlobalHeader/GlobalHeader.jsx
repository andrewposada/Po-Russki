// src/components/GlobalHeader/GlobalHeader.jsx
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWordBank } from "../../context/WordBankContext";
import Settings from "../Settings/Settings";
import ProgressOverlay from "../ProgressOverlay/ProgressOverlay";
import CheatSheet from "../../modules/Grammar/CheatSheet";
import styles from "./GlobalHeader.module.css";

const ROUTE_LABELS = {
  "/":             null,
  "/library":      "Library",
  "/grammar":      "Grammar",
  "/conjugations": "Conjugations",
  "/vocabulary":   "Vocabulary",
  "/drill":        "Drill",
};

// Gear icon SVG
function GearIcon() {
  return (
    <svg width="24px" height="24px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21a8.985 8.985 0 0 1-1.755-.173 1 1 0 0 1-.791-.813l-.273-1.606a6.933 6.933 0 0 1-1.32-.762l-1.527.566a1 1 0 0 1-1.1-.278 8.977 8.977 0 0 1-1.756-3.041 1 1 0 0 1 .31-1.092l1.254-1.04a6.979 6.979 0 0 1 0-1.524L3.787 10.2a1 1 0 0 1-.31-1.092 8.977 8.977 0 0 1 1.756-3.042 1 1 0 0 1 1.1-.278l1.527.566a6.933 6.933 0 0 1 1.32-.762l.274-1.606a1 1 0 0 1 .791-.813 8.957 8.957 0 0 1 3.51 0 1 1 0 0 1 .791.813l.273 1.606a6.933 6.933 0 0 1 1.32.762l1.527-.566a1 1 0 0 1 1.1.278 8.977 8.977 0 0 1 1.756 3.041 1 1 0 0 1-.31 1.092l-1.254 1.04a6.979 6.979 0 0 1 0 1.524l1.254 1.04a1 1 0 0 1 .31 1.092 8.977 8.977 0 0 1-1.756 3.041 1 1 0 0 1-1.1.278l-1.527-.566a6.933 6.933 0 0 1-1.32.762l-.273 1.606a1 1 0 0 1-.791.813A8.985 8.985 0 0 1 12 21zm-.7-2.035a6.913 6.913 0 0 0 1.393 0l.247-1.451a1 1 0 0 1 .664-.779 4.974 4.974 0 0 0 1.696-.975 1 1 0 0 1 1.008-.186l1.381.512a7.012 7.012 0 0 0 .7-1.206l-1.133-.939a1 1 0 0 1-.343-.964 5.018 5.018 0 0 0 0-1.953 1 1 0 0 1 .343-.964l1.124-.94a7.012 7.012 0 0 0-.7-1.206l-1.38.512a1 1 0 0 1-1-.186 4.974 4.974 0 0 0-1.688-.976 1 1 0 0 1-.664-.779l-.248-1.45a6.913 6.913 0 0 0-1.393 0l-.25 1.45a1 1 0 0 1-.664.779A4.974 4.974 0 0 0 8.7 8.24a1 1 0 0 1-1 .186l-1.385-.512a7.012 7.012 0 0 0-.7 1.206l1.133.939a1 1 0 0 1 .343.964 5.018 5.018 0 0 0 0 1.953 1 1 0 0 1-.343.964l-1.128.94a7.012 7.012 0 0 0 .7 1.206l1.38-.512a1 1 0 0 1 1 .186 4.974 4.974 0 0 0 1.688.976 1 1 0 0 1 .664.779zm.7-3.725a3.24 3.24 0 0 1 0-6.48 3.24 3.24 0 0 1 0 6.48zm0-4.48A1.24 1.24 0 1 0 13.24 12 1.244 1.244 0 0 0 12 10.76z"/>
    </svg>
  );
}

export default function GlobalHeader() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { open: openWordBank } = useWordBank();

  const [activeOverlay, setActiveOverlay] = useState(null); // "reference" | "progress" | "settings" | null
  const [mobileOpen, setMobileOpen]       = useState(false);
  const mobileRef = useRef(null);

  const locationLabel = (() => {
    const exact = ROUTE_LABELS[location.pathname];
    if (exact !== undefined) return exact;
    if (location.pathname.startsWith("/library")) return "Library";
    return null;
  })();

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const toggle = (name) => setActiveOverlay(a => a === name ? null : name);

  const handleWords = () => {
    setMobileOpen(false);
    openWordBank();
  };

  const buttons = [
    {
      key: "reference",
      label: "Reference",
      colorClass: styles.btnRef,
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
      onClick: () => { setMobileOpen(false); toggle("reference"); },
    },
    {
      key: "progress",
      label: "Progress",
      colorClass: styles.btnProg,
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 12l3-4 2.5 2 3-5 2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      onClick: () => { setMobileOpen(false); toggle("progress"); },
    },
    {
      key: "words",
      label: "Words",
      colorClass: styles.btnWords,
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 8h8M4 5h8M4 11h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
      onClick: handleWords,
    },
    {
      key: "settings",
      label: "Settings",
      colorClass: styles.btnSettings,
      icon: <GearIcon />,
      onClick: () => { setMobileOpen(false); toggle("settings"); },
    },
  ];

  return (
    <>
      <header className={styles.header}>
        {/* Left: monogram + title + location */}
        <button className={styles.logoBtn} onClick={() => navigate("/")} aria-label="Home">
          <div className={styles.mark}>П</div>
          <div className={styles.titleGroup}>
            <span className={styles.title}>По-русски</span>
            {locationLabel && (
              <span className={styles.location}>{locationLabel}</span>
            )}
          </div>
        </button>

        {/* Desktop buttons */}
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {buttons.map(b => (
            <button
              key={b.key}
              className={`${styles.btn} ${b.colorClass} ${activeOverlay === b.key ? styles.active : ""}`}
              onClick={b.onClick}
              aria-pressed={activeOverlay === b.key}
            >
              {b.icon}
              {b.label}
            </button>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className={styles.mobileNav} ref={mobileRef}>
          <button
            className={`${styles.hamburger} ${mobileOpen ? styles.hamburgerOpen : ""}`}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            <span /><span /><span />
          </button>
          {mobileOpen && (
            <div className={styles.dropdown} role="menu">
              {buttons.map(b => (
                <button
                  key={b.key}
                  className={`${styles.ddItem} ${b.colorClass}`}
                  onClick={b.onClick}
                  role="menuitem"
                >
                  {b.icon}
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Overlays */}
      {activeOverlay === "reference" && (
        <CheatSheet
          onClose={() => setActiveOverlay(null)}
          completions={{}}
          initialTopicId={null}
        />
      )}
      {activeOverlay === "progress" && (
        <ProgressOverlay onClose={() => setActiveOverlay(null)} />
      )}
      {activeOverlay === "settings" && (
        <Settings onClose={() => setActiveOverlay(null)} />
      )}
    </>
  );
}