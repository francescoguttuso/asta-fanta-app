import { ROLE_LIMITS } from "@/data/auctionDefaults";
import { countRosterRoles } from "@/utils/playerUtils";
import { useAuctionSessionContext } from "../context/useAuctionContexts";

// =====================================================
// CONFIGURAZIONE RUOLI
// =====================================================

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

// =====================================================
// CALCOLO MASSIMO BID
// =====================================================

function getMaxBid(participant) {
  const rosterSize = participant.rosa?.length ?? 0;

  const maxPlayers = 25;

  const remainingSlotsAfterPurchase = maxPlayers - rosterSize - 1;

  return Math.max(0, participant.crediti - remainingSlotsAfterPurchase);
}

// =====================================================
// GIOCATORI PER RUOLO
// =====================================================

function getPlayersByRole(rosa, role) {
  return (rosa ?? []).filter((player) => {
    const playerRole =
      typeof player.ruolo === "string" ? player.ruolo : player.ruolo?.code;

    return playerRole === role;
  });
}

// =====================================================
// CARD SQUADRA
// =====================================================

function TeamCard({ participant }) {
  const roleCounts = countRosterRoles(participant.rosa ?? [], ROLE_LIMITS);

  const rosterSize = participant.rosa?.length ?? 0;

  const maxBid = getMaxBid(participant);

  const progress = Math.min(rosterSize / 25, 1) * 100;

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,

        height: "215px",

        boxSizing: "border-box",

        background: "linear-gradient(145deg, #16083d 0%, #0c0528 100%)",

        border: "1px solid #35127a",

        borderRadius: "18px",

        padding: "10px 8px 12px",

        position: "relative",

        overflow: "hidden",

        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* =================================================
          MENU
          ================================================= */}

      <div
        style={{
          position: "absolute",

          top: "6px",
          right: "6px",

          color: "#aaa",

          fontSize: "19px",

          lineHeight: 1,
        }}
      >
        ⋮
      </div>

      {/* =================================================
          NOME SQUADRA
          ================================================= */}

      <div
        style={{
          display: "flex",

          alignItems: "center",

          gap: "5px",

          color: "#c7c7d8",

          fontWeight: "700",

          fontSize: "13px",

          paddingRight: "15px",

          whiteSpace: "nowrap",

          overflow: "hidden",

          textOverflow: "ellipsis",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",

            flexShrink: 0,

            borderRadius: "50%",

            background: "#777",

            display: "inline-block",
          }}
        />

        <span
          style={{
            minWidth: 0,

            overflow: "hidden",

            textOverflow: "ellipsis",

            whiteSpace: "nowrap",
          }}
        >
          {participant.nome}
        </span>
      </div>

      {/* =================================================
          CREDITI
          ================================================= */}

      <div
        style={{
          display: "flex",

          alignItems: "center",

          justifyContent: "center",

          gap: "5px",

          marginTop: "12px",
        }}
      >
        <span
          style={{
            width: "23px",
            height: "23px",

            flexShrink: 0,

            borderRadius: "50%",

            background: "linear-gradient(145deg, #ffd43b, #ff9800)",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            color: "#fff",

            fontSize: "13px",

            boxShadow: "0 2px 5px rgba(0,0,0,.4)",
          }}
        >
          $
        </span>

        <strong
          style={{
            fontSize: "22px",

            color: "#fff",

            lineHeight: 1,
          }}
        >
          {participant.crediti}
        </strong>
      </div>

      {/* =================================================
          PROGRESS BAR
          ================================================= */}

      <div
        style={{
          width: "100%",

          height: "5px",

          borderRadius: "10px",

          background: "#1c1830",

          marginTop: "14px",

          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,

            height: "100%",

            background: "linear-gradient(90deg, #8cff3b, #a8ff39)",

            borderRadius: "10px",
          }}
        />
      </div>

      {/* =================================================
          MAX + ROSA
          ================================================= */}

      <div
        style={{
          display: "flex",

          justifyContent: "space-between",

          alignItems: "flex-start",

          marginTop: "11px",

          color: "#aaa9b9",

          fontWeight: "700",

          fontSize: "12px",
        }}
      >
        <div>
          <div>
            <strong
              style={{
                color: "#b7b5c5",

                fontSize: "15px",
              }}
            >
              {maxBid}
            </strong>
          </div>

          <div
            style={{
              fontSize: "11px",

              marginTop: "1px",
            }}
          >
            MAX
          </div>
        </div>

        <div
          style={{
            display: "flex",

            alignItems: "center",

            gap: "3px",

            marginTop: "2px",
          }}
        >
          <span>{rosterSize}/25</span>

          <span
            style={{
              fontSize: "13px",

              color: "#bdbbc9",
            }}
          >
            ♟
          </span>
        </div>
      </div>

      {/* =================================================
          CONTATORI RUOLI
          ================================================= */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns: "repeat(4, 1fr)",

          gap: "2px",

          marginTop: "16px",

          textAlign: "center",

          fontWeight: "800",

          fontSize: "13px",
        }}
      >
        <span
          style={{
            color: "#ffb000",
          }}
        >
          {roleCounts.P}/{ROLE_CONFIG.P.limit}
        </span>

        <span
          style={{
            color: "#00b85a",
          }}
        >
          {roleCounts.D}/{ROLE_CONFIG.D.limit}
        </span>

        <span
          style={{
            color: "#2196f3",
          }}
        >
          {roleCounts.C}/{ROLE_CONFIG.C.limit}
        </span>

        <span
          style={{
            color: "#e53935",
          }}
        >
          {roleCounts.A}/{ROLE_CONFIG.A.limit}
        </span>
      </div>
    </div>
  );
}

// =====================================================
// COLONNA RUOLO
// =====================================================

