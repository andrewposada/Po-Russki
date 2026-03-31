// src/hooks/useReadingTimer.js
import { useState, useRef, useEffect, useCallback } from "react";
import { TIMER_AUTOPAUSE_MS } from "../constants";

export function useReadingTimer({ onFlush }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  const secondsRef         = useRef(0);
  const runningRef         = useRef(false);
  const lastInteractionRef = useRef(Date.now());
  const intervalRef        = useRef(null);
  const autoPauseRef       = useRef(null);
  const onFlushRef         = useRef(onFlush);

  useEffect(() => { onFlushRef.current = onFlush; }, [onFlush]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const pause = useCallback(() => {
    if (!runningRef.current) return;
    setRunning(false);
    runningRef.current = false;
    clearInterval(intervalRef.current);
    clearInterval(autoPauseRef.current);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    setRunning(true);
    runningRef.current = true;
    lastInteractionRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      setSeconds(s => { secondsRef.current = s + 1; return s + 1; });
    }, 1000);

    autoPauseRef.current = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > TIMER_AUTOPAUSE_MS) {
        pause();
      }
    }, 10_000);
  }, [pause]);

  const toggle = useCallback(() => {
    if (runningRef.current) pause();
    else start();
  }, [start, pause]);

  const recordInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (!runningRef.current) start();
  }, [start]);

  const flush = useCallback(async () => {
    pause();
    const elapsed = secondsRef.current;
    setSeconds(0);
    secondsRef.current = 0;
    if (elapsed > 0 && onFlushRef.current) {
      await onFlushRef.current(elapsed);
    }
  }, [pause]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(autoPauseRef.current);
      const elapsed = secondsRef.current;
      if (elapsed > 0 && onFlushRef.current) onFlushRef.current(elapsed);
    };
  }, []);

  return { seconds, running, toggle, recordInteraction, flush };
}