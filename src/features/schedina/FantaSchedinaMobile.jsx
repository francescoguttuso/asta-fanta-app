import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { CALENDARIO_CAMPIONATO } from "@/data/calendarioData";
import {
  calculateSchedinaPoints,
  getRoundPicks,
  getRoundResults,
  hasSubmittedRound,
  submitFantaSchedina,
} from "@/features/schedina/fantaSchedinaStore";

const SIGNS = ["1", "X", "2"];

const getParticipantName = (participant) =>
  participant?.nome || participant?.name || `Squadra ${participant?.id ?? ""}`;

export default function FantaSchedinaMobile({
  docRef,
  teamId,
  teamName,
  onBack,
}) {
  const [session, setSession] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [picks, setPicks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!docRef) return undefined;
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) setSession(snap.data());
    });
  }, [docRef]);

  const round = CALENDARIO_CAMPIONATO[selectedRound - 1];
  const roundState = session?.fantaSchedina?.rounds?.[selectedRound] || {};
  const isOpen = roundState.open === true;
  const submitted = hasSubmittedRound(session, selectedRound, teamId);

  useEffect(() => {
    setPicks(getRoundPicks(session, selectedRound, teamId));
    setMessage("");
  }, [session, selectedRound, teamId]);

  const completed = useMemo(
    () => round?.matches?.filter((_, i) => picks[i]).length || 0,
    [round, picks],
  );

  const points = calculateSchedinaPoints(
    picks,
    getRoundResults(session, selectedRound),
  );

  // Solo le schedine realmente confermate sono pubbliche.
  // Questo usa submittedAt, quindi una schedina semplicemente compilata
  // ma non ancora inviata non compare agli altri.
  const playedCards = useMemo(() => {
    const participants = Array.isArray(session?.partecipanti)
      ? session.partecipanti
      : [];
    const submittedAt = roundState.submittedAt || {};
    const allPicks = roundState.picks || {};

    return participants
      .filter((participant) => {
        const id = String(participant.id);
        return Boolean(submittedAt[id] || submittedAt[participant.id]);
      })
      .map((participant) => {
        const id = String(participant.id);
        const rawPicks = allPicks[id] ?? allPicks[participant.id] ?? [];
        const participantPicks = Array.isArray(rawPicks) ? rawPicks : [];

        return {
          id: participant.id,
          nome: getParticipantName(participant),
          picks: participantPicks,
          points: calculateSchedinaPoints(
            participantPicks,
            getRoundResults(session, selectedRound),
          ),
        };
      });
  }, [session, roundState, selectedRound]);

  const choose = (matchIndex, sign) => {
    if (!isOpen || submitted) return;
    setPicks((current) => {
      const next = [...current];
      next[matchIndex] = sign;
      return next;
    });
  };

  const confirm = async () => {
    if (submitted) {
      setMessage("🔒 Schedina già confermata. Non è più modificabile.");
      return;
    }

    if (!isOpen) {
      setMessage("🔒 Giornata chiusa. Le scommesse non sono più disponibili.");
      return;
    }

    if (!teamId || completed !== round.matches.length) {
      setMessage("Completa tutti i 5 pronostici prima di confermare.");
      return;
    }

    try {
      setSaving(true);
      await submitFantaSchedina(docRef, selectedRound, teamId, picks);
      setMessage("🔒 Schedina confermata.");
    } catch (error) {
      console.error(error);
      setMessage("❌ Errore nel salvataggio della schedina.");
    } finally {
      setSaving(false);
    }
  };

  if (!round) return null;

  return (
    <div
      className="container mobile-container"
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "10px 12px 25px",
      }}
    >
      <div className="card" style={{ padding: "14px", marginBottom: "10px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            border: 0,
            background: "transparent",
            color: "#94a3b8",
            padding: 0,
            cursor: "pointer",
            marginBottom: "8px",
          }}
        >
          ← Torna all'asta
        </button>

        <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
          FANTA SCHEDINA
        </div>
        <h2 style={{ color: "#38bdf8", margin: "4px 0" }}>
          🎟️ {teamName}
        </h2>

        <select
          value={selectedRound}
          onChange={(event) => setSelectedRound(Number(event.target.value))}
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          {CALENDARIO_CAMPIONATO.map((item, index) => (
            <option key={item.label} value={index + 1}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: "12px", marginBottom: "10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
            gap: "8px",
          }}
        >
          <strong style={{ color: "#fff" }}>{round.label}</strong>
          <span
            style={{
              color: submitted ? "#38bdf8" : isOpen ? "#10b981" : "#f59e0b",
              fontSize: "0.8rem",
              fontWeight: 800,
            }}
          >
            {submitted
              ? "🔒 SCHEDINA CONFERMATA"
              : isOpen
                ? "● APERTA"
                : "● CHIUSA"}
          </span>
        </div>

        {round.matches.map((match, index) => (
          <div
            key={`${match.home}-${match.away}`}
            style={{ padding: "12px 0", borderTop: "1px solid #21173d" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: "7px",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <strong style={{ color: "#e5e7eb", textAlign: "right" }}>
                {match.home}
              </strong>
              <span style={{ color: "#64748b" }}>vs</span>
              <strong style={{ color: "#e5e7eb" }}>{match.away}</strong>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {SIGNS.map((sign) => {
                const active = picks[index] === sign;
                return (
                  <button
                    key={sign}
                    type="button"
                    disabled={!isOpen || submitted}
                    onClick={() => choose(index, sign)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: active
                        ? "2px solid #38bdf8"
                        : "1px solid #33214f",
                      background: active ? "#12304a" : "#100822",
                      color: active ? "#38bdf8" : "#cbd5e1",
                      fontWeight: 900,
                      cursor:
                        isOpen && !submitted ? "pointer" : "not-allowed",
                    }}
                  >
                    {sign}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{ padding: "12px", marginBottom: "10px", textAlign: "center" }}
      >
        <strong style={{ color: "#fff" }}>
          {completed} / {round.matches.length} pronostici
        </strong>

        <button
          type="button"
          onClick={confirm}
          disabled={
            !isOpen || submitted || saving || completed !== round.matches.length
          }
          className="btn btn-green"
          style={{ width: "100%", marginTop: "10px", padding: "12px" }}
        >
          {submitted
            ? "🔒 SCHEDINA CONFERMATA"
            : saving
              ? "SALVATAGGIO..."
              : "CONFERMA SCHEDINA"}
        </button>

        {message && (
          <div style={{ marginTop: "10px", color: "#cbd5e1" }}>{message}</div>
        )}

        {getRoundResults(session, selectedRound).length > 0 && (
          <div style={{ marginTop: "12px", color: "#10b981" }}>
            Punti giornata: <strong>{points}</strong>
          </div>
        )}
      </div>

      <section className="card" style={{ padding: "12px", marginBottom: "10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div>
            <div style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
              FANTA SCHEDINA
            </div>
            <h3 style={{ color: "#fff", margin: "3px 0 0" }}>
              🎯 Schedine giocate
            </h3>
          </div>
          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
            {round.label}
          </span>
        </div>

        {playedCards.length === 0 ? (
          <div
            style={{
              padding: "18px 10px",
              textAlign: "center",
              color: "#94a3b8",
              border: "1px dashed #33214f",
              borderRadius: "10px",
            }}
          >
            Nessuna schedina confermata per questa giornata.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {playedCards.map((card) => (
              <div
                key={String(card.id)}
                style={{
                  background: "#100822",
                  border: "1px solid #21173d",
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <strong style={{ color: "#fff" }}>👤 {card.nome}</strong>
                  <span
                    style={{
                      color: "#38bdf8",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                    }}
                  >
                    🔒 CONFERMATA
                  </span>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  {round.matches.map((match, index) => (
                    <div
                      key={`${card.id}-${match.home}-${match.away}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr 32px",
                        gap: "6px",
                        alignItems: "center",
                        padding: "7px 0",
                        borderTop: index ? "1px solid #21173d" : "0",
                      }}
                    >
                      <span
                        style={{
                          color: "#cbd5e1",
                          textAlign: "right",
                          fontSize: "0.78rem",
                        }}
                      >
                        {match.home}
                      </span>
                      <span style={{ color: "#475569", fontSize: "0.72rem" }}>
                        -
                      </span>
                      <span style={{ color: "#cbd5e1", fontSize: "0.78rem" }}>
                        {match.away}
                      </span>
                      <strong
                        style={{
                          color: "#38bdf8",
                          textAlign: "center",
                          background: "#12304a",
                          borderRadius: "6px",
                          padding: "5px 0",
                        }}
                      >
                        {card.picks[index] || "-"}
                      </strong>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    paddingTop: "9px",
                    borderTop: "1px solid #21173d",
                    textAlign: "right",
                    color: "#94a3b8",
                    fontSize: "0.78rem",
                  }}
                >
                  Punti: <strong style={{ color: "#fff" }}>{card.points}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
