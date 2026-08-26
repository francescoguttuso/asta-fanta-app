import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  ensureHighlanderDocument,
  HIGHLANDER_REF,
  HIGHLANDER_BLOCKS,
  calculateBlockRanking,
  getEliminated,
  getSurvivors,
} from "./highlanderStore";

export default function HighlanderMobile({
  auctionDocRef,
  partecipanti = [],
  onBack,
}) {
  const [session, setSession] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const initialize = async () => {
      try {
        const initial = await ensureHighlanderDocument(auctionDocRef);
        if (!alive) return;
        setSession(initial || {});

        return onSnapshot(HIGHLANDER_REF, (snap) => {
          if (!alive || !snap.exists()) return;
          setSession(snap.data() || {});
        });
      } catch (error) {
        console.error("Errore caricamento Highlander mobile:", error);
      } finally {
        if (alive) setLoading(false);
      }
    };

    let unsubscribe = null;
    initialize().then((fn) => {
      unsubscribe = fn;
    });

    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [auctionDocRef]);

  const survivors = getSurvivors(session);
  const eliminated = getEliminated(session);

  const activeParticipants = useMemo(() => {
    if (survivors.length === 0) return partecipanti;
    const ids = new Set(survivors.map(String));
    return partecipanti.filter((p) => ids.has(String(p.id)));
  }, [partecipanti, survivors]);

  const completedBlocks = HIGHLANDER_BLOCKS.filter(
    (block) => session?.highlander?.blocks?.[block.id]?.completed,
  );

  const currentBlock =
    HIGHLANDER_BLOCKS.find(
      (block) => !session?.highlander?.blocks?.[block.id]?.completed,
    ) || null;

  const ranking = currentBlock
    ? calculateBlockRanking(session, partecipanti, currentBlock.id)
    : [];

  const championId = session?.highlander?.final?.championId;
  const champion = partecipanti.find(
    (p) => String(p.id) === String(championId),
  );

  if (loading) {
    return (
      <div className="container mobile-container" style={{ maxWidth: 520, margin: "0 auto", padding: 18 }}>
        <div className="card" style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
          Caricamento Highlander...
        </div>
      </div>
    );
  }

  return (
    <div
      className="container mobile-container"
      style={{ maxWidth: 520, margin: "0 auto", padding: "12px 12px 90px" }}
    >
      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 12,
          background: "linear-gradient(180deg,#08021b,#050114)",
          borderRadius: 14,
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
            marginBottom: 10,
            fontWeight: 800,
          }}
        >
          ← Torna all'asta
        </button>

        <div style={{ color: "#38bdf8", fontSize: 22, fontWeight: 900 }}>
          🏆 HIGHLANDER
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
          Situazione aggiornata in tempo reale
        </div>
      </div>

      {champion && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 12,
            textAlign: "center",
            border: "1px solid #a16207",
            background: "#2a2108",
          }}
        >
          <div style={{ color: "#facc15", fontSize: 13, fontWeight: 800 }}>
            CAMPIONE HIGHLANDER
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginTop: 5 }}>
            🏆 {champion.nome}
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 12,
          borderRadius: 12,
        }}
      >
        <div style={{ color: "#fff", fontWeight: 900, marginBottom: 10 }}>
          👥 Superstiti
        </div>

        {activeParticipants.length ? (
          <div style={{ display: "grid", gap: 7 }}>
            {activeParticipants.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: "#100822",
                  border: "1px solid #33214f",
                  color: "#e5e7eb",
                  fontWeight: 800,
                }}
              >
                <span>🟢 {p.nome}</span>
                <span style={{ color: "#34d399" }}>IN GIOCO</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#94a3b8" }}>Nessun superstite disponibile.</div>
        )}
      </div>

      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 12,
          borderRadius: 12,
        }}
      >
        <div style={{ color: "#fff", fontWeight: 900 }}>
          📊 Stato torneo
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
          Blocchi completati:{" "}
          <strong style={{ color: "#38bdf8" }}>
            {completedBlocks.length}/{HIGHLANDER_BLOCKS.length}
          </strong>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 5 }}>
          Eliminati:{" "}
          <strong style={{ color: "#f87171" }}>{eliminated.length}</strong>
        </div>
        {currentBlock && (
          <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>
            Blocco corrente:{" "}
            <strong style={{ color: "#fff" }}>
              {currentBlock.label} · G{currentBlock.from}/{currentBlock.to}
            </strong>
          </div>
        )}
      </div>

      {currentBlock && ranking.length > 0 && (
        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 12,
            borderRadius: 12,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 900, marginBottom: 10 }}>
            🧮 Classifica {currentBlock.label}
          </div>

          {ranking.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid #21173d",
              }}
            >
              <strong style={{ color: index === ranking.length - 1 ? "#f87171" : "#94a3b8" }}>
                {index + 1}.
              </strong>
              <span style={{ color: "#e5e7eb", fontWeight: 800 }}>
                {row.nome}
              </span>
              <strong style={{ color: row.total == null ? "#94a3b8" : "#38bdf8" }}>
                {row.total == null ? "—" : row.total}
              </strong>
            </div>
          ))}
        </div>
      )}

      {eliminated.length > 0 && (
        <div className="card" style={{ padding: 14, borderRadius: 12 }}>
          <div style={{ color: "#fff", fontWeight: 900, marginBottom: 8 }}>
            ❌ Eliminati
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {eliminated.map((item, index) => {
              const id = typeof item === "object" ? item.id : item;
              const p = partecipanti.find((x) => String(x.id) === String(id));
              return (
                <div key={`${id}-${index}`} style={{ color: "#fca5a5", fontSize: 13 }}>
                  ❌ {p?.nome || id}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
