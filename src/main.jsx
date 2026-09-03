import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "./firebaseConfig";
import "./index.css";
import App from "./App.jsx";

const root = createRoot(document.getElementById("root"));

function renderLoading() {
  root.render(
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      Connessione in corso...
    </div>,
  );
}

function renderError(error) {
  console.error("Firebase Anonymous Authentication error:", error);

  root.render(
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4 text-center">
      <h2>Impossibile collegarsi</h2>
      <p>Ricarica la pagina e riprova.</p>
    </div>,
  );
}

renderLoading();

const unsubscribe = onAuthStateChanged(auth, (user) => {
  if (user) {
    unsubscribe();

    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
});

if (!auth.currentUser) {
  signInAnonymously(auth).catch(renderError);
}
