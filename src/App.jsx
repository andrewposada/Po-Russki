// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import GlobalHeader from "./components/GlobalHeader/GlobalHeader";
import { WordBankProvider } from "./context/WordBankContext";
import { TooltipProvider } from "./context/TooltipContext";
import SelectionPill from "./components/TranslationTooltip/SelectionPill";
import TranslationTooltip from "./components/TranslationTooltip/TranslationTooltip";
import WordBankOverlay from "./components/WordBank/WordBankOverlay";
import Login from "./Login";
import Home from "./modules/Home/Home";
import styles from "./app.module.css";
import { SettingsProvider } from "./context/SettingsContext";

// Module imports — add as each phase is built
// import Library     from "./modules/Library/Library";
// import Grammar     from "./modules/Grammar/Grammar";
// import Conjugations from "./modules/Conjugations/Conjugations";
// import Vocabulary  from "./modules/Vocabulary/Vocabulary";
// import Drill       from "./modules/Drill/Drill";

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
      <GlobalHeader />
      <SelectionPill />
      <TranslationTooltip />
      <WordBankOverlay />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SettingsProvider>
          <TooltipProvider>
            <WordBankProvider>
              <div className={styles.appRoot}>
                <AppShell />
                <main className={styles.main}>
                  <Routes>
                    <Route path="/login" element={<LoginRoute />} />
                    <Route path="/" element={
                      <ProtectedRoute><Home /></ProtectedRoute>
                    } />
                    {/* Uncomment as each phase is built: */}
                    {/* <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                    <Route path="/library/:bookId" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                    <Route path="/grammar" element={<ProtectedRoute><Grammar /></ProtectedRoute>} />
                    <Route path="/conjugations" element={<ProtectedRoute><Conjugations /></ProtectedRoute>} />
                    <Route path="/vocabulary" element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
                    <Route path="/drill" element={<ProtectedRoute><Drill /></ProtectedRoute>} /> */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </WordBankProvider>
          </TooltipProvider>
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
