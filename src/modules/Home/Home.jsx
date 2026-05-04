// src/modules/Home/Home.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import styles from "./Home.module.css";

// ── Helpers ────────────────────────────────────────────────────────────────

function getDayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });
}

import { useHomeRecommendations } from "../../hooks/useHomeRecommendations";

// ── SVG Illustrations ──────────────────────────────────────────────────────

function LibScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 380 560" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="560" fill="#1a2e24"/>
      <rect x="200" y="20" width="160" height="220" rx="6" fill="#2a4a38" opacity="0.6"/>
      <rect x="212" y="32" width="64" height="96" rx="3" fill="#c8e8d8" opacity="0.12"/>
      <rect x="284" y="32" width="64" height="96" rx="3" fill="#c8e8d8" opacity="0.12"/>
      <rect x="212" y="136" width="64" height="96" rx="3" fill="#c8e8d8" opacity="0.08"/>
      <rect x="284" y="136" width="64" height="96" rx="3" fill="#c8e8d8" opacity="0.08"/>
      <rect x="109" y="225" width="7" height="215" rx="3" fill="#5a4830"/>
      <ellipse cx="112" cy="440" rx="32" ry="7" fill="#3a2a18"/>
      <path d="M82 192 L142 192 L154 232 L70 232 Z" fill="#d4b46a"/>
      <path d="M82 192 L142 192 L148 200 L76 200 Z" fill="#c8a858" opacity="0.6"/>
      <line x1="70" y1="232" x2="154" y2="232" stroke="#a88840" strokeWidth="1.5" opacity="0.5"/>
      <line x1="82" y1="192" x2="142" y2="192" stroke="#e8c878" strokeWidth="1.5" opacity="0.5"/>
      <ellipse cx="112" cy="248" rx="70" ry="50" fill="#f5c842" opacity="0.07"/>
      <ellipse cx="112" cy="280" rx="110" ry="90" fill="#f5c842" opacity="0.04"/>
      <rect x="22" y="346" width="196" height="110" rx="16" fill="#2e4a38"/>
      <rect x="22" y="282" width="196" height="80" rx="14" fill="#2e4a38"/>
      <rect x="18" y="310" width="28" height="100" rx="10" fill="#264038"/>
      <rect x="194" y="310" width="28" height="100" rx="10" fill="#264038"/>
      <rect x="36" y="350" width="168" height="72" rx="10" fill="#3e5e4a"/>
      <rect x="36" y="292" width="168" height="62" rx="10" fill="#3e5e4a"/>
      <path d="M46 368 Q110 358 120 362 Q130 358 194 368 L194 408 Q130 398 120 402 Q110 398 46 408 Z" fill="#f0e8d4"/>
      <rect x="117" y="358" width="6" height="50" rx="2" fill="#b89050"/>
      <line x1="58" y1="374" x2="114" y2="370" stroke="#c0b49a" strokeWidth="1.2" opacity="0.55"/>
      <line x1="58" y1="382" x2="114" y2="378" stroke="#c0b49a" strokeWidth="1.2" opacity="0.45"/>
      <line x1="58" y1="390" x2="114" y2="386" stroke="#c0b49a" strokeWidth="1.2" opacity="0.35"/>
      <line x1="58" y1="398" x2="114" y2="394" stroke="#c0b49a" strokeWidth="1.2" opacity="0.25"/>
      <line x1="126" y1="370" x2="182" y2="374" stroke="#b8ac92" strokeWidth="1.2" opacity="0.55"/>
      <line x1="126" y1="378" x2="182" y2="382" stroke="#b8ac92" strokeWidth="1.2" opacity="0.45"/>
      <line x1="126" y1="386" x2="178" y2="390" stroke="#b8ac92" strokeWidth="1.2" opacity="0.35"/>
      <rect x="280" y="300" width="12" height="40" rx="3" fill="#3a2a18"/>
      <ellipse cx="286" cy="298" rx="22" ry="30" fill="#2d5a38"/>
      <ellipse cx="278" cy="310" rx="14" ry="20" fill="#3a6a44"/>
      <ellipse cx="296" cy="308" rx="14" ry="22" fill="#266a38"/>
      <rect x="240" y="280" width="130" height="8" rx="2" fill="#4a3a28"/>
      <rect x="248" y="230" width="14" height="52" rx="2" fill="#8b4a4a"/>
      <rect x="264" y="238" width="12" height="44" rx="2" fill="#4a6a8b"/>
      <rect x="278" y="234" width="16" height="48" rx="2" fill="#8b7a4a"/>
      <rect x="296" y="240" width="10" height="42" rx="2" fill="#5a4a8b"/>
      <rect x="308" y="236" width="14" height="46" rx="2" fill="#4a8b5a"/>
      <rect x="324" y="244" width="12" height="38" rx="2" fill="#8b5a4a"/>
      <rect x="338" y="238" width="14" height="44" rx="2" fill="#6a4a8b"/>
      <ellipse cx="120" cy="470" rx="140" ry="28" fill="#3a2a18" opacity="0.5"/>
      <ellipse cx="120" cy="468" rx="110" ry="20" fill="#2a1e14" opacity="0.4"/>
      <rect x="0" y="490" width="380" height="70" fill="#1a1210" opacity="0.8"/>
      <path d="M72 215 L20 420 L200 420 L152 215 Z" fill="#f5c842" opacity="0.025"/>
      <text x="68" y="378" fontFamily="Georgia, serif" fontSize="5" fill="#a09880" opacity="0.4" transform="rotate(-8 100 398)">Было темно</text>
      <text x="148" y="372" fontFamily="Georgia, serif" fontSize="5" fill="#a09880" opacity="0.35" transform="rotate(5 178 390)">и тихо в</text>
    </svg>
  );
}

function GramScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="280" fill="#1a2e3a"/>
      <rect x="30" y="24" width="320" height="200" rx="8" fill="#1e3d30"/>
      <rect x="30" y="24" width="320" height="200" rx="8" fill="none" stroke="#4a3a28" strokeWidth="6"/>
      <ellipse cx="190" cy="124" rx="100" ry="30" fill="white" opacity="0.02"/>
      <text x="70" y="58" fontFamily="Georgia, serif" fontSize="13" fill="white" opacity="0.75" fontStyle="italic">падежи</text>
      <line x1="50" y1="72" x2="330" y2="72" stroke="white" strokeWidth="0.8" opacity="0.2"/>
      <text x="52" y="92" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">Именительный</text>
      <text x="220" y="92" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.45">кто? что?</text>
      <text x="52" y="114" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">Родительный</text>
      <text x="220" y="114" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.45">кого? чего?</text>
      <text x="52" y="136" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">Дательный</text>
      <text x="220" y="136" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.45">кому? чему?</text>
      <text x="52" y="158" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">Винительный</text>
      <text x="220" y="158" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.45">кого? что?</text>
      <text x="52" y="180" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.35">Творительный</text>
      <text x="220" y="180" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.3">кем? чем?</text>
      <text x="52" y="202" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.25">Предложный</text>
      <text x="220" y="202" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.2">о ком? о чём?</text>
      <rect x="52" y="94" width="150" height="2" rx="1" fill="#f5e44a" opacity="0.6"/>
      <rect x="310" y="218" width="32" height="10" rx="3" fill="white" opacity="0.25" transform="rotate(-5 326 223)"/>
      <rect x="280" y="220" width="22" height="8" rx="3" fill="#e8c8a8" opacity="0.2" transform="rotate(3 291 224)"/>
      <rect x="50" y="218" width="280" height="10" rx="2" fill="#4a3a28"/>
      <text x="300" y="52" fontFamily="Georgia, serif" fontSize="9" fill="white" opacity="0.3">62 уроков</text>
    </svg>
  );
}

function LessScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="280" fill="#2e1e0e"/>
      <circle cx="190" cy="140" r="180" fill="#3a2414" opacity="0.6"/>
      <ellipse cx="190" cy="155" rx="52" ry="24" fill="#c87a2a"/>
      <text x="190" y="162" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fill="white" fontWeight="bold">читать</text>
      <line x1="190" y1="131" x2="70" y2="72" stroke="#c87a2a" strokeWidth="1.5" opacity="0.5"/>
      <line x1="190" y1="131" x2="150" y2="60" stroke="#c87a2a" strokeWidth="1.5" opacity="0.5"/>
      <line x1="190" y1="131" x2="230" y2="60" stroke="#c87a2a" strokeWidth="1.5" opacity="0.5"/>
      <line x1="190" y1="131" x2="310" y2="72" stroke="#c87a2a" strokeWidth="1.5" opacity="0.5"/>
      <line x1="190" y1="179" x2="70" y2="228" stroke="#c87a2a" strokeWidth="1.5" opacity="0.4"/>
      <line x1="190" y1="179" x2="150" y2="232" stroke="#c87a2a" strokeWidth="1.5" opacity="0.4"/>
      <line x1="190" y1="179" x2="230" y2="232" stroke="#c87a2a" strokeWidth="1.5" opacity="0.4"/>
      <line x1="190" y1="179" x2="310" y2="228" stroke="#c87a2a" strokeWidth="1.5" opacity="0.4"/>
      <ellipse cx="70" cy="56" rx="34" ry="16" fill="#3a2414"/>
      <text x="70" y="61" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.8">читаю</text>
      <ellipse cx="150" cy="44" rx="34" ry="16" fill="#3a2414"/>
      <text x="150" y="49" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.8">читаешь</text>
      <ellipse cx="230" cy="44" rx="34" ry="16" fill="#3a2414"/>
      <text x="230" y="49" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.8">читает</text>
      <ellipse cx="310" cy="56" rx="34" ry="16" fill="#3a2414"/>
      <text x="310" y="61" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.8">читаем</text>
      <ellipse cx="70" cy="242" rx="34" ry="16" fill="#3a2414" opacity="0.7"/>
      <text x="70" y="247" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">читал</text>
      <ellipse cx="150" cy="248" rx="34" ry="16" fill="#3a2414" opacity="0.7"/>
      <text x="150" y="253" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">читала</text>
      <ellipse cx="230" cy="248" rx="34" ry="16" fill="#3a2414" opacity="0.7"/>
      <text x="230" y="253" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">читало</text>
      <ellipse cx="310" cy="242" rx="34" ry="16" fill="#3a2414" opacity="0.7"/>
      <text x="310" y="247" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">читали</text>
      <text x="190" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fill="white" opacity="0.3" letterSpacing="2">настоящее</text>
      <text x="190" y="278" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fill="white" opacity="0.2" letterSpacing="2">прошедшее</text>
    </svg>
  );
}

function VocabScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 380 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="200" fill="#1e1530"/>
      <rect x="240" y="28" width="110" height="70" rx="8" fill="#2e2244" transform="rotate(14 295 63)" opacity="0.5"/>
      <rect x="30" y="40" width="100" height="66" rx="8" fill="#2e2244" transform="rotate(-10 80 73)" opacity="0.6"/>
      <rect x="160" y="50" width="110" height="70" rx="8" fill="#3a2e58" transform="rotate(6 215 85)"/>
      <text x="215" y="82" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="white" opacity="0.6" transform="rotate(6 215 85)">привет</text>
      <line x1="175" y1="95" x2="250" y2="95" stroke="white" strokeWidth="0.8" opacity="0.2" transform="rotate(6 215 85)"/>
      <text x="215" y="107" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fill="white" opacity="0.3" transform="rotate(6 215 85)">hello</text>
      <rect x="20" y="60" width="110" height="70" rx="8" fill="#4a3a70" transform="rotate(-7 75 95)"/>
      <text x="75" y="90" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="white" opacity="0.7" transform="rotate(-7 75 95)">спасибо</text>
      <line x1="32" y1="103" x2="112" y2="103" stroke="white" strokeWidth="0.8" opacity="0.2" transform="rotate(-7 75 95)"/>
      <text x="75" y="115" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fill="white" opacity="0.35" transform="rotate(-7 75 95)">thank you</text>
      <rect x="220" y="30" width="130" height="84" rx="10" fill="#5a4888"/>
      <rect x="220" y="30" width="130" height="84" rx="10" fill="none" stroke="white" strokeWidth="0.7" opacity="0.2"/>
      <text x="285" y="66" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fill="white" fontWeight="bold">дружба</text>
      <line x1="234" y1="78" x2="336" y2="78" stroke="white" strokeWidth="0.8" opacity="0.25"/>
      <text x="285" y="93" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fill="white" opacity="0.45">friendship</text>
      <text x="338" y="50" fontSize="12" fill="#f0c040" opacity="0.7">★</text>
      <rect x="16" y="150" width="348" height="34" rx="8" fill="#2e2444" opacity="0.7"/>
      <text x="30" y="171" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.55">8 cards due today</text>
      <rect x="248" y="156" width="100" height="22" rx="6" fill="#5a4888"/>
      <text x="298" y="171" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="white" opacity="0.9">Повторять →</text>
    </svg>
  );
}

function TabuScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 380 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="200" fill="#1e1020"/>
      <circle cx="260" cy="100" r="160" fill="#2e1a38" opacity="0.7"/>
      <rect x="178" y="18" width="140" height="170" rx="10" fill="#3a2448" transform="rotate(8 248 103)"/>
      <rect x="168" y="14" width="140" height="170" rx="10" fill="#f5f0fa"/>
      <rect x="168" y="14" width="140" height="46" rx="10" fill="#c83060"/>
      <rect x="168" y="42" width="140" height="18" fill="#c83060"/>
      <text x="238" y="44" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fill="white" fontWeight="bold" letterSpacing="3">ТАБУ</text>
      <text x="238" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fill="#1a1020" fontWeight="bold">собака</text>
      <line x1="182" y1="94" x2="294" y2="94" stroke="#e0d0e8" strokeWidth="1.2"/>
      <text x="196" y="114" fontFamily="Georgia, serif" fontSize="11" fill="#c83060" opacity="0.8">✕</text>
      <text x="210" y="114" fontFamily="Georgia, serif" fontSize="11" fill="#6a5a78" opacity="0.75">пёс</text>
      <text x="196" y="132" fontFamily="Georgia, serif" fontSize="11" fill="#c83060" opacity="0.8">✕</text>
      <text x="210" y="132" fontFamily="Georgia, serif" fontSize="11" fill="#6a5a78" opacity="0.75">животное</text>
      <text x="196" y="150" fontFamily="Georgia, serif" fontSize="11" fill="#c83060" opacity="0.8">✕</text>
      <text x="210" y="150" fontFamily="Georgia, serif" fontSize="11" fill="#6a5a78" opacity="0.75">питомец</text>
      <text x="196" y="168" fontFamily="Georgia, serif" fontSize="11" fill="#c83060" opacity="0.55">✕</text>
      <text x="210" y="168" fontFamily="Georgia, serif" fontSize="11" fill="#6a5a78" opacity="0.45">лаять</text>
      <rect x="14" y="30" width="110" height="140" rx="8" fill="#2e1a3a" opacity="0.6" transform="rotate(-12 69 100)"/>
      <rect x="22" y="36" width="110" height="140" rx="8" fill="#3a2448" opacity="0.5" transform="rotate(-5 77 106)"/>
    </svg>
  );
}

function MuzScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 1040 150" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="1040" height="150" fill="#141028"/>
      <ellipse cx="320" cy="75" rx="300" ry="120" fill="#2a1e48" opacity="0.8"/>
      <circle cx="880" cy="75" r="110" fill="#1e1830"/>
      <circle cx="880" cy="75" r="90" fill="#181428"/>
      <circle cx="880" cy="75" r="72" fill="#201c34"/>
      <circle cx="880" cy="75" r="54" fill="#1a1628"/>
      <circle cx="880" cy="75" r="36" fill="#c8a030" opacity="0.9"/>
      <circle cx="880" cy="75" r="24" fill="#1a1628"/>
      <circle cx="880" cy="75" r="10" fill="#c8a030" opacity="0.7"/>
      <circle cx="880" cy="75" r="4" fill="#1a1628"/>
      <circle cx="880" cy="75" r="62" fill="none" stroke="white" strokeWidth="0.5" opacity="0.06"/>
      <circle cx="880" cy="75" r="82" fill="none" stroke="white" strokeWidth="0.5" opacity="0.06"/>
      <circle cx="880" cy="75" r="100" fill="none" stroke="white" strokeWidth="0.5" opacity="0.06"/>
      <text x="880" y="71" textAnchor="middle" fontFamily="Georgia,serif" fontSize="7" fill="#1a1628" opacity="0.7" letterSpacing="1">ПО-РУССКИ</text>
      <text x="880" y="82" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fill="#1a1628" opacity="0.5">RECORDS</text>
      <line x1="970" y1="20" x2="912" y2="58" stroke="#c0b090" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <circle cx="970" cy="18" r="6" fill="#c0b090" opacity="0.6"/>
      <line x1="60" y1="38" x2="600" y2="38" stroke="white" strokeWidth="0.8" opacity="0.12"/>
      <line x1="60" y1="48" x2="600" y2="48" stroke="white" strokeWidth="0.8" opacity="0.12"/>
      <line x1="60" y1="58" x2="600" y2="58" stroke="white" strokeWidth="0.8" opacity="0.12"/>
      <line x1="60" y1="68" x2="600" y2="68" stroke="white" strokeWidth="0.8" opacity="0.12"/>
      <line x1="60" y1="78" x2="600" y2="78" stroke="white" strokeWidth="0.8" opacity="0.12"/>
      <text x="62" y="76" fontFamily="Georgia,serif" fontSize="52" fill="white" opacity="0.18">𝄞</text>
      <text x="120" y="44" fontFamily="Georgia,serif" fontSize="18" fill="white" opacity="0.35">♩</text>
      <text x="158" y="52" fontFamily="Georgia,serif" fontSize="14" fill="#c8a030" opacity="0.5">♪</text>
      <text x="200" y="40" fontFamily="Georgia,serif" fontSize="20" fill="white" opacity="0.28">♫</text>
      <text x="248" y="56" fontFamily="Georgia,serif" fontSize="16" fill="white" opacity="0.22">♩</text>
      <text x="290" y="44" fontFamily="Georgia,serif" fontSize="14" fill="#c8a030" opacity="0.4">♪</text>
      <text x="332" y="50" fontFamily="Georgia,serif" fontSize="18" fill="white" opacity="0.2">♫</text>
      <text x="120" y="100" fontFamily="Georgia,serif" fontSize="10" fill="white" opacity="0.3" letterSpacing="1">Подмосковные вечера</text>
      <text x="340" y="100" fontFamily="Georgia,serif" fontSize="10" fill="white" opacity="0.18" letterSpacing="1">В лесу родилась ёлочка</text>
      <rect x="60" y="114" width="110" height="22" rx="11" fill="#c8a030" opacity="0.18"/>
      <text x="115" y="129" textAnchor="middle" fontFamily="Georgia,serif" fontSize="10" fill="#c8a030" opacity="0.8">24 songs</text>
    </svg>
  );
}

