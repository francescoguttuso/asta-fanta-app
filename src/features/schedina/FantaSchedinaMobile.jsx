import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { CALENDARIO_CAMPIONATO } from "@/data/calendarioData";
import { useAuctionSessionContext } from "../auction/context/useAuctionContexts";
import {
  FANTA_SCHEDINA_REF,
  ensureFantaSchedinaDocument,
  calculateSchedinaPoints,
  calculateSchedinaCumulativeRanking,
  getRoundPicks,
  getRoundResults,
  hasSubmittedRound,
  submitFantaSchedina,
  saveFantaSchedinaPicks,
  getExcludedFantaSchedinaTeamIds,
  isFantaSchedinaTeamExcluded,
} from "@/features/schedina/fantaSchedinaStore";

const SIGNS = ["1", "X", "2"];

export default function FantaSchedinaMobile({
  docRef,
  teamId,
  teamName,
  onBack,
}) {
  const { partecipanti = [], docRef: auctionDocRef } = useAuctionSessionContext();
  const [session, setSession] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [picks, setPicks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    let unsubscribe = null;

    const initialize = async () => {
      try {
        const initialData = await ensureFantaSchedinaDocument(auctionDocRef);

        if (!alive) return;

        const initialActive = Number(initialData?.activeRound);
        const initialRounds = initialData?.rounds || {};
        const initialOpenRound = Array.from(
          { length: CALENDARIO_CAMPIONATO.length },
          (_, index) => index + 1,
        ).find((roundNumber) =>
          (initialRounds[roundNumber] ?? initialRounds[String(roundNumber)])?.open === true
        );

        if (
          Number.isInteger(initialActive) &&
          initialActive >= 1 &&
          initialActive <= CALENDARIO_CAMPIONATO.length &&
          (initialRounds[initialActive] ?? initialRounds[String(initialActive)])?.open === true
        ) {
          setSelectedRound(initialActive);
        } else if (initialOpenRound) {
          setSelectedRound(initialOpenRound);
        }

        unsubscribe = onSnapshot(
          FANTA_SCHEDINA_REF,
          (snap) => {
            if (!alive || !snap.exists()) return;

            const data = snap.data();
            setSession(data);

            const active = Number(data?.activeRound);
            const rounds = data?.rounds || {};
            const firstOpenRound = Array.from(
              { length: CALENDARIO_CAMPIONATO.length },
              (_, index) => index + 1,
            ).find((roundNumber) =>
              (rounds[roundNumber] ?? rounds[String(roundNumber)])?.open === true
            );

            if (
              Number.isInteger(active) &&
              active >= 1 &&
              active <= CALENDARIO_CAMPIONATO.length &&
              (rounds[active] ?? rounds[String(active)])?.open === true
            ) {
              setSelectedRound(active);
            } else if (firstOpenRound) {
              setSelectedRound(firstOpenRound);
            }
          },
          (error) => {
            console.error("Errore lettura FantaSchedina:", error);
          },
        );
      } catch (error) {
        console.error("Errore inizializzazione FantaSchedina:", error);
      }
    };

    initialize();

    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRound = Number(session?.activeRound);
  const orderedRounds = useMemo(() => {
    const all = CALENDARIO_CAMPIONATO.map((item, index) => ({
      item,
      value: index + 1,
    }));
    if (!Number.isInteger(activeRound) || activeRound < 1 || activeRound > all.length) return all;
    return [
      all.find((entry) => entry.value === activeRound),
      ...all.filter((entry) => entry.value !== activeRound),
    ].filter(Boolean);
  }, [activeRound]);

  const round = CALENDARIO_CAMPIONATO[selectedRound - 1];
  const roundState = session?.rounds?.[selectedRound] || {};
  const isOpen = roundState.open === true;
  const submitted = hasSubmittedRound(session, selectedRound, teamId);
  const excluded = isFantaSchedinaTeamExcluded(session, teamId);
  const excludedTeamIds = useMemo(
    () => new Set(getExcludedFantaSchedinaTeamIds(session)),
    [session],
  );
  const schedinaParticipants = useMemo(
    () => partecipanti.filter(
      (participant) => !excludedTeamIds.has(String(participant.id)),
    ),
    [partecipanti, excludedTeamIds],
  );

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
    const allPicks = roundState.picks || {};
    const submittedAt = roundState.submittedAt || {};
    const matchCount = round?.matches?.length || 0;

    return schedinaParticipants
      .map((participant) => {
        const id = String(participant.id);
        const rawPicks = allPicks[id] ?? allPicks[participant.id] ?? [];
        const participantPicks = Array.isArray(rawPicks) ? rawPicks : [];
        const explicitlySubmitted = Boolean(
          submittedAt[id] || submittedAt[participant.id],
        );
        const legacySubmitted = participantPicks.length === matchCount && matchCount > 0;

        if (!explicitlySubmitted && !legacySubmitted) return null;

        return {
          id: participant.id,
          nome: participant?.nome || participant?.name || `Squadra ${participant.id}`,
          picks: participantPicks,
          points: calculateSchedinaPoints(
            participantPicks,
            getRoundResults(session, selectedRound),
          ),
        };
      })
      .filter(Boolean);
  }, [schedinaParticipants, roundState, round, session, selectedRound]);

  const cumulativeRanking = useMemo(
    () => calculateSchedinaCumulativeRanking(session, schedinaParticipants),
    [schedinaParticipants, session],
  );

  const choose = (matchIndex, sign) => {
    if (excluded || !isOpen || submitted) return;

    setPicks((current) => {
      const next = [...current];
      next[matchIndex] = sign;

      // Persist every draft immediately. This prevents a remount/navigation
      // from losing an unsubmitted schedina.
      saveFantaSchedinaPicks(
        FANTA_SCHEDINA_REF,
        selectedRound,
        teamId,
        next,
      ).catch((error) => {
        console.error("Errore salvataggio pronostico:", error);
      });

      return next;
    });
  };

  const confirm = async () => {
    if (excluded) {
      setMessage("⛔ La tua squadra non partecipa alla FantaSchedina.");
      return;
    }

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
        FANTA_SCHEDINA_REF,
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

  if (excluded) {
    return (
      <div
        className="mobile-feature-container mobile-schedina-container"
        style={{ maxWidth: "520px", margin: "0 auto", padding: "10px 12px 25px" }}
      >
        <div
          className="card"
          style={{
            padding: 20,
            textAlign: "center",
            border: "1px solid #7f1d1d",
            background: "#2a0d14",
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 8 }}>🎟️</div>
          <h2 style={{ color: "#f87171", margin: "0 0 8px" }}>
            FantaSchedina non attiva
          </h2>
          <div style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
            <strong>{teamName}</strong> non partecipa alla FantaSchedina.
            <br />
            Asta e Highlander restano disponibili normalmente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mobile-feature-container mobile-schedina-container"
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "10px 12px 25px",
      }}
    >
      <div
        className="card mobile-feature-hero"
        style={{
          padding: "14px",
          marginBottom: "10px",
        }}
      >

        <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
          FANTA SCHEDINA
        </div>
        <h2 style={{ color: "#38bdf8", margin: "4px 0" }}>
          🎟️ {teamName}
        </h2>

        <select
          className="mobile-feature-select"
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
          {orderedRounds.map(({ item, value }) => (
            <option key={item.label} value={value}>
              {value === activeRound ? `⭐ ${item.label} — GIORNATA ATTIVA` : item.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="card mobile-feature-card"
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
                    className={`mobile-sign-button ${active ? "active" : ""}`}
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
          className="btn btn-green mobile-confirm-action"
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

      <div className="card mobile-feature-card" style={{ padding: "12px", marginBottom: "10px" }}>
        <div style={{ color: "#fff", fontWeight: 900, marginBottom: "10px" }}>
          🎯 Schedine giocate — {round.label}
        </div>

        {playedCards.length === 0 ? (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: "12px 4px" }}>
            Nessuna schedina confermata per questa giornata.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {playedCards.map((card) => (
              <div
                key={card.id}
                style={{
                  border: "1px solid #33214f",
                  borderRadius: "12px",
                  padding: "12px",
                  background: "#100822",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ color: "#fff" }}>👤 {card.nome}</strong>
                  <span style={{ color: "#10b981", fontSize: "0.78rem", fontWeight: 900 }}>
                    🔒 CONFERMATA
                  </span>
                </div>

                {round.matches.map((match, index) => (
                  <div
                    key={`${card.id}-${match.home}-${match.away}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "8px",
                      padding: "7px 0",
                      borderTop: index === 0 ? "1px solid #21173d" : "0",
                    }}
                  >
                    <span style={{ color: "#cbd5e1", fontSize: "0.84rem" }}>
                      {match.home} - {match.away}
                    </span>
                    <strong style={{ color: "#38bdf8" }}>
                      {card.picks[index] || "—"}
                    </strong>
                  </div>
                ))}

                <div style={{ marginTop: "8px", color: "#10b981", textAlign: "right" }}>
                  Punti: <strong>{card.points}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mobile-feature-card" style={{ padding: "12px", marginBottom: "10px" }}>
        <div style={{ color: "#fff", fontWeight: 900, marginBottom: "10px" }}>
          🏆 Classifica generale FantaSchedina
        </div>

        {cumulativeRanking.length === 0 ? (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: "12px 4px" }}>
            Nessun partecipante disponibile.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "6px" }}>
            {cumulativeRanking.map((row, index) => {
              const isMe = String(row.id) === String(teamId);

              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 8px",
                    borderRadius: "8px",
                    background: isMe ? "#12304a" : "#100822",
                    border: isMe ? "1px solid #38bdf8" : "1px solid #21173d",
                  }}
                >
                  <div style={{ color: "#e5e7eb", fontWeight: isMe ? 900 : 600 }}>
                    <span style={{ color: "#94a3b8", marginRight: "8px" }}>
                      {index + 1}.
                    </span>
                    {row.nome}
                    {isMe && (
                      <span style={{ color: "#38bdf8", marginLeft: "6px", fontSize: "0.75rem" }}>
                        (TU)
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <strong style={{ color: "#38bdf8" }}>
                      {row.total} pt
                    </strong>
                    {row.adjustment !== 0 && (
                      <div style={{ color: row.adjustment < 0 ? "#f87171" : "#34d399", fontSize: "0.7rem" }}>
                        correzione {row.adjustment > 0 ? "+" : ""}{row.adjustment}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
