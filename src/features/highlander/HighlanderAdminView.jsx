import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  HIGHLANDER_BLOCKS,
  blockIsComplete,
  calculateBlockRanking,
  confirmBlockElimination,
  getEliminationCandidate,
  getHighlanderScores,
  getHighlanderState,
  getSurvivors,
  resetHighlanderRoundScores,
  resetHighlander,
  saveHighlanderFinalScores,
  saveHighlanderRoundScores,
  setHighlanderChampion,
} from "./highlanderStore";
import { useAuctionSessionContext } from "../auction/context/useAuctionContexts";

const ROUND_OPTIONS = Array.from({ length: 19 }, (_, index) => index + 1);

export default function HighlanderAdminView() {
  const { docRef, partecipanti = [] } = useAuctionSessionContext();

  const [session, setSession] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(1);
  const [scoresByRound, setScoresByRound] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!docRef) return undefined;

    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) setSession(snap.data());
    });
  }, [docRef]);

  const state = getHighlanderState(session);
  const survivors = getSurvivors(session);
  const block = HIGHLANDER_BLOCKS.find((item) => item.id === selectedBlock);

  const activeParticipants = useMemo(() => {
    if (!survivors.length) return partecipanti;
    const ids = new Set(survivors.map(String));
    return partecipanti.filter((p) => ids.has(String(p.id)));
  }, [partecipanti, survivors]);

  const currentRound = block?.from || 1;

  useEffect(() => {
    if (!session) return;

    const rounds = block ? [block.from, block.to] : [];

    setScoresByRound((current) => {
      const next = { ...current };

      rounds.forEach((round) => {
        next[round] = getHighlanderScores(session, round);
      });

      return next;
    });
  }, [session, block?.from, block?.to]);

  const ranking = useMemo(
    () => calculateBlockRanking(session, activeParticipants, selectedBlock),
    [session, activeParticipants, selectedBlock],
  );

  const complete = blockIsComplete(session, activeParticipants, selectedBlock);
  const elimination = getEliminationCandidate(ranking);
  const blockDone = Boolean(state?.blocks?.[selectedBlock]?.completed);

  const maxUnlockedBlock =
    HIGHLANDER_BLOCKS.findIndex(
      (item) => !state?.blocks?.[item.id]?.completed,
    ) + 1 || HIGHLANDER_BLOCKS.length;

  const setScore = (round, teamId, value) => {
    setScoresByRound((current) => ({
      ...current,
      [round]: {
        ...(current[round] || {}),
        [teamId]: value === "" ? "" : Number(value),
      },
    }));
  };

  const saveRound = async (round) => {
    try {
      setSaving(true);
      await saveHighlanderRoundScores(docRef, round, scoresByRound[round] || {});
    } catch (error) {
      console.error(error);
      alert("Impossibile salvare i risultati Highlander.");
    } finally {
      setSaving(false);
    }
  };

  const resetRound = async (round) => {
    if (!window.confirm(`Azzerare tutti i punteggi della ${round}ª giornata Highlander?`)) {
      return;
    }

    try {
      setSaving(true);
      await resetHighlanderRoundScores(docRef, round);
      setScoresByRound((current) => {
        const next = { ...current };
        delete next[round];
        return next;
      });
    } catch (error) {
      console.error(error);
      alert("Impossibile azzerare i risultati.");
    } finally {
      setSaving(false);
    }
  };

  const resetTournament = async () => {
    const confirmed = window.confirm(
      "ATTENZIONE: il reset cancellerà tutti i risultati Highlander, le eliminazioni, i superstiti e la finale. Vuoi continuare?",
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      await resetHighlander(docRef);
      setScoresByRound({});
      setSession((current) => ({
        ...(current || {}),
        highlander: {},
      }));
      setSelectedBlock(1);
    } catch (error) {
      console.error(error);
      alert("Impossibile resettare il torneo Highlander.");
    } finally {
      setSaving(false);
    }
  };

  const confirmElimination = async () => {
    if (!elimination?.candidate || elimination.unresolved) return;

    const candidate = elimination.candidate;
    const confirmed = window.confirm(
      `Confermare l'eliminazione di ${candidate.nome} dal ${block.label}?`,
    );

    if (!confirmed) return;

    const nextSurvivors = activeParticipants
      .filter((p) => String(p.id) !== String(candidate.id))
      .map((p) => p.id);

    try {
      setSaving(true);
      await confirmBlockElimination(
        docRef,
        selectedBlock,
        candidate.id,
        nextSurvivors,
      );
    } catch (error) {
      console.error(error);
      alert("Impossibile confermare l'eliminazione.");
    } finally {
      setSaving(false);
    }
  };

  const finalScores = state?.final?.scores || {};
  const finalSurvivors =
    survivors.length === 2
      ? partecipanti.filter((p) => survivors.map(String).includes(String(p.id)))
      : [];

  const saveFinal = async () => {
    try {
      setSaving(true);
      await saveHighlanderFinalScores(docRef, finalScores);
    } catch (error) {
      console.error(error);
      alert("Impossibile salvare i punteggi finali.");
    } finally {
      setSaving(false);
    }
  };

  const chooseChampion = async () => {
    if (finalSurvivors.length !== 2) return;

    const a = Number(finalScores[finalSurvivors[0].id]);
    const b = Number(finalScores[finalSurvivors[1].id]);

    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
      alert(
        a === b
          ? "Finale in parità: serve il criterio di spareggio previsto dal regolamento."
          : "Inserisci entrambi i punteggi della 19ª giornata.",
      );
      return;
    }

    const winner = a > b ? finalSurvivors[0] : finalSurvivors[1];

    if (!window.confirm(`Confermare ${winner.nome} come vincitore Highlander?`)) {
      return;
    }

    await setHighlanderChampion(docRef, winner.id);
  };

  return (
    <div
      style={{
        width: "100%",
        marginTop: 20,
        padding: 18,
        borderRadius: 14,
        background: "linear-gradient(180deg,#08021b,#050114)",
      }}
    >
      <div
        style={{
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ color: "#38bdf8", fontSize: 24, fontWeight: 900 }}>
            🏆 TORNEO HIGHLANDER
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
            Gestione esclusiva server · risultati · calcolo blocchi · eliminazioni
          </div>
        </div>

        <button
          type="button"
          onClick={resetTournament}
          disabled={saving}
          style={{
            border: "1px solid #7f1d1d",
            background: "#2a0d14",
            color: "#f87171",
            borderRadius: 8,
            padding: "9px 12px",
            fontWeight: 900,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          🔄 RESET HIGHLANDER
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        {HIGHLANDER_BLOCKS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.id > maxUnlockedBlock}
            onClick={() => setSelectedBlock(item.id)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #33214f",
              background:
                selectedBlock === item.id ? "#12304a" : "#100822",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {item.label} · G{item.from}/{item.to}
          </button>
        ))}
      </div>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ color: "#fff" }}>
          {block?.label} — giornate {block?.from}ª / {block?.to}ª
        </h3>

        {[block?.from, block?.to].map((round) => (
          <div
            key={round}
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #21173d",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <strong style={{ color: "#fff" }}>
                {round}ª giornata
              </strong>

              <button
                type="button"
                onClick={() => resetRound(round)}
                disabled={saving}
                style={{
                  border: "1px solid #7f1d1d",
                  background: "#2a0d14",
                  color: "#f87171",
                  borderRadius: 7,
                  padding: "6px 9px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                🗑️ Azzera
              </button>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {activeParticipants.map((participant) => {
                const value = getHighlanderScores(session, round)[participant.id];
                const draftValue = scoresByRound[round]?.[participant.id];

                return (
                  <div
                    key={participant.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 110px auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ color: "#e5e7eb" }}>
                      {participant.nome}
                    </strong>

                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draftValue ?? value ?? ""}
                      onChange={(event) =>
                        setScore(round, participant.id, event.target.value)
                      }
                      placeholder="Fantapunti"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: 8,
                        borderRadius: 7,
                        border: "1px solid #33214f",
                        background: "#100822",
                        color: "#fff",
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setScores((current) => ({
                          ...current,
                          [participant.id]: 55,
                        }))
                      }
                      style={{
                        border: "1px solid #33214f",
                        background: "#100822",
                        color: "#fbbf24",
                        borderRadius: 7,
                        padding: "7px 9px",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      55 uff.
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => saveRound(round)}
              disabled={saving}
              className="btn btn-green"
              style={{ marginTop: 10 }}
            >
              {saving ? "SALVATAGGIO..." : `💾 SALVA ${round}ª GIORNATA`}
            </button>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ color: "#fff" }}>🧮 Calcolo {block?.label}</h3>

        {!complete ? (
          <div style={{ color: "#fbbf24" }}>
            ⚠️ Inserisci i risultati di entrambe le giornate per calcolare il blocco.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Squadra</th>
                    <th style={th}>G{block?.from}</th>
                    <th style={th}>G{block?.to}</th>
                    <th style={th}>Totale</th>
                    <th style={th}>Peggiore</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row, index) => (
                    <tr key={row.id}>
                      <td style={td}>
                        <strong>
                          {index + 1}. {row.nome}
                        </strong>
                      </td>
                      <td style={td}>{row.score1}</td>
                      <td style={td}>{row.score2}</td>
                      <td style={td}>
                        <strong>{row.total}</strong>
                      </td>
                      <td style={td}>{row.worst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {elimination?.unresolved ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 9,
                  background: "#2a0d14",
                  color: "#f87171",
                }}
              >
                ⚠️ {elimination.reason}
              </div>
            ) : elimination?.candidate ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 9,
                  background: "#25101a",
                  color: "#fca5a5",
                }}
              >
                ❌ Eliminato previsto:{" "}
                <strong>{elimination.candidate.nome}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Totale {elimination.candidate.total} · peggior giornata{" "}
                  {elimination.candidate.worst}
                </div>
              </div>
            ) : null}

            {!blockDone && elimination?.candidate && !elimination.unresolved && (
              <button
                type="button"
                onClick={confirmElimination}
                disabled={saving}
                className="btn btn-green"
                style={{ marginTop: 10 }}
              >
                ➡️ CONFERMA ELIMINAZIONE E PASSA AL BLOCCO SUCCESSIVO
              </button>
            )}

            {blockDone && (
              <div style={{ marginTop: 12, color: "#34d399", fontWeight: 800 }}>
                ✅ Blocco già confermato.
              </div>
            )}
          </>
        )}
      </section>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ color: "#fff" }}>👥 Superstiti</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(survivors.length
            ? partecipanti.filter((p) =>
                survivors.map(String).includes(String(p.id)),
              )
            : partecipanti
          ).map((p) => (
            <span
              key={p.id}
              style={{
                padding: "7px 10px",
                borderRadius: 999,
                background: "#100822",
                border: "1px solid #33214f",
                color: "#cbd5e1",
              }}
            >
              {p.nome}
            </span>
          ))}
        </div>
      </section>

      {survivors.length === 2 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ color: "#fff" }}>
            🔄 Turni intermedi — 17ª / 18ª giornata
          </h3>

          <p style={{ color: "#94a3b8", fontSize: 12 }}>
            Le due squadre superstiti proseguono nelle giornate 17ª e 18ª.
            Il regolamento le indica come turni intermedi prima della
            finalissima della 19ª; non viene introdotta alcuna eliminazione
            aggiuntiva.
          </p>

          {[17, 18].map((round) => {
            const roundScores = getHighlanderScores(session, round);

            return (
              <div
                key={round}
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: "1px solid #21173d",
                  borderRadius: 10,
                }}
              >
                <strong style={{ color: "#fff" }}>
                  {round}ª giornata
                </strong>

                <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
                  {survivors.map((id) => {
                    const participant = partecipanti.find(
                      (p) => String(p.id) === String(id),
                    );

                    return (
                      <div
                        key={id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 120px",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ color: "#e5e7eb" }}>
                          {participant?.nome || id}
                        </strong>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={roundScores[id] ?? ""}
                          onChange={(event) => {
                            const next = {
                              ...roundScores,
                              [id]: event.target.value,
                            };
                            setSession((current) => ({
                              ...current,
                              highlander: {
                                ...(current?.highlander || {}),
                                scores: {
                                  ...(current?.highlander?.scores || {}),
                                  [round]: next,
                                },
                              },
                            }));
                          }}
                          placeholder="Fantapunti"
                          style={{
                            padding: 8,
                            borderRadius: 7,
                            border: "1px solid #33214f",
                            background: "#100822",
                            color: "#fff",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn btn-green"
                  style={{ marginTop: 10 }}
                  disabled={saving}
                  onClick={async () => {
                    try {
                      setSaving(true);
                      await saveHighlanderRoundScores(
                        docRef,
                        round,
                        roundScores,
                      );
                    } catch (error) {
                      console.error(error);
                      alert("Impossibile salvare i risultati.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  💾 SALVA {round}ª GIORNATA
                </button>
              </div>
            );
          })}
        </section>
      )}

      {survivors.length === 2 && (
        <section>
          <h3 style={{ color: "#fff" }}>
            🏆 Fase finale — 17ª / 18ª / 19ª giornata
          </h3>

          <p style={{ color: "#94a3b8", fontSize: 12 }}>
            I due superstiti accedono direttamente alla finalissima della 19ª giornata.
          </p>

          <div style={{ display: "grid", gap: 7 }}>
            {survivors.map((id) => {
              const participant = partecipanti.find(
                (p) => String(p.id) === String(id),
              );

              return (
                <div
                  key={id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <strong style={{ color: "#fff" }}>
                    {participant?.nome || id}
                  </strong>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={finalScores[id] ?? ""}
                    onChange={(event) => {
                      const next = {
                        ...finalScores,
                        [id]: event.target.value,
                      };
                      setSession((current) => ({
                        ...current,
                        highlander: {
                          ...(current?.highlander || {}),
                          final: {
                            ...(current?.highlander?.final || {}),
                            scores: next,
                          },
                        },
                      }));
                    }}
                    placeholder="19ª giornata"
                    style={{
                      padding: 8,
                      borderRadius: 7,
                      border: "1px solid #33214f",
                      background: "#100822",
                      color: "#fff",
                    }}
                  />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={saveFinal}
            disabled={saving}
            className="btn btn-green"
            style={{ marginTop: 10 }}
          >
            💾 SALVA PUNTEGGI 19ª
          </button>

          <button
            type="button"
            onClick={chooseChampion}
            disabled={saving}
            style={{
              display: "block",
              marginTop: 8,
              border: "1px solid #a16207",
              background: "#2a2108",
              color: "#facc15",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            🏆 CONFERMA VINCITORE
          </button>

          {state?.final?.championId && (
            <div style={{ marginTop: 12, color: "#facc15", fontWeight: 900 }}>
              🏆 Campione Highlander:{" "}
              {partecipanti.find(
                (p) => String(p.id) === String(state.final.championId),
              )?.nome || state.final.championId}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const th = {
  textAlign: "center",
  padding: 8,
  color: "#94a3b8",
  borderBottom: "1px solid #33214f",
  fontSize: 11,
};

const td = {
  textAlign: "center",
  padding: 8,
  color: "#cbd5e1",
  borderBottom: "1px solid #170f2a",
};
