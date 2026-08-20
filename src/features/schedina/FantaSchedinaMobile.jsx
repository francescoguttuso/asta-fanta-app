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

export default function FantaSchedinaMobile({
  docRef,
  teamId,
  teamName,
  partecipanti = [],
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

  const playedCards = useMemo(() => {
    const picksByTeam = roundState.picks || {};
    const submittedByTeam = roundState.submittedAt || {};

    return partecipanti
      .filter((participant) => {
        const id = String(participant.id);
        return Boolean(submittedByTeam[id] || submittedByTeam[participant.id]);
      })
      .map((participant) => {
        const teamPicks =
          picksByTeam[String(participant.id)] ??
          picksByTeam[participant.id] ??
          [];

        return {
          id: participant.id,
          nome: participant.nome || participant.name || `Squadra ${participant.id}`,
          picks: Array.isArray(teamPicks) ? teamPicks : [],
        };
      });
  }, [partecipanti, roundState]);

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
      await submitFantaSchedina(
        docRef,
        selectedRound,
        teamId,
        picks,
      );
      setMessage("🔒 Schedina confermata.");
    } catch (error) {
      console.error(error);
      setMessage("❌ Errore nel salvataggio della schedina.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="container mobile-container"
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "10px 12px 25px",
      }}
    >
      <div
        className="card"
        style={{
          padding: "14px",
          marginBottom: "10px",
        }}
      >
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
          onChange={(event) =>
            setSelectedRound(Number(event.target.value))
          }
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

      <div
        className="card"
        style={{
          padding: "12px",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <strong style={{ color: "#fff" }}>
            {round.label}
          </strong>
          <span style={{ color: submitted ? "#38bdf8" : isOpen ? "#10b981" : "#f59e0b" }}>
            {submitted ? "🔒 SCHEDINA CONFERMATA" : isOpen ? "● APERTA" : "● CHIUSA"}
          </span>
        </div>

        {round.matches.map((match, index) => (
          <div
            key={`${match.home}-${match.away}`}
            style={{
              padding: "12px 0",
              borderTop: "1px solid #21173d",
            }}
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
              <strong style={{ color: "#e5e7eb" }}>
                {match.away}
              </strong>
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
                      cursor: isOpen && !submitted ? "pointer" : "not-allowed",
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
        style={{
          padding: "12px",
          marginBottom: "10px",
          textAlign: "center",
        }}
      >
        <strong style={{ color: "#fff" }}>
          {completed} / {round.matches.length} pronostici
        </strong>

        <button
          type="button"
          onClick={confirm}
          disabled={!isOpen || submitted || saving || completed !== round.matches.length}
          className="btn btn-green"
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "12px",
          }}
        >
          {saving ? "SALVATAGGIO..." : submitted ? "🔒 SCHEDINA CONFERMATA" : "CONFERMA SCHEDINA"}
        </button>

        {message && (
          <div style={{ marginTop: "10px", color: "#cbd5e1" }}>
            {message}
          </div>
        )}

        {getRoundResults(session, selectedRound).length > 0 && (
          <div style={{ marginTop: "12px", color: "#10b981" }}>
            Punti giornata: <strong>{points}</strong>
          </div>
        )}
      </div>

      <div
        className="card"
        style={{
          padding: "12px",
          marginBottom: "10px",
        }}
      >
        <div style={{ color: "#38bdf8", fontWeight: 900, marginBottom: 10 }}>
          🎯 SCHEDINE GIOCATE — {round.label}
        </div>

        {playedCards.length === 0 ? (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: "12px 4px" }}>
            Nessuna schedina confermata per questa giornata.
          </div>
        ) : (
          playedCards.map((card) => (
            <div
              key={card.id}
              style={{
                background: "#100822",
                border: "1px solid #33214f",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <strong style={{ color: "#fff" }}>👤 {card.nome}</strong>
                <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: 800 }}>
                  🔒 CONFERMATA
                </span>
              </div>

              {round.matches.map((match, index) => (
                <div
                  key={`${card.id}-${match.home}-${match.away}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "10px",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: index < round.matches.length - 1 ? "1px solid #241735" : "none",
                  }}
                >
                  <span style={{ color: "#cbd5e1", fontSize: "0.88rem" }}>
                    {match.home} - {match.away}
                  </span>
                  <strong style={{ color: "#38bdf8", fontSize: "1rem" }}>
                    {card.picks[index] || "-"}
                  </strong>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
