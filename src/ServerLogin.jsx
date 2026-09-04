import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";

const INTERNAL_EMAIL_DOMAIN = "@fantariggio.local";

export default function ServerLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !password) {
      setError("Inserisci username e password.");
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        `${cleanUsername}${INTERNAL_EMAIL_DOMAIN}`,
        password,
      );
    } catch (authError) {
      console.error("Firebase Server Authentication error:", authError);
      setError("Username o password non corretti.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="server-login-page">
      <section className="server-login-card">
        <img
          className="server-login-logo"
          src="/images/fantariggio-logo.png"
          alt="FantaRiggio"
        />

        <div className="server-login-badge">SERVER</div>
        <h1>Accesso Server</h1>
        <p className="server-login-subtitle">
          Inserisci le credenziali del banditore.
        </p>

        <form onSubmit={handleSubmit} className="server-login-form">
          <label htmlFor="server-username">Username</label>
          <input
            id="server-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={loading}
            autoFocus
          />

          <label htmlFor="server-password">Password</label>
          <input
            id="server-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />

          {error && <p className="server-login-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "ACCESSO IN CORSO..." : "ACCEDI"}
          </button>
        </form>
      </section>
    </main>
  );
}
