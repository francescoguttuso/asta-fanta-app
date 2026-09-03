import { ROLE_LIMITS } from "@/data/auctionDefaults";
import { countRosterRoles } from "@/utils/playerUtils";
import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "../context/useAuctionContexts";

const ROLE_CONFIG = {
  P: {
    label: "P",
    color: "#f28b42",
    limit: ROLE_LIMITS.P ?? 3,
  },
  D: {
    label: "D",
    color: "#48b94f",
    limit: ROLE_LIMITS.D ?? 8,
  },
  C: {
    label: "C",
    color: "#2196f3",
    limit: ROLE_LIMITS.C ?? 8,
  },
  A: {
    label: "A",
    color: "#e53935",
    limit: ROLE_LIMITS.A ?? 6,
  },
};

function getMaxBid(participant) {
  const rosterSize = participant.rosa?.length ?? 0;
  const maxPlayers = 25;

  /*
   * Bisogna conservare almeno 1 FM per ogni
   * posto ancora libero dopo l'acquisto.
   *
   * Esempio:
   * 500 crediti - 24 posti = 476 MAX
   */
  const remainingSlotsAfterPurchase = maxPlayers - rosterSize - 1;

  return Math.max(0, participant.crediti - remainingSlotsAfterPurchase);
}

function getPlayersByRole(rosa, role) {
  return (rosa ?? []).filter((player) => {
    const playerRole =
      typeof player.ruolo === "string" ? player.ruolo : player.ruolo?.code;

    return playerRole === role;
  });
}

function TeamHeader({ participant }) {
  const roleCounts = countRosterRoles(participant.rosa ?? [], ROLE_LIMITS);
  const rosterSize = participant.rosa?.length ?? 0;
  const maxBid = getMaxBid(participant);

  return (
    <div className="server-roster-team-header">
      <div className="server-roster-team-name" title={participant.nome}>
        <span className="server-roster-status-dot" />
        <strong>{participant.nome}</strong>
      </div>

      <div className="server-roster-credits">
        <span className="server-roster-credits-icon">$</span>
        <strong>{participant.crediti}</strong>
        <span>FM</span>
      </div>

      <div className="server-roster-meta">
        <span>MAX {maxBid}</span>
        <span>{rosterSize}/25</span>
      </div>

      <div className="server-roster-role-counts" aria-label="Composizione rosa">
        <span className="p">{roleCounts.P}/{ROLE_CONFIG.P.limit}</span>
        <span className="d">{roleCounts.D}/{ROLE_CONFIG.D.limit}</span>
        <span className="c">{roleCounts.C}/{ROLE_CONFIG.C.limit}</span>
        <span className="a">{roleCounts.A}/{ROLE_CONFIG.A.limit}</span>
      </div>
    </div>
  );
}

function RoleColumn({ participant, role, onRemovePlayer }) {
  const config = ROLE_CONFIG[role];
  const players = getPlayersByRole(participant.rosa, role);

  return (
    <div className="server-roster-role">
      <div
        className="server-roster-role-header"
        style={{ background: config.color }}
      >
        <span>{config.label}</span>
        <span>{players.length}/{config.limit}</span>
      </div>

      <div className="server-roster-player-slots">
        {Array.from({ length: config.limit }).map((_, index) => {
          const player = players[index];

          return (
            <div
              key={
                player
                  ? `${player.id ?? player.nome}-${index}`
                  : `empty-${role}-${index}`
              }
              className={`server-roster-player-slot ${player ? "filled" : "empty"}`}
            >
              {player ? (
                <>
                  <span
                    className="server-roster-player-name"
                    title={player.nome}
                  >
                    {player.nome}
                  </span>
                  <span className="server-roster-player-price">
                    {player.prezzo} FM
                  </span>
                  <button
                    type="button"
                    className="server-roster-delete"
                    title={`Rimuovi ${player.nome} dalla rosa`}
                    aria-label={`Rimuovi ${player.nome} dalla rosa`}
                    onClick={() =>
                      onRemovePlayer(participant.id, player.id)
                    }
                  >
                    🗑️
                  </button>
                </>
              ) : (
                <span className="server-roster-empty-slot">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamColumn({ participant, onRemovePlayer }) {
  return (
    <section className="server-roster-team-column">
      <TeamHeader participant={participant} />

      <RoleColumn
        participant={participant}
        role="P"
        onRemovePlayer={onRemovePlayer}
      />
      <RoleColumn
        participant={participant}
        role="D"
        onRemovePlayer={onRemovePlayer}
      />
      <RoleColumn
        participant={participant}
        role="C"
        onRemovePlayer={onRemovePlayer}
      />
      <RoleColumn
        participant={participant}
        role="A"
        onRemovePlayer={onRemovePlayer}
      />

      <div className="server-roster-team-footer">
        {participant.rosa?.length ?? 0}/25 GIOCATORI
      </div>
    </section>
  );
}

export default function RostersView() {
  const { partecipanti } = useAuctionSessionContext();
  const { rimuoviGiocatoreDallaRosa } = useAdminAuctionContext();

  if (!partecipanti || partecipanti.length === 0) {
    return (
      <div className="server-rosters-empty">
        Nessun partecipante disponibile.
      </div>
    );
  }

  return (
    <div className="server-rosters-view">
      <div className="server-rosters-toolbar">
        <div>
          <h2>ROSE</h2>
          <p>Tutte le squadre in vista verticale · crediti residui aggiornati in tempo reale</p>
        </div>
        <div className="server-rosters-legend">
          <span><i className="assigned" /> Giocatori assegnati</span>
          <span><i className="free" /> Posti liberi</span>
        </div>
      </div>

      <div
        className="server-rosters-grid"
        style={{ "--server-roster-teams": partecipanti.length }}
      >
        {partecipanti.map((participant) => (
          <TeamColumn
            key={participant.id}
            participant={participant}
            onRemovePlayer={rimuoviGiocatoreDallaRosa}
          />
        ))}
      </div>

      <div className="server-rosters-note">
        <span>ⓘ</span>
        <span>
          Clicca sul cestino per svincolare un giocatore. Il giocatore torna automaticamente nell'elenco dei disponibili all'asta e i crediti della squadra vengono restituiti.
        </span>
      </div>
    </div>
  );
}
