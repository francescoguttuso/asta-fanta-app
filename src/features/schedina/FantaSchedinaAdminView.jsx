import { useEffect, useMemo, useState } from "react";
import { deleteField, onSnapshot, updateDoc } from "firebase/firestore";
import { CALENDARIO_CAMPIONATO } from "@/data/calendarioData";
import { useAuctionSessionContext } from "../auction/context/useAuctionContexts";
import {
  FANTA_SCHEDINA_REF,
  ensureFantaSchedinaDocument,
  calculateSchedinaPoints,
  calculateSchedinaCumulativeRanking,
  getRoundResults,
  getSchedinaRankingAdjustments,
} from "./fantaSchedinaStore";

const SIGNS = ["1", "X", "2"];

const getParticipantName = (participant) =>
  participant?.nome || participant?.name || `Squadra ${participant?.id ?? ""}`;

export default function FantaSchedinaAdminView() {
  const { docRef: auctionDocRef, partecipanti = [] } = useAuctionSessionContext();

  const [session, setSession] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [roundSaving, setRoundSaving] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingPicks, setEditingPicks] = useState([]);
  const [rankingAdjustments, setRankingAdjustments] = useState({});
  const [savingAdjustment, setSavingAdjustment] = useState(null);

  useEffect(() => {
    // The FantaSchedina is independent from the auction.
    // The auction ref is used only for a one-time migration if the new
    // document has never existed.
    ensureFantaSchedinaDocument(auctionDocRef).catch((error) =>
      console.error("Errore inizializzazione FantaSchedina:", error),
    );

    return onSnapshot(
      FANTA_SCHEDINA_REF,
      (snap) => {
        if (snap.exists()) {
          setSession(snap.data());
        }
      },
      (error) => {
        console.error("Errore lettura FantaSchedina:", error);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const round = CALENDARIO_CAMPIONATO[selectedRound - 1];
  const roundState =
    session?.rounds?.[selectedRound] || {};

  useEffect(() => {
    setResults(roundState.results || []);
  }, [selectedRound, roundState.results]);

  const picksByTeam = roundState.picks || {};

  const playedRows = useMemo(
    () =>
      partecipanti.map((participant) => {
        const rawPicks =
          picksByTeam[String(participant.id)] ??
          picksByTeam[participant.id] ??
          [];

        const picks = Array.isArray(rawPicks) ? rawPicks : [];

        return {
          id: participant.id,
          nome: getParticipantName(participant),
          picks,
          completed: picks.filter(Boolean).length,
          points: calculateSchedinaPoints(picks, results),
        };
      }),
    [partecipanti, picksByTeam, results],
  );

  const cumulativeRanking = useMemo(
    () => calculateSchedinaCumulativeRanking(session, partecipanti),
    [partecipanti, session],
  );

  useEffect(() => {
    setRankingAdjustments(getSchedinaRankingAdjustments(session));
  }, [session]);

  const setResult = (index, sign) => {
    setResults((current) => {
      const next = [...current];
      next[index] = sign;
      return next;
    });
  };

  const toggleRound = async () => {
    if (!FANTA_SCHEDINA_REF) return;

    try {
      setRoundSaving(true);
      const nextOpen = !Boolean(roundState.open);

      await updateDoc(FANTA_SCHEDINA_REF, {
        [`rounds.${selectedRound}.open`]: nextOpen,
        [`rounds.${selectedRound}.lockedAt`]: nextOpen
          ? null
          : new Date().toISOString(),
        "activeRound": nextOpen ? selectedRound : null,
      });
    } catch (error) {
      console.error("Errore apertura/chiusura giornata:", error);
      alert("Impossibile modificare lo stato della giornata.");
    } finally {
      setRoundSaving(false);
    }
  };

  const startEditSchedina = (row) => {
    setEditingTeamId(row.id);
    setEditingPicks([...row.picks]);
  };

  const setEditingPick = (index, sign) => {
    setEditingPicks((current) => {
      const next = [...current];
      next[index] = sign;
      return next;
    });
  };

  const saveEditedSchedina = async (teamId, teamName) => {
    if (editingPicks.length !== round.matches.length) return;

    try {
      setSaving(true);
      const roundResults = getRoundResults(session, selectedRound);
      const updates = {
        [`rounds.${selectedRound}.picks.${teamId}`]: editingPicks,
        [`rounds.${selectedRound}.submittedAt.${teamId}`]: new Date().toISOString(),
      };

      if (roundResults.length > 0) {
        updates[`rounds.${selectedRound}.pointsByTeam.${teamId}`] =
          calculateSchedinaPoints(editingPicks, roundResults);
      }

      await updateDoc(FANTA_SCHEDINA_REF, updates);
      setEditingTeamId(null);
      setEditingPicks([]);
    } catch (error) {
      console.error(`Errore modifica schedina di ${teamName}:`, error);
      alert("Impossibile modificare la schedina.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedina = async (teamId, teamName) => {
    if (!FANTA_SCHEDINA_REF) return;

    const confirmed = window.confirm(
      `Cancellare la schedina di ${teamName} per la ${round.label}?`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await updateDoc(FANTA_SCHEDINA_REF, {
        [`rounds.${selectedRound}.picks.${teamId}`]: deleteField(),
        [`rounds.${selectedRound}.submittedAt.${teamId}`]: deleteField(),
        [`rounds.${selectedRound}.pointsByTeam.${teamId}`]: deleteField(),
      });
    } catch (error) {
      console.error("Errore cancellazione schedina:", error);
      alert("Impossibile cancellare la schedina.");
    } finally {
      setSaving(false);
    }
  };

  const saveRankingAdjustment = async (teamId) => {
    if (!FANTA_SCHEDINA_REF) return;

    const current = rankingAdjustments[String(teamId)] || {};
    const points = Number(current.points || 0);
    const reason = String(current.reason || "").trim();

    try {
      setSavingAdjustment(teamId);
      await updateDoc(FANTA_SCHEDINA_REF, {
        [`rankingAdjustments.${teamId}`]: {
          points: Number.isFinite(points) ? points : 0,
          reason,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Errore modifica classifica FantaSchedina:", error);
      alert("Impossibile salvare la correzione della classifica.");
    } finally {
      setSavingAdjustment(null);
    }
  };

  const saveResults = async () => {
    if (!round || results.length !== round.matches.length) return;

    try {
      setSaving(true);

      const pointsByTeam = {};
      const roundPicks = roundState.picks || {};

      partecipanti.forEach((participant) => {
        const picks =
          roundPicks[String(participant.id)] ??
          roundPicks[participant.id] ??
          [];

        pointsByTeam[String(participant.id)] = calculateSchedinaPoints(
          Array.isArray(picks) ? picks : [],
          results,
        );
      });

      await updateDoc(FANTA_SCHEDINA_REF, {
        [`rounds.${selectedRound}.results`]: results,
        [`rounds.${selectedRound}.pointsByTeam`]: pointsByTeam,
      });
    } catch (error) {
      console.error("Errore salvataggio risultati FantaSchedina:", error);
      alert("Impossibile salvare i risultati della FantaSchedina.");
    } finally {
      setSaving(false);
    }
  };

  if (!round) {
    return (
      <div className="card" style={{ marginTop: 20, padding: 25 }}>
        Nessuna giornata disponibile.
      </div>
    );
  }

  const playedCount = playedRows.filter((row) => row.completed > 0).length;
  const completedCount = playedRows.filter(
    (row) => row.completed === round.matches.length,
  ).length;

  return (
    <div
      style={{
        width: "100%",
        marginTop: "20px",
        background: "linear-gradient(180deg,#08021b,#050114)",
        borderRadius: "14px",
        padding: "18px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ color: "#38bdf8", fontSize: 23, fontWeight: 900 }}>
            🎟️ FantaSchedina
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
            Schedine giocate · risultati · punti · classifica
          </div>
        </div>

        <select
          value={selectedRound}
          onChange={(event) => setSelectedRound(Number(event.target.value))}
          style={{
            padding: "9px 10px",
            borderRadius: 8,
            border: "1px solid #33214f",
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
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          background: roundState.open ? "#0b2a20" : "#25101a",
          border: `1px solid ${roundState.open ? "#14532d" : "#5b1d2a"}`,
          borderRadius: 10,
          padding: "11px 13px",
          marginBottom: 12,
        }}
      >
        <div>
          <strong style={{ color: roundState.open ? "#34d399" : "#f87171" }}>
            {roundState.open ? "🟢 GIORNATA APERTA" : "🔴 GIORNATA CHIUSA"}
          </strong>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
            {roundState.open
              ? "Le squadre possono ancora consegnare la schedina."
              : "Le nuove schedine e le modifiche da mobile sono bloccate."}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleRound}
          disabled={roundSaving}
          style={{
            border: "1px solid #33214f",
            background: "#100822",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: roundSaving ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {roundSaving
            ? "AGGIORNAMENTO..."
            : roundState.open
              ? "🔒 CHIUDI GIORNATA"
              : "🔓 APRI GIORNATA"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 18,
        }}
      >
        {[
          ["👥", "Partecipanti", partecipanti.length],
          ["🎟️", "Hanno giocato", playedCount],
          ["✅", "Complete", completedCount],
        ].map(([icon, label, value]) => (
          <div
            key={label}
            style={{
              background: "#100822",
              border: "1px solid #21173d",
              borderRadius: 9,
              padding: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 18 }}>{icon}</div>
            <div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div>
            <strong style={{ color: "#fff", fontSize: 18 }}>{value}</strong>
          </div>
        ))}
      </div>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ color: "#fff", marginBottom: 10 }}>
          Risultati — {round.label}
        </h3>

        <div style={{ display: "grid", gap: 8 }}>
          {round.matches.map((match, index) => (
            <div
              key={`${match.home}-${match.away}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr repeat(3, 42px)",
                gap: 7,
                alignItems: "center",
                padding: 10,
                border: "1px solid #21173d",
                borderRadius: 9,
              }}
            >
              <strong style={{ color: "#e5e7eb" }}>
                {match.home} — {match.away}
              </strong>

              {SIGNS.map((sign) => (
                <button
                  key={sign}
                  type="button"
                  onClick={() => setResult(index, sign)}
                  style={{
                    padding: 8,
                    borderRadius: 7,
                    border:
                      results[index] === sign
                        ? "2px solid #38bdf8"
                        : "1px solid #33214f",
                    background:
                      results[index] === sign ? "#12304a" : "#100822",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {sign}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-green"
            onClick={saveResults}
            disabled={saving || results.length !== round.matches.length}
          >
            {saving ? "SALVATAGGIO..." : "SALVA RISULTATI"}
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ color: "#fff", marginBottom: 10 }}>
          📋 Schedine giocate — {round.label}
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 720,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Squadra</th>
                {round.matches.map((_, index) => (
                  <th key={index} style={thStyle}>
                    {index + 1}
                  </th>
                ))}
                <th style={thStyle}>Punti</th>
                <th style={thStyle}>Stato</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {playedRows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <strong>{row.nome}</strong>
                  </td>

                  {round.matches.map((_, index) => (
                    <td key={index} style={tdStyle}>
                      {editingTeamId === row.id ? (
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          {SIGNS.map((sign) => (
                            <button
                              key={sign}
                              type="button"
                              onClick={() => setEditingPick(index, sign)}
                              style={{
                                border: editingPicks[index] === sign ? "2px solid #38bdf8" : "1px solid #33214f",
                                background: editingPicks[index] === sign ? "#12304a" : "#100822",
                                color: "#fff",
                                borderRadius: 5,
                                padding: "3px 6px",
                                fontWeight: 900,
                              }}
                            >
                              {sign}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <strong style={{ color: row.picks[index] ? "#38bdf8" : "#64748b" }}>
                          {row.picks[index] || "—"}
                        </strong>
                      )}
                    </td>
                  ))}

                  <td style={tdStyle}>
                    <strong style={{ color: "#10b981" }}>
                      {row.points}
                    </strong>
                  </td>

                  <td style={tdStyle}>
                    {row.completed === round.matches.length ? (
                      <span style={{ color: "#10b981" }}>CONSEGNATA</span>
                    ) : row.completed > 0 ? (
                      <span style={{ color: "#f59e0b" }}>
                        {row.completed}/{round.matches.length}
                      </span>
                    ) : (
                      <span style={{ color: "#64748b" }}>NON GIOCATA</span>
                    )}
                  </td>

                  <td style={tdStyle}>
                    {row.completed > 0 && (
                      editingTeamId === row.id ? (
                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                          <button
                            type="button"
                            onClick={() => saveEditedSchedina(row.id, row.nome)}
                            disabled={saving || editingPicks.length !== round.matches.length || editingPicks.some((pick) => !pick)}
                            title="Salva modifica"
                            style={{ border: "1px solid #14532d", background: "#0b2a20", color: "#34d399", borderRadius: 7, padding: "6px 9px", fontWeight: 900 }}
                          >
                            💾
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingTeamId(null); setEditingPicks([]); }}
                            disabled={saving}
                            title="Annulla modifica"
                            style={{ border: "1px solid #33214f", background: "#100822", color: "#cbd5e1", borderRadius: 7, padding: "6px 9px", fontWeight: 900 }}
                          >
                            ✖️
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                          <button
                            type="button"
                            onClick={() => startEditSchedina(row)}
                            disabled={saving}
                            title="Modifica schedina"
                            style={{ border: "1px solid #33214f", background: "#100822", color: "#38bdf8", borderRadius: 7, padding: "6px 9px", fontWeight: 900 }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSchedina(row.id, row.nome)}
                            disabled={saving}
                            title="Cancella schedina"
                            style={{ border: "1px solid #5b1d2a", background: "#210b14", color: "#f87171", borderRadius: 7, padding: "6px 9px", fontWeight: 900 }}
                          >
                            🗑️
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ color: "#fff", marginBottom: 6 }}>
          🏆 Classifica FantaSchedina
        </h3>
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10 }}>
          La classifica è cumulativa e non viene azzerata: i punti delle giornate restano salvati e vengono sommati automaticamente.
          Le correzioni inserite qui sono separate dai risultati delle partite.
        </div>

        <div style={{ display: "grid", gap: 7 }}>
          {cumulativeRanking.map((row, index) => {
            const adjustment = rankingAdjustments[String(row.id)] || {};
            const value = adjustment.points ?? row.adjustment ?? 0;
            const reason = adjustment.reason ?? "";

            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1fr) 90px 180px 70px 90px",
                  gap: 8,
                  alignItems: "center",
                  padding: "9px 10px",
                  borderBottom: "1px solid #170f2a",
                }}
              >
                <div>
                  <strong style={{ color: "#fff" }}>{index + 1}. {row.nome}</strong>
                  <div style={{ color: "#64748b", fontSize: 11 }}>
                    {row.playedRounds} giornate · base {row.baseTotal} pt
                  </div>
                </div>

                <strong style={{ color: "#38bdf8", textAlign: "center" }}>
                  {row.total} pt
                </strong>

                <input
                  type="text"
                  value={reason}
                  placeholder="Motivo penalità/correzione"
                  onChange={(event) =>
                    setRankingAdjustments((current) => ({
                      ...current,
                      [row.id]: { ...current[String(row.id)], points: value, reason: event.target.value },
                    }))
                  }
                  style={inputStyle}
                />

                <input
                  type="number"
                  step="1"
                  value={value}
                  onChange={(event) =>
                    setRankingAdjustments((current) => ({
                      ...current,
                      [row.id]: { ...current[String(row.id)], points: event.target.value, reason },
                    }))
                  }
                  title="Correzione punti: usare un numero negativo per una penalità"
                  style={{ ...inputStyle, textAlign: "center" }}
                />

                <button
                  type="button"
                  onClick={() => saveRankingAdjustment(row.id)}
                  disabled={savingAdjustment === row.id}
                  style={saveButtonStyle}
                >
                  {savingAdjustment === row.id ? "..." : "SALVA"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 8px",
  borderRadius: 7,
  border: "1px solid #33214f",
  background: "#100822",
  color: "#fff",
  fontSize: 12,
};

const saveButtonStyle = {
  border: "1px solid #14532d",
  background: "#0b2a20",
  color: "#34d399",
  borderRadius: 7,
  padding: "7px 8px",
  fontWeight: 900,
  cursor: "pointer",
};

const thStyle = {
  textAlign: "center",
  padding: "9px 7px",
  color: "#94a3b8",
  fontSize: 11,
  borderBottom: "1px solid #33214f",
};

const tdStyle = {
  textAlign: "center",
  padding: "9px 7px",
  color: "#cbd5e1",
  borderBottom: "1px solid #170f2a",
};
