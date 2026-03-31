// src/hooks/useReadingTimer.js
import { useState, useRef, useEffect, useCallback } from "react";
import { TIMER_AUTOPAUSE_MS } from "../constants";

export function useReadingTimer({ onSave }) {
  const [seconds, setSeconds]   = useState(0);
  const [running, setRunning]   = useState(false);

  const secondsRef         = useRef(0);
  const runningRef         = useRef(false);
  const lastInteractionRef = useRef(Date.now());
  const intervalRef        = useRef(null);
  const autoPauseRef       = useRef(null);
  const periodicRef        = useRef(null);
  const onSaveRef          = useRef(onSave);

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // ── Internal save — appends current seconds to DB, does NOT reset counter ──
  const save = useCallback(async () => {
    const elapsed = secondsRef.current;
    if (elapsed > 0 && onSaveRef.current) {
      await onSaveRef.current(elapsed).catch(err =>
        console.warn("Timer save error:", err.message)
      );
    }
  }, []);

  const stopIntervals = useCallback(() => {
    clearInterval(intervalRef.current);
    clearInterval(autoPauseRef.current);
    clearInterval(periodicRef.current);
  }, []);

  const pause = useCallback(async () => {
    if (!runningRef.current) return;
    stopIntervals();
    setRunning(false);
    runningRef.current = false;
    await save();
  }, [save, stopIntervals]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    setRunning(true);
    runningRef.current = true;
    lastInteractionRef.current = Date.now();

    // Tick every second
    intervalRef.current = setInterval(() => {
      setSeconds(s => { secondsRef.current = s + 1; return s + 1; });
    }, 1000);

    // Auto-pause check every 10s
    autoPauseRef.current = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > TIMER_AUTOPAUSE_MS) {
        pause();
      }
    }, 10_000);

    // Periodic save every 30s (does NOT reset counter)
    periodicRef.current = setInterval(() => {
      save();
    }, 30_000);
  }, [pause, save]);

  const toggle = useCallback(() => {
    if (runningRef.current) pause();
    else start();
  }, [start, pause]);

  // Only resets the auto-pause countdown — never starts the timer
  const nudgeInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  // Called on chapter change — saves and resets counter to 0
  const flushAndReset = useCallback(async () => {
    stopIntervals();
    const elapsed = secondsRef.current;
    setRunning(false);
    runningRef.current = false;
    setSeconds(0);
    secondsRef.current = 0;
    if (elapsed > 0 && onSaveRef.current) {
      await onSaveRef.current(elapsed).catch(err =>
        console.warn("Timer flush error:", err.message)
      );
    }
  }, [stopIntervals]);

  // Unmount: best-effort save (sync-friendly, no await)
  useEffect(() => {
    return () => {
      stopIntervals();
      const elapsed = secondsRef.current;
      if (elapsed > 0 && onSaveRef.current) onSaveRef.current(elapsed);
    };
  }, [stopIntervals]);

  return { seconds, running, toggle, nudgeInteraction, flushAndReset };
}