function ListenScene() {
  return (
    <svg className={styles.cardScene} viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="280" fill="#1a1e2e"/>
      {/* Background glow */}
      <ellipse cx="190" cy="140" rx="140" ry="110" fill="#2a3a5a" opacity="0.5"/>
      {/* Outer headphone arc */}
      <path d="M88 152 Q88 58 190 58 Q292 58 292 152" stroke="#4a6a9a" strokeWidth="9" fill="none" strokeLinecap="round"/>
      {/* Left ear cup */}
      <rect x="66" y="140" width="38" height="58" rx="19" fill="#3a5a8a"/>
      <rect x="73" y="149" width="24" height="40" rx="12" fill="#2a4a7a"/>
      {/* Right ear cup */}
      <rect x="276" y="140" width="38" height="58" rx="19" fill="#3a5a8a"/>
      <rect x="283" y="149" width="24" height="40" rx="12" fill="#2a4a7a"/>
      {/* Left sound waves */}
      <path d="M50 161 Q42 169 50 177" stroke="#7aaec8" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.75"/>
      <path d="M37 152 Q22 169 37 186" stroke="#7aaec8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.45"/>
      <path d="M24 143 Q4 169 24 195" stroke="#7aaec8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.2"/>
      {/* Right sound waves */}
      <path d="M330 161 Q338 169 330 177" stroke="#7aaec8" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.75"/>
      <path d="M343 152 Q358 169 343 186" stroke="#7aaec8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.45"/>
      <path d="M356 143 Q376 169 356 195" stroke="#7aaec8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.2"/>
      {/* Waveform bars */}
      <rect x="138" y="212" width="8" height="16" rx="4" fill="#7aaec8" opacity="0.55"/>
      <rect x="150" y="205" width="8" height="30" rx="4" fill="#7aaec8" opacity="0.65"/>
      <rect x="162" y="197" width="8" height="46" rx="4" fill="#7aaec8" opacity="0.75"/>
      <rect x="174" y="205" width="8" height="30" rx="4" fill="#7aaec8" opacity="0.65"/>
      <rect x="186" y="199" width="8" height="42" rx="4" fill="#c8e0ee" opacity="0.9"/>
      <rect x="198" y="206" width="8" height="28" rx="4" fill="#7aaec8" opacity="0.7"/>
      <rect x="210" y="200" width="8" height="40" rx="4" fill="#7aaec8" opacity="0.75"/>
      <rect x="222" y="207" width="8" height="26" rx="4" fill="#7aaec8" opacity="0.6"/>
      <rect x="234" y="213" width="8" height="14" rx="4" fill="#7aaec8" opacity="0.5"/>
      {/* Label */}
      <text x="190" y="262" textAnchor="middle" fontFamily="Georgia,serif" fontSize="10" fill="white" opacity="0.28" letterSpacing="2">слушать</text>
    </svg>
  );
}

// ── Card data ───────────────────────────────────────────────────────────────

