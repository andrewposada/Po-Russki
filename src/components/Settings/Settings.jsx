// src/components/Settings/Settings.jsx
import { useState } from "react";
import { useAuth } from "../../AuthContext";
import { getAuth, signOut } from "firebase/auth";
import { useSettings } from "../../context/SettingsContext";
import { LEVELS, APP_VERSION, CHANGELOG } from "../../constants";
import styles from "./Settings.module.css";

export default function Settings({ onClose }) {
  const { user } = useAuth();
  const {
    level, setLevel,
    cursive, setCursive,
    translitOn, setTranslitOn,
    nightMode, setNightMode,
    loaded,
  } = useSettings();

  const [showLog, setShowLog] = useState(false);

  const handleSignOut = async () => {
    await signOut(getAuth());
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!loaded ? (
          <div className={styles.loading}>Loading…</div>
        ) : (
          <>
            {/* CEFR Level */}
            <section className={styles.section}>
              <p className={styles.label}>Your CEFR level</p>
              <div className={styles.pills}>
                {LEVELS.map(l => (
                  <button
                    key={l.id}
                    className={`${styles.pill} ${level === l.id ? styles.pillActive : ""}`}
                    onClick={() => setLevel(l.id)}
                  >
                    {l.id}
                  </button>
                ))}
              </div>
            </section>

            {/* Toggles */}
            <section className={styles.section}>
              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Cursive font</p>
                  <p className={styles.toggleSub}>Russian text displays in handwriting style</p>
                </div>
                <button
                  className={`${styles.toggle} ${cursive ? styles.toggleOn : ""}`}
                  onClick={() => setCursive(!cursive)}
                  aria-pressed={cursive}
                  aria-label="Cursive font"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Russian keyboard</p>
                  <p className={styles.toggleSub}>QWERTY keys type Cyrillic by default</p>
                </div>
                <button
                  className={`${styles.toggle} ${translitOn ? styles.toggleOn : ""}`}
                  onClick={() => setTranslitOn(!translitOn)}
                  aria-pressed={translitOn}
                  aria-label="Russian keyboard"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>🌙 Night mode</p>
                  <p className={styles.toggleSub}>Dark background for reading at night</p>
                </div>
                <button
                  className={`${styles.toggle} ${nightMode ? styles.toggleOn : ""}`}
                  onClick={() => setNightMode(!nightMode)}
                  aria-pressed={nightMode}
                  aria-label="Night mode"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
            </section>

            {/* Changelog */}
            <section className={styles.section}>
              <button className={styles.textBtn} onClick={() => setShowLog(v => !v)}>
                {showLog ? "Hide" : "Show"} changelog — v{APP_VERSION}
              </button>
              {showLog && (
                <div className={styles.changelog}>
                  {CHANGELOG.map(entry => (
                    <div key={entry.version} className={styles.changeEntry}>
                      <p className={styles.changeVersion}>v{entry.version} — {entry.date}</p>
                      {entry.summary && <p className={styles.changeSummary}>{entry.summary}</p>}
                      <ul className={styles.changeList}>
                        {entry.changes.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Usage */}
            <section className={styles.section}>
              <p className={styles.label}>Usage &amp; Quotas</p>
              <div className={styles.usageCards}>
                <a className={styles.usageCard} href="https://platform.claude.com/workspaces/default/cost" target="_blank" rel="noopener noreferrer">
                  <span className={styles.usageIcon}>🤖</span>
                  <span className={styles.usageName}>Claude</span>
                  <span className={styles.usageArrow}>↗</span>
                </a>
                <a className={styles.usageCard} href="https://supabase.com/dashboard/org/emspsaqbavppwvcpjcnu/usage?projectRef=segbmhztkgyglzaxdtlh" target="_blank" rel="noopener noreferrer">
                  <span className={styles.usageIcon}>🗄️</span>
                  <span className={styles.usageName}>Supabase</span>
                  <span className={styles.usageArrow}>↗</span>
                </a>
                <a className={styles.usageCard} href="https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas?authuser=1&facet_url=https:%2F%2Fcloud.google.com%2Ftranslate&project=project-c59d2519-30a6-4afe-9dc" target="_blank" rel="noopener noreferrer">
                  <span className={styles.usageIcon}>🌐</span>
                  <span className={styles.usageName}>Translate</span>
                  <span className={styles.usageArrow}>↗</span>
                </a>
              </div>
            </section>

            {/* Actions */}
            <div className={styles.actions}>
              <button className={styles.signOutBtn} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}