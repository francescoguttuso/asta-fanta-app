import { useEffect, useMemo, useState } from "react";
import { deleteField, onSnapshot, updateDoc } from "firebase/firestore";
import { CALENDARIO_CAMPIONATO } from "@/data/calendarioData";
import { useAuctionSessionContext } from "../auction/context/useAuctionContexts";
import {
  calculateSchedinaPoints,
  getRoundResults,
} from "./fantaSchedinaStore";

const SIGNS = ["1", "X", "2"];

const getParticipantName = (participant) =>
  participant?.nome || participant?.name || `Squadra ${participant?.id ?? ""}`;

export default function FantaSchedinaAdminView() {
  const { docRef, partecipanti = [] } = useAuctionSessionContext();

  const [session, setSession] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!docRef) return undefined;

    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setSession(snap.data());
        }
      },
      (error) => {
        console.error("Errore lettura FantaSchedina:", error);
      },
    );
  }, [docRef]);

  const round = CALENDARIO_CAMPIONATO[selectedRound - 1];
  const roundState =
    session?.fantaSchedina?.rounds?.[selectedRound] || {};

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

  const cumulativeRanking = useMemo(() => {
    return partecipanti
      .map((participant) => {
        let total = 0;
        let playedRounds = 0;

        for (let roundIndex = 1; roundIndex <= CALENDARIO_CAMPIONATO.length; roundIndex += 1) {
          const state =
            session?.fantaSchedina?.rounds?.[roundIndex] || {};

          const rawPicks =
            state.picks?.[String(participant.id)] ??
            state.picks?.[participant.id] ??
            [];

          const roundPicks = Array.isArray(rawPicks) ? rawPicks : [];
          const roundResults = getRoundResults(session, roundIndex);

          if (roundPicks.length > 0) {
            playedRounds += 1;
            total += calculateSchedinaPoints(roundPicks, roundResults);
          }
        }

        return {
          id: participant.id,
          nome: getParticipantName(participant),
          total,
          playedRounds,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [partecipanti, session]);

  const setResult = (index, sign) => {
    setResults((current) => {
      const next = [...current];
      next[index] = sign;
      return next;
    });
  };

  const deleteSchedina = async (teamId, teamName) => {
    if (!docRef) return;

    const confirmed = window.confirm(
      `Cancellare la schedina di ${teamName} per la ${round.label}?`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await updateDoc(docRef, {
        [`fantaSchedina.rounds.${selectedRound}.picks.${teamId}`]:
          deleteField(),
      });
    } catch (error) {
      console.error("Errore cancellazione schedina:", error);
      alert("Impossibile cancellare la schedina.");
    } finally {
      setSaving(false);
    }
  };

  const saveResults = async () => {
    if (!docRef || !round || results.length !== round.matches.length) return;

    try {
      setSaving(true);

      await updateDoc(docRef, {
        [`fantaSchedina.rounds.${selectedRound}.results`]: results,
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

        <button
          type="button"
          className="btn btn-green"
          onClick={saveResults}
          disabled={saving || results.length !== round.matches.length}
          style={{ marginTop: 10 }}
        >
          {saving ? "SALVATAGGIO..." : "SALVA RISULTATI"}
        </button>
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
                      <strong
                        style={{
                          color: row.picks[index] ? "#38bdf8" : "#64748b",
                        }}
                      >
                        {row.picks[index] || "—"}
                      </strong>
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
                      <button
                        type="button"
                        onClick={() => deleteSchedina(row.id, row.nome)}
                        disabled={saving}
                        title="Cancella schedina"
                        style={{
                          border: "1px solid #5b1d2a",
                          background: "#210b14",
                          color: "#f87171",
                          borderRadius: 7,
                          padding: "6px 9px",
                          cursor: saving ? "not-allowed" : "pointer",
                          fontWeight: 900,
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ color: "#fff", marginBottom: 10 }}>
          🏆 Classifica FantaSchedina
        </h3>

        <div
          style={{
            display: "grid",
            gap: 6,
          }}
        >
          {cumulativeRanking.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                borderBottom: "1px solid #170f2a",
                color: "#cbd5e1",
              }}
            >
              <span>
                <strong style={{ color: "#fff", marginRight: 8 }}>
                  {index + 1}.
                </strong>
                {row.nome}
                <small
                  style={{
                    color: "#64748b",
                    marginLeft: 8,
                  }}
                >
                  {row.playedRounds} giornate
                </small>
              </span>

              <strong style={{ color: "#38bdf8", fontSize: 17 }}>
                {row.total} pt
              </strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

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
