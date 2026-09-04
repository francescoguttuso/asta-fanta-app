import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { auth } from "./firebaseConfig";
import "./index.css";
import App from "./App.jsx";
import ServerLogin from "./ServerLogin.jsx";

const root = createRoot(document.getElementById("root"));
const isMobileView =
  new URLSearchParams(window.location.search).get("mobile") === "true";

function renderLoading(message = "Connessione in corso...") {
  root.render(
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      {message}
    </div>,
  );
}

function renderError(error) {
  console.error("Firebase Authentication error:", error);

  root.render(
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4 text-center">
      <h2>Impossibile collegarsi</h2>
      <p>Ricarica la pagina e riprova.</p>
    </div>,
  );
}

function renderServerLogin() {
  root.render(<ServerLogin />);
}

renderLoading(isMobileView ? "Connessione in corso..." : "Verifica accesso Server...");

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  if (isMobileView) {
    if (user) {
      unsubscribe();
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    }
    return;
  }

  if (user && !user.isAnonymous) {
    // Non disiscriviamo il listener nel Server: deve intercettare il logout.
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    return;
  }

  if (user?.isAnonymous) {
    try {
      // Manteniamo attivo onAuthStateChanged: dopo il signOut
      // verrà richiamato di nuovo con user === null e mostrerà il login.
      await signOut(auth);
      return;
    } catch (error) {
      renderError(error);
      return;
    }
  }

  renderServerLogin();
});

if (isMobileView && !auth.currentUser) {
  signInAnonymously(auth).catch(renderError);
}
