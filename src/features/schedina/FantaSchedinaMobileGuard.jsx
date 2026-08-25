import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { canSubmitFromMobile, hasSubmittedRound } from "./fantaSchedinaStore";

/*
 * Wrapper/guard per la FantaSchedina mobile.
 * Usare questa logica nel componente mobile già esistente:
 *
 *   const allowed = canSubmitFromMobile(session, roundIndex, mioId);
 *
 * Se allowed === false:
 *   - giornata chiusa -> mostra "Scommesse chiuse";
 *   - schedina già consegnata -> mostra "Schedina già consegnata".
 *
 * La modifica da server rimane sempre possibile.
 */
export default function FantaSchedinaMobileGuard({
  docRef,
  roundIndex,
  teamId,
  children,
}) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!docRef) return undefined;

    return onSnapshot(docRef, (snapshot) => {
      setSession(snapshot.exists() ? snapshot.data() : null);
    });
  }, [docRef]);

  if (!session) return null;

  const round = session?.rounds?.[roundIndex] || {};
  const alreadySubmitted = hasSubmittedRound(session, roundIndex, teamId);
  const allowed = canSubmitFromMobile(session, roundIndex, teamId);

  if (alreadySubmitted) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🔒</div>
        <strong>Schedina già consegnata</strong>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>
          Per modificare o cancellare la schedina rivolgersi al server.
        </div>
      </div>
    );
  }

  if (!round.open || !allowed) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🔒</div>
        <strong>Giornata chiusa</strong>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>
          Le scommesse per questa giornata non sono al momento disponibili.
        </div>
      </div>
    );
  }

  return children;
}
