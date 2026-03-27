import { useAuth } from "./AuthContext";

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", color: "#3a3020" }}>По-русски</h1>
        <button
          onClick={logout}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #d0c8b8",
            background: "transparent",
            cursor: "pointer",
            color: "#6a5e48",
          }}
        >
          Sign Out
        </button>
      </div>

      <div style={{
        background: "#fffdf7",
        borderRadius: "12px",
        padding: "1.5rem",
        boxShadow: "0 2px 12px rgba(58,48,32,0.06)",
      }}>
        <p style={{ color: "#6a5e48" }}>Signed in as: <strong>{user?.email}</strong></p>
        <p style={{ marginTop: "1rem", color: "#3a3020" }}>
          ✅ Auth is working. Your app will live here in Phase 3.
        </p>
      </div>
    </div>
  );
}