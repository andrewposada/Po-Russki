// src/context/ProgressContext.jsx
// Holds progress report state globally so the banner can be shown in GlobalHeader.

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { getProgressReports, saveProgressReport, getRecentAttempts } from "../storage";
import { buildProgressSnapshot } from "../utils/progressAggregator";
import { getCefrLevel, saveCefrLevel } from "../storage";

const ProgressContext = createContext(null);

const REPORT_COOLDOWN_HOURS  = 24;
const MIN_NEW_ATTEMPTS       = 75;
const MIN_DISTINCT_TOPICS    = 3;
const PROGRESS_REPORT_VERSION = "1.0";

export function ProgressProvider({ children }) {
  const { user } = useAuth();

 const [latestReport,    setLatestReport]    = useState(null);
  const [reportReady,     setReportReady]      = useState(false);
  const [checkComplete,   setCheckComplete]   = useState(false);
  const [newAttemptCount, setNewAttemptCount] = useState(0);
  const [cefrLevel,       setCefrLevel]       = useState("A1");
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    runDailyCheck(user.uid);
  }, [user?.uid]);

  async function runDailyCheck(userId) {
    try {
      // 1. Get last report
      const reports = await getProgressReports(userId, 1);
      const lastReport     = reports[0] ?? null;
      const lastReportDate = lastReport?.generated_at ?? null;

      // 2. Check cooldown
      if (lastReportDate) {
        const hoursSince = (Date.now() - new Date(lastReportDate)) / (1000 * 60 * 60);
        if (hoursSince < REPORT_COOLDOWN_HOURS) {
          // Surface existing report if available
          if (lastReport?.report) {
            setLatestReport({ ...lastReport.report, generated_at: lastReport.generated_at });
            setReportReady(true);
          }
          setCheckComplete(true);
          console.log(`Progress check: cooldown active (${Math.round(hoursSince)}h since last report)`);
          return;
        }
      }

      // 3. Count new attempts since last report
      const since = lastReportDate ?? new Date(0).toISOString();
      const newAttempts = await getRecentAttempts(userId, 60);
      const attemptsSinceLast = newAttempts.filter(a => a.attempted_at >= since);

      setNewAttemptCount(attemptsSinceLast.length);

      if (attemptsSinceLast.length < MIN_NEW_ATTEMPTS) {
        console.log(`Progress check: insufficient data (${attemptsSinceLast.length} new attempts, need ${MIN_NEW_ATTEMPTS})`);
        setCheckComplete(true);
        return;
      }

      const distinctTopics = new Set(attemptsSinceLast.map(a => a.topic_id).filter(Boolean));
      if (distinctTopics.size < MIN_DISTINCT_TOPICS) {
        console.log(`Progress check: insufficient topic variety (${distinctTopics.size} topics, need ${MIN_DISTINCT_TOPICS})`);
        setCheckComplete(true);
        return;
      }

      // 4. Build snapshot
      // Load current CEFR level before building snapshot
      const { cefr_level: currentCefrLevel } = await getCefrLevel(user.uid);
      setCefrLevel(currentCefrLevel);

      const snapshot = await buildProgressSnapshot(user.uid, lastReportDate, currentCefrLevel);      if (snapshot.insufficientData) {
        console.log("Progress check: aggregator returned insufficient data");
        setCheckComplete(true);
        return;
      }

      // 5. Call API
      console.log("Progress check: generating report…");
      const res = await fetch("/api/progress-report", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ snapshot }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const { report } = await res.json();

      // 6. Save to Supabase
      await saveProgressReport(userId, {
          snapshot,
          report,
          reportVersion: PROGRESS_REPORT_VERSION,
        });

        // Advance CEFR level if aggregator determined eligibility
        if (snapshot.cefr_advance_to) {
          await saveCefrLevel(user.uid, snapshot.cefr_advance_to);
          setCefrLevel(snapshot.cefr_advance_to);
        }

        setLatestReport({ ...report, generated_at: snapshot.generated_at });
        setReportReady(true);
        console.log("Progress check: report generated successfully");
    } catch (err) {
      console.warn("Progress check failed:", err.message);
    } finally {
      setCheckComplete(true);
    }
  }

  function dismissBanner() {
    setReportReady(false);
  }

  return (
    <ProgressContext.Provider value={{ latestReport, reportReady, dismissBanner, checkComplete, newAttemptCount, cefrLevel }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  return useContext(ProgressContext);
}