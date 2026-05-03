// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import GlobalHeader from "./components/GlobalHeader/GlobalHeader";
import { WordBankProvider } from "./context/WordBankContext";
import { TooltipProvider } from "./context/TooltipContext";
import SelectionPill from "./components/TranslationTooltip/SelectionPill";
import TranslationTooltip from "./components/TranslationTooltip/TranslationTooltip";
import WordBankOverlay from "./components/WordBank/WordBankOverlay";
import WordBankToast from "./components/WordBankToast/WordBankToast";
import Login from "./Login";
import Home from "./modules/Home/Home";
import LibraryShelf from "./modules/Library/LibraryShelf";
import BookReader from "./modules/Library/BookReader";
import styles from "./app.module.css";
import { useProgress } from "./context/ProgressContext";
import { SettingsProvider }  from "./context/SettingsContext";
import { ProgressProvider }  from "./context/ProgressContext";

// Module imports — uncomment as each phase is built
import Lessons from "./modules/Lessons";
import Grammar from "./modules/Grammar";
// import Conjugations from "./modules/Conjugations/Conjugations";
import Vocabulary   from "./modules/Vocabulary";
import Tabu         from "./modules/Tabu";
import Muzyka       from "./modules/Muzyka";
import Listening    from "./modules/Listening";
// import Drill        from "./modules/Drill/Drill";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <div className={styles.headerWrap}>
        <GlobalHeader />
      </div>
      <SelectionPill />
      <TranslationTooltip />
      <WordBankOverlay />
      <WordBankToast />
    </>
  );
}

// Night mode is now handled entirely via data-night on <html> in SettingsContext.
// AppContent no longer needs to read nightMode at all.
function ReportReadyBanner() {
  const { reportReady, dismissBanner } = useProgress();
  if (!reportReady) return null;
  return (
    <div style={{
      background: "#7a9e7e",
      color: "#ffffff",
      fontSize: 13,
      fontWeight: 500,
      padding: "9px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      fontFamily: "system-ui, sans-serif",
    }}>
      <span>📊 Your report card is ready — tap Progress to view it.</span>
      <button
        onClick={dismissBanner}
        style={{
          background: "rgba(255,255,255,0.25)",
          border: "none",
          borderRadius: 99,
          color: "#ffffff",
          fontSize: 12,
          padding: "3px 10px",
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
          flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

function AppContent() {
  return (
    <div className={styles.appRoot}>
      <ReportReadyBanner />
      <AppShell />
      <main className={styles.main}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/" element={
            <ProtectedRoute><Home /></ProtectedRoute>
          } />
          <Route path="/library" element={
            <ProtectedRoute><LibraryShelf /></ProtectedRoute>
          } />
          <Route path="/library/:bookId" element={
            <ProtectedRoute><BookReader /></ProtectedRoute>
          } />
          {/* Uncomment as each phase is built:
          <Route path="/grammar"      element={<ProtectedRoute><Grammar /></ProtectedRoute>} />
          <Route path="/conjugations" element={<ProtectedRoute><Conjugations /></ProtectedRoute>} /> */}
          <Route path="/vocabulary"          element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/vocabulary/session"  element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/vocabulary/explore"  element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/vocabulary/flashcards"  element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/vocabulary/dictionary"  element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/vocabulary/freeplay"    element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/lessons"                    element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
          <Route path="/lessons/roadmap/:roadmapId" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
          <Route path="/lessons/play/:lessonId"     element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
          <Route path="/lessons/assignments"        element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
          <Route path="/lessons/import"             element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
          <Route path="/grammar"                    element={<ProtectedRoute><Grammar /></ProtectedRoute>} />
          <Route path="/grammar/freeplay"           element={<ProtectedRoute><Grammar /></ProtectedRoute>} />
          <Route path="/tabu"                        element={<ProtectedRoute><Tabu /></ProtectedRoute>} />
          <Route path="/muzyka"                      element={<ProtectedRoute><Muzyka /></ProtectedRoute>} />
          <Route path="/muzyka/song/:songId"         element={<ProtectedRoute><Muzyka /></ProtectedRoute>} />
          <Route path="/listening"                   element={<ProtectedRoute><Listening /></ProtectedRoute>} />
          {/* <Route path="/drill" element={<ProtectedRoute><Drill /></ProtectedRoute>} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SettingsProvider>
          <ProgressProvider>
            <TooltipProvider>
              <WordBankProvider>
                <AppContent />
              </WordBankProvider>
            </TooltipProvider>
          </ProgressProvider>
        </SettingsProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}