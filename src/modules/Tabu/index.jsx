// src/modules/Tabu/index.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { useWordBank } from "../../context/WordBankContext";
import { getSettings } from "../../storage";
import { useEffect } from "react";

import TabuSetup from "./TabuSetup";
import TabuPlay from "./TabuPlay";
import TabuSummary from "./TabuSummary";

// ── Game phases ──────────────────────────────────────────────────────────
// "setup"   → configuration screen
// "play"    → active round
// "summary" → end-of-round summary
// "gameover"→ final scores (handled inside TabuSummary)

export default function Tabu() {
  const { user }   = useAuth();
  const { words }  = useWordBank();
  const navigate   = useNavigate();

  // ── User settings ────────────────────────────────────────────────────
  const [cefrLevel, setCefrLevel] = useState("B1");

  useEffect(() => {
    if (!user) return;
    getSettings(user.uid).then(s => {
      if (s?.cefr_level) setCefrLevel(s.cefr_level);
    });
  }, [user]);

  // ── Game config (set on setup screen) ───────────────────────────────
  const [gameConfig, setGameConfig] = useState(null);
  // gameConfig shape:
  // {
  //   roundMinutes: number,       // 1–5
  //   teamCount: number,          // 2–4
  //   teamNames: string[],        // ["Команда 1", "Команда 2", ...]
  //   filteredWords: WordObj[],   // words matching setup filters
  // }

  // ── Game state (lives for whole game, not per-round) ─────────────────
  const [phase, setPhase]           = useState("setup");
  const [currentTeam, setCurrentTeam] = useState(0);  // index into teamNames
  const [scores, setScores]         = useState([]);    // scores[i] = total correct for team i
  const [playedWordIds, setPlayedWordIds] = useState(new Set()); // no-repeat across game

  // ── Round result (passed from Play → Summary) ─────────────────────
  const [roundResult, setRoundResult] = useState(null);
  // roundResult shape: { correct: number, incorrect: number }

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleSetupComplete(config) {
    setGameConfig(config);
    setScores(new Array(config.teamCount).fill(0));
    setCurrentTeam(0);
    setPlayedWordIds(new Set());
    setPhase("play");
  }

  function handleRoundComplete({ correct, incorrect, newPlayedIds }) {
    // Update cumulative score for current team
    setScores(prev => {
      const next = [...prev];
      next[currentTeam] = (next[currentTeam] ?? 0) + correct;
      return next;
    });
    // Merge played word IDs into the game-wide set
    setPlayedWordIds(prev => new Set([...prev, ...newPlayedIds]));
    setRoundResult({ correct, incorrect });
    setPhase("summary");
  }

  function handleNextTeam() {
    const nextTeam = (currentTeam + 1) % gameConfig.teamCount;
    setCurrentTeam(nextTeam);
    setRoundResult(null);
    setPhase("play");
  }

  function handleEndGame() {
    setPhase("gameover");
  }

  function handlePlayAgain() {
    setGameConfig(null);
    setScores([]);
    setCurrentTeam(0);
    setPlayedWordIds(new Set());
    setRoundResult(null);
    setPhase("setup");
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <TabuSetup
        words={words ?? []}
        onStart={handleSetupComplete}
        onBack={() => navigate("/")}
      />
    );
  }

  if (phase === "play") {
    return (
      <TabuPlay
        config={gameConfig}
        cefrLevel={cefrLevel}
        currentTeam={currentTeam}
        scores={scores}
        playedWordIds={playedWordIds}
        onRoundComplete={handleRoundComplete}
      />
    );
  }

  if (phase === "summary" || phase === "gameover") {
    return (
      <TabuSummary
        config={gameConfig}
        roundResult={roundResult}
        scores={scores}
        currentTeam={currentTeam}
        isGameOver={phase === "gameover"}
        onNextTeam={handleNextTeam}
        onEndGame={handleEndGame}
        onPlayAgain={handlePlayAgain}
        onBack={() => navigate("/")}
      />
    );
  }

  return null;
}