function RoleColumn({ participant, role }) {
  const config = ROLE_CONFIG[role];

  const players = getPlayersByRole(participant.rosa, role);

  return (
    <div
      style={{
        width: "100%",

        minWidth: 0,

        boxSizing: "border-box",

        marginBottom: "24px",
      }}
    >
      {/* =================================================
          HEADER RUOLO
          ================================================= */}

      <div
        style={{
          width: "100%",

          height: "27px",

          borderRadius: "7px",

          background: config.color,

          display: "flex",

          alignItems: "center",

          justifyContent: "space-between",

          padding: "0 7px",

          color: "#fff",

          fontWeight: "800",

          fontSize: "13px",

          boxSizing: "border-box",

          overflow: "hidden",

          boxShadow: "inset 0 1px 0 rgba(255,255,255,.15)",
        }}
      >
        <span>{config.label}</span>

        <span
          style={{
            fontSize: "12px",

            fontWeight: "600",

            opacity: 0.95,
          }}
        >
          {players.length}/{config.limit}
        </span>

        <span
          style={{
            fontSize: "14px",

            lineHeight: 1,
          }}
        >
          ⌃
        </span>
      </div>

      {/* =================================================
          SLOT GIOCATORI
          ================================================= */}

      <div
        style={{
          width: "100%",

          display: "flex",

          flexDirection: "column",

          gap: "5px",

          marginTop: "9px",
        }}
      >
        {Array.from({
          length: config.limit,
        }).map((_, index) => {
          const player = players[index];

          return (
            <div
              key={
                player
                  ? `${player.id ?? player.nome}-${index}`
                  : `empty-${role}-${index}`
              }
              style={{
                width: "100%",

                minWidth: 0,

                minHeight: "34px",

                borderRadius: "6px",

                border: "1px solid #21173d",

                background: "linear-gradient(90deg, #0b0620, #10082b)",

                boxSizing: "border-box",

                display: "flex",

                alignItems: "center",

                padding: "0 6px",

                overflow: "hidden",
              }}
            >
              {player ? (
                <div
                  style={{
                    width: "100%",

                    minWidth: 0,

                    display: "flex",

                    alignItems: "center",

                    justifyContent: "space-between",

                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      minWidth: 0,

                      color: "#ddd",

                      fontSize: "11px",

                      fontWeight: "700",

                      overflow: "hidden",

                      textOverflow: "ellipsis",

                      whiteSpace: "nowrap",
                    }}
                  >
                    {player.nome}
                  </span>

                  <span
                    style={{
                      flexShrink: 0,

                      color: "#f4f4f4",

                      fontSize: "10px",

                      fontWeight: "700",
                    }}
                  >
                    {player.prezzo} FM
                  </span>
                </div>
              ) : (
                <span
                  style={{
                    width: "100%",

                    height: "1px",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// TEAMS SUMMARY
// =====================================================

export default function TeamsSummary() {
  const { partecipanti } = useAuctionSessionContext();

  // ===================================================
  // NESSUN PARTECIPANTE
  // ===================================================

  if (!partecipanti || partecipanti.length === 0) {
    return (
      <div
        style={{
          width: "100%",

          padding: "30px",

          color: "#94a3b8",

          textAlign: "center",
        }}
      >
        Nessun partecipante disponibile.
      </div>
    );
  }

  const numeroSquadre = partecipanti.length;

  // ===================================================
  // CONTENITORE PRINCIPALE
  // ===================================================

  return (
    <div
      className="teams-summary-fullscreen"
      style={{
        /*
         * =================================================
         * IMPORTANTE
         * =================================================
         *
         * Il parent della Dashboard ha un margine/padding
         * sinistro di circa 40px.
         *
         * Spostiamo SOLO questo blocco verso sinistra.
         *
         * width: 100vw mantiene tutta la larghezza.
         *
         * left: -40px elimina il bordo vuoto a sinistra.
         */

        position: "relative",

        left: "-40px",

        width: "100vw",

        maxWidth: "100vw",

        boxSizing: "border-box",

        marginTop: "20px",

        padding: "8px 20px 40px",

        background: "linear-gradient(180deg, #08021b 0%, #050114 100%)",

        borderRadius: "14px",

        overflow: "hidden",
      }}
    >
      {/* =================================================
          TITOLO
          ================================================= */}

      <div
        style={{
          width: "100%",

          boxSizing: "border-box",

          color: "#fff",

          fontSize: "22px",

          fontWeight: "800",

          padding: "8px 8px 14px",
        }}
      >
        👥 Rose e Crediti Residui
      </div>

      {/* =================================================
          CARD DELLE 10 SQUADRE
          ================================================= */}

      <div
        style={{
          width: "100%",

          display: "grid",

          gridTemplateColumns: `repeat(${numeroSquadre}, minmax(0, 1fr))`,

          gap: "6px",

          boxSizing: "border-box",

          alignItems: "stretch",
        }}
      >
        {partecipanti.map((participant) => (
          <TeamCard key={participant.id} participant={participant} />
        ))}
      </div>

      {/* =================================================
          ROSE
          ================================================= */}

      <div
        style={{
          width: "100%",

          marginTop: "18px",

          boxSizing: "border-box",

          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",

            display: "grid",

            gridTemplateColumns: `repeat(${numeroSquadre}, minmax(0, 1fr))`,

            gap: "6px",

            boxSizing: "border-box",

            alignItems: "start",
          }}
        >
          {partecipanti.map((participant) => (
            <div
              key={participant.id}
              style={{
                width: "100%",

                minWidth: 0,

                boxSizing: "border-box",
              }}
            >
              <RoleColumn participant={participant} role="P" />

              <RoleColumn participant={participant} role="D" />

              <RoleColumn participant={participant} role="C" />

              <RoleColumn participant={participant} role="A" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
