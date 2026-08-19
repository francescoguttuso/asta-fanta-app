import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { CALENDARIO_CAMPIONATO } from "@/data/calendarioData";
import {
  calculateSchedinaPoints,
  saveFantaSchedinaResults,
  setFantaSchedinaRound,
} from "@/features/schedina/fantaSchedinaStore";
import { useAuctionSessionContext } from "../context/useAuctionContexts";

const SIGNS = ["1", "X", "2"];

export default function FantaSchedinaAdminView() {
  const { docRef, partecipanti } = useAuctionSessionContext();
  const [session, setSession] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!docRef) return undefined;
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) setSession(snap.data());
    });
  }, [docRef]);

  const round = CALENDARIO_CAMPIONATO[selectedRound - 1];
  const roundState = session?.fantaSchedina?.rounds?.[selectedRound] || {};
  const isOpen =
    roundState.open === true ||
    session?.fantaSchedina?.activeRound === selectedRound;

  useEffect(() => {
    setResults(roundState.results || []);
  }, [selectedRound, roundState.results]);

  const ranking = useMemo(() => {
    return (partecipanti || [])
      .map((participant) => {
        const picks =
          roundState.picks?.[participant.id] || [];
        return {
          id: participant.id,
          nome: participant.nome,
          punti: calculateSchedinaPoints(picks, results),
          haGiocato: picks.filter(Boolean).length === round.matches.length,
        };
      })
      .sort((a, b) => b.punti - a.punti);
  }, [partecipanti, round, roundState.picks, results]);

  const saveResults = async () => {
    try {
      setSaving(true);
      await saveFantaSchedinaResults(docRef, selectedRound, results);
    } finally {
      setSaving(false);
    }
  };

  const toggleRound = async () => {
    await setFantaSchedinaRound(docRef, selectedRound, {
      open: !isOpen,
    });
  };

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
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "15px",
        }}
      >
        <div>
          <div style={{ color: "#38bdf8", fontSize: "22px", fontWeight: 900 }}>
            🎟️ FantaSchedina
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px" }}>
            1 punto per ogni pronostico 1/X/2 corretto
          </div>
        </div>

        <select
          value={selectedRound}
          onChange={(event) =>
            setSelectedRound(Number(event.target.value))
          }
          style={{ padding: "9px", borderRadius: "8px" }}
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
          gap: "8px",
          marginBottom: "15px",
        }}
      >
        {round.matches.map((match, index) => (
          <div
            key={`${match.home}-${match.away}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr repeat(3,44px)",
              gap: "7px",
              alignItems: "center",
              padding: "10px",
              border: "1px solid #21173d",
              borderRadius: "9px",
            }}
          >
            <strong style={{ color: "#e5e7eb" }}>
              {match.home} — {match.away}
            </strong>

            {SIGNS.map((sign) => (
              <button
                key={sign}
                type="button"
                onClick={() => {
                  const next = [...results];
                  next[index] = sign;
                  setResults(next);
                }}
                style={{
                  padding: "9px",
                  borderRadius: "7px",
                  border:
                    results[index] === sign
                      ? "2px solid #38bdf8"
                      : "1px solid #33214f",
                  background:
                    results[index] === sign ? "#12304a" : "#100822",
                  color: "#fff",
                  fontWeight: 900,
                }}
              >
                {sign}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
        <button
          type="button"
          className="btn btn-green"
          onClick={saveResults}
          disabled={saving || results.length !== round.matches.length}
        >
          {saving ? "SALVATAGGIO..." : "SALVA RISULTATI"}
        </button>

        <button type="button" className="btn" onClick={toggleRound}>
          {isOpen ? "🔒 CHIUDI GIORNATA" : "🔓 APRI GIORNATA"}
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid #21173d",
          paddingTop: "14px",
        }}
      >
        <h3 style={{ color: "#fff" }}>Classifica giornata</h3>

        {ranking.map((row, index) => (
          <div
            key={row.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "9px 0",
              borderBottom: "1px solid #170f2a",
              color: "#cbd5e1",
            }}
          >
            <span>
              {index + 1}. {row.nome}
              {!row.haGiocato && (
                <small style={{ color: "#f59e0b", marginLeft: "8px" }}>
                  non completata
                </small>
              )}
            </span>
            <strong style={{ color: "#38bdf8" }}>
              {row.punti} pt
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
