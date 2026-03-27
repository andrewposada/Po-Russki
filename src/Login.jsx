import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error,    setError]    = useState("");

  const handleEmailAuth = async () => {
    setError("");
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>По-русски</h1>
        <p style={styles.subtitle}>Russian Language Learning</p>

        <div style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.btnPrimary} onClick={handleEmailAuth}>
            {isSignUp ? "Create Account" : "Sign In"}
          </button>

          <p style={styles.switchText}>
            {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
            <span
              style={styles.link}
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            >
              {isSignUp ? "Sign in" : "Create one"}
            </span>
          </p>

          <div style={styles.divider}>
            <span style={styles.dividerText}>or</span>
          </div>

          <button style={styles.btnGoogle} onClick={handleGoogle}>
            <span style={{ marginRight: "8px" }}>G</span>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f0e8",
  },
  card: {
    background: "#fffdf7",
    borderRadius: "16px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "380px",
    boxShadow: "0 4px 24px rgba(58,48,32,0.08)",
  },
  title: {
    fontSize: "2rem",
    fontWeight: "700",
    color: "#3a3020",
    textAlign: "center",
    marginBottom: "4px",
  },
  subtitle: {
    color: "#6a5e48",
    textAlign: "center",
    marginBottom: "2rem",
    fontSize: "0.9rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    padding: "12px 14px",
    borderRadius: "8px",
    border: "1px solid #d0c8b8",
    fontSize: "1rem",
    background: "#faf8f4",
    color: "#3a3020",
    outline: "none",
  },
  btnPrimary: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    background: "#7a9e7e",
    color: "white",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "4px",
  },
  btnGoogle: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #d0c8b8",
    background: "white",
    color: "#3a3020",
    fontSize: "1rem",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: "#c0392b",
    fontSize: "0.85rem",
    textAlign: "center",
  },
  switchText: {
    textAlign: "center",
    fontSize: "0.85rem",
    color: "#6a5e48",
  },
  link: {
    color: "#7a9e7e",
    cursor: "pointer",
    fontWeight: "600",
    textDecoration: "underline",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: "#a09080",
  },
  dividerText: {
    fontSize: "0.8rem",
    color: "#a09080",
    flexShrink: 0,
  },
};