// src/modules/Home/Home.jsx
// Temporary placeholder home screen for Phase A.
// Will be replaced with the full adaptive hub in Phase F.
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import styles from "./Home.module.css";

const MODULES = [
  { path: "/library",    label: "Библиотека", sub: "Reading library",   color: "#7aaec8" },
  { path: "/grammar",    label: "Грамматика", sub: "Cases & grammar",   color: "#7a9e7e" },
  { path: "/lessons",    label: "Уроки",      sub: "Structured lessons", color: "#b07c5a" },
  { path: "/vocabulary", label: "Словарь",    sub: "Vocabulary",        color: "#9a7ec8" },
  { path: "/drill",      label: "Тренировка", sub: "Drill mistakes",    color: "#c87a7a" },
];

export default function Home() {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>По-русски</h1>
      {user?.email && (
        <p className={styles.sub}>{user.email}</p>
      )}
      <div className={styles.grid}>
        {MODULES.map(m => (
          <button
            key={m.path}
            className={styles.card}
            onClick={() => navigate(m.path)}
            style={{ "--accent": m.color }}
          >
            <span className={`${styles.cardTitle} ru`}>{m.label}</span>
            <span className={styles.cardSub}>{m.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}