const CARDS = [
  {
    path:      "/library",
    areaClass: "cardLib",
    en:        "Reading",
    ru:        "Библиотека",
    hint:      "AI-generated stories with vocab hints",
    overlay:   "linear-gradient(160deg, rgba(0,0,0,0) 30%, rgba(10,28,18,0.72) 100%)",
    Scene:     LibScene,
  },
  {
    path:      "/grammar",
    areaClass: "cardGram",
    en:        "Grammar",
    ru:        "Грамматика",
    hint:      "Verb patterns & tenses",
    overlay:   "linear-gradient(160deg, rgba(0,0,0,0) 20%, rgba(20,10,4,0.78) 100%)",
    Scene:     LessScene,
  },
  {
    path:      "/lessons",
    areaClass: "cardLess",
    en:        "Lessons",
    ru:        "Уроки",
    hint:      "62 structured lessons",
    overlay:   "linear-gradient(160deg, rgba(0,0,0,0) 20%, rgba(10,20,28,0.75) 100%)",
    Scene:     GramScene,
  },
  {
    path:      "/vocabulary",
    areaClass: "cardVocab",
    en:        "Vocabulary",
    ru:        "Словарь",
    hint:      null,
    overlay:   "linear-gradient(160deg, rgba(0,0,0,0) 0%, rgba(14,8,28,0.65) 100%)",
    Scene:     VocabScene,
  },
  {
    path:      "/tabu",
    areaClass: "cardTabu",
    en:        "Word game",
    ru:        "Табу",
    hint:      "Describe without saying the word",
    overlay:   "linear-gradient(150deg, rgba(0,0,0,0) 20%, rgba(16,6,24,0.78) 100%)",
    Scene:     TabuScene,
  },
  {
    path:      "/muzyka",
    areaClass: "cardMuz",
    en:        "Song library",
    ru:        "Музыка",
    hint:      "Learn Russian through music & lyrics",
    overlay:   "linear-gradient(100deg, rgba(0,0,0,0) 30%, rgba(10,6,24,0.7) 100%)",
    Scene:     MuzScene,
  },
  {
    path:      "/listening",
    areaClass: "cardListen",
    en:        "Listening",
    ru:        "Слушание",
    hint:      "Train your ear with AI audio exercises",
    overlay:   "linear-gradient(160deg, rgba(0,0,0,0) 20%, rgba(6,10,28,0.8) 100%)",
    Scene:     ListenScene,
  },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoading, heroLine, primary, secondary, stats } = useHomeRecommendations();

  const displayName =
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : null);

  const eyebrow = `${getDayLabel()}${displayName ? ` · Welcome back` : ""}`;

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}>
            {eyebrow}
            {stats.streak > 0 && (
              <span className={styles.streakPill}>🔥 {stats.streak}</span>
            )}
          </p>
          <h1 className={styles.heroTitle}>
            What are you<br />
            <em>learning today?</em>
          </h1>
          {!isLoading && heroLine && (
            <p className={styles.heroSub}>{heroLine}</p>
          )}
          {isLoading && (
            <div className={`${styles.heroSubSkeleton} ${styles.skeleton}`} />
          )}
        </div>

        <div className={styles.focusStrip}>
          {isLoading ? (
            <>
              <div className={`${styles.focusPrimary} ${styles.skeleton}`} />
              <div className={styles.focusSecondaryGroup}>
                <div className={`${styles.focusSecondary} ${styles.skeleton}`} />
                <div className={`${styles.focusSecondary} ${styles.skeleton}`} />
              </div>
            </>
          ) : (
            <>
              {primary && (
                <button
                  className={styles.focusPrimary}
                  onClick={() => navigate(primary.path)}
                >
                  <span className={styles.focusIcon}>{primary.icon}</span>
                  <div className={styles.focusText}>
                    <span className={styles.focusLabel}>{primary.label}</span>
                    <span className={styles.focusSubtext}>{primary.subtext}</span>
                  </div>
                  <span className={styles.focusArrow}>→</span>
                </button>
              )}
              <div className={styles.focusSecondaryGroup}>
                {secondary.map((item, i) => (
                  <button
                    key={item.type + i}
                    className={styles.focusSecondary}
                    onClick={() => navigate(item.path)}
                  >
                    <span className={styles.focusSecondaryIcon}>{item.icon}</span>
                    <div className={styles.focusSecondaryText}>
                      <span className={styles.focusSecondaryLabel}>{item.label}</span>
                      <span className={styles.focusSecondarySubtext}>{item.subtext}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Card grid ── */}
      <div className={styles.grid}>
        {CARDS.map(({ path, areaClass, en, ru, hint, overlay, Scene }) => (
          <button
            key={path}
            className={`${styles.card} ${styles[areaClass]}`}
            onClick={() => navigate(path)}
          >
            <Scene />
            <div
              className={styles.cardOverlay}
              style={{ background: overlay }}
            />
            <div className={styles.cardArrow}>→</div>
            <div className={styles.cardBody}>
              <span className={styles.cardEn}>{en}</span>
              <span className={styles.cardRu}>{ru}</span>
              {hint && <span className={styles.cardHint}>{hint}</span>}
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}