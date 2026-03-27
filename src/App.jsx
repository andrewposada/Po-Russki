import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./Login";
import Home  from "./Home";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6a5e48" }}>Loading…</p>
      </div>
    );
  }

  return user ? <Home /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}