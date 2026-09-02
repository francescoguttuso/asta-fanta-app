import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  HIGHLANDER_BLOCKS,
  getHighlanderState,
  getSurvivors,
  calculateBlockRanking,
} from "../highlander/highlanderStore";
import MobileHeader from "./components/MobileHeader";
import MobileBottomNav from "./components/MobileBottomNav";

export default function MobileHighlander({ docRef, participants = [], onNavigate }) {
  const [session, setSession] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(1);

  useEffect(() => {
    if (!docRef) return undefined;
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) setSession(snap.data());
    });
  }, [docRef]);

  const state = getHighlanderState(session);
  const survivors = getSurvivors(session);
  const activeParticipants = useMemo(() => {
    if (!survivors.length) return participants;
    const ids = new Set(survivors.map(String));
    return participants.filter((p) => ids.has(String(p.id)));
  }, [participants, survivors]);
  const ranking = useMemo(() => calculateBlockRanking(session, activeParticipants, selectedBlock), [session, activeParticipants, selectedBlock]);
  const block = HIGHLANDER_BLOCKS.find((item) => item.id === selectedBlock);
  const eliminated = Object.keys(state?.eliminated || {}).length;

  return (
    <div className="mobile-page">
      <MobileHeader activeView="highlander" onNavigate={onNavigate} />
      <main className="mobile-container">
        <section className="mobile-card page-hero purple-hero">
          <h1>🏆 HIGHLANDER</h1>
          <p>Situazione aggiornata in tempo reale</p>
        </section>

        <section className="mobile-card">
          <div className="section-heading blue"><h2>👥 Superstiti</h2><span>{activeParticipants.length} in gioco</span></div>
          <div className="survivor-list">
            {activeParticipants.map((participant) => (
              <div className="survivor-row" key={participant.id}>
                <span className="survivor-dot" />
                <strong>{participant.nome || participant.name}</strong>
                <b>IN GIOCO</b>
              </div>
            ))}
          </div>
        </section>

        <section className="mobile-card">
          <div className="section-heading purple"><h2>☠️ Prossime eliminazioni</h2></div>
          <p className="muted-text">Il peggiore di ogni blocco verrà eliminato.</p>
          <div className="block-track">
            {HIGHLANDER_BLOCKS.map((item) => (
              <button key={item.id} type="button" className={selectedBlock === item.id ? "block-pill active" : "block-pill"} onClick={() => setSelectedBlock(item.id)}>
                {item.from}-{item.to}<small>{item.id}ª</small>
              </button>
            ))}
          </div>
        </section>

        <section className="mobile-card">
          <div className="section-heading blue"><h2>📊 Stato torneo</h2></div>
          <div className="tournament-stats">
            <div><span>Blocchi completati</span><strong>{Object.values(state?.blocks || {}).filter((b) => b?.completed).length}/{HIGHLANDER_BLOCKS.length}</strong></div>
            <div><span>Eliminati</span><strong>{eliminated}</strong></div>
            <div><span>Blocco corrente</span><strong>{block?.label || "—"}</strong></div>
          </div>
        </section>

        <section className="mobile-card">
          <div className="section-heading purple"><h2>📈 Punteggi {block?.label || ""}</h2></div>
          {ranking.length ? ranking.map((row, index) => (
            <div className="ranking-row" key={row.id}>
              <span>{index + 1}</span><strong>{row.nome}</strong><b>{row.total ?? "—"}</b>
            </div>
          )) : <p className="muted-text">Nessun punteggio disponibile.</p>}
        </section>
      </main>
      <MobileBottomNav activeView="highlander" onNavigate={onNavigate} />
    </div>
  );
}
