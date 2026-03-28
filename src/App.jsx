import { AuthProvider, useAuth } from "./AuthContext";
import Login         from "./Login";
import Home          from "./Home";
import DataMigration from "./DataMigration";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6a5e48" }}>Loading…</p>
      </div>
    );
  }

  if (!user) return <Login />;

  // Temporary: visit /migrate in your browser to run the one-time data migration.
  // Remove this line in Phase 3 once migration is done.
  if (window.location.pathname === "/migrate") return <DataMigration />;

  return <Home />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}