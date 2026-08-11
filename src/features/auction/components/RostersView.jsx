import { ROLE_LIMITS } from "@/data/auctionDefaults";
import { countRosterRoles } from "@/utils/playerUtils";
import { useAuctionSessionContext } from "../context/useAuctionContexts";

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

function TeamCard({ participant }) {
  const roleCounts = countRosterRoles(participant.rosa ?? [], ROLE_LIMITS);

  const rosterSize = participant.rosa?.length ?? 0;
  const maxBid = getMaxBid(participant);

  const progress = Math.min(rosterSize / 25, 1) * 100;

  return (
    <div
      style={{
        background: "linear-gradient(145deg, #16083d 0%, #0c0528 100%)",
        border: "1px solid #35127a",
        borderRadius: "20px",
        padding: "12px 12px 14px",
        minWidth: "175px",
        flex: "1 0 175px",
        maxWidth: "190px",
        height: "215px",
        boxSizing: "border-box",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.25)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* MENU */}
      <div
        style={{
          position: "absolute",
          top: "7px",
          right: "9px",
          color: "#aaa",
          fontSize: "22px",
          lineHeight: 1,
        }}
      >
        ⋮
      </div>

      {/* NOME SQUADRA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          color: "#c7c7d8",
          fontWeight: "700",
          fontSize: "17px",
          paddingRight: "18px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: "#777",
            display: "inline-block",
            flexShrink: 0,
          }}
        />

        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {participant.nome}
        </span>
      </div>

      {/* CREDITI */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginTop: "14px",
        }}
      >
        <span
          style={{
            width: "25px",
            height: "25px",
            borderRadius: "50%",
            background: "linear-gradient(145deg, #ffd43b, #ff9800)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "15px",
            boxShadow: "0 2px 5px rgba(0,0,0,.4)",
          }}
        >
          $
        </span>

        <strong
          style={{
            fontSize: "27px",
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {participant.crediti}
        </strong>
      </div>

      {/* PROGRESS */}
      <div
        style={{
          height: "5px",
          borderRadius: "10px",
          background: "#1c1830",
          marginTop: "17px",
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

      {/* MAX + ROSA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: "13px",
          color: "#aaa9b9",
          fontWeight: "700",
          fontSize: "16px",
        }}
      >
        <div>
          <div>
            <strong
              style={{
                color: "#b7b5c5",
                fontSize: "17px",
              }}
            >
              ${maxBid}
            </strong>
          </div>

          <div
            style={{
              fontSize: "13px",
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
            gap: "5px",
            marginTop: "3px",
          }}
        >
          <span>{rosterSize}/25</span>

          <span
            style={{
              fontSize: "16px",
              color: "#bdbbc9",
            }}
          >
            ♟
          </span>
        </div>
      </div>

      {/* RUOLI */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "16px",
          padding: "0 4px",
          fontWeight: "800",
          fontSize: "17px",
        }}
      >
        <span style={{ color: "#ffb000" }}>
          {roleCounts.P}/{ROLE_CONFIG.P.limit}
        </span>

        <span style={{ color: "#00b85a" }}>
          {roleCounts.D}/{ROLE_CONFIG.D.limit}
        </span>

        <span style={{ color: "#2196f3" }}>
          {roleCounts.C}/{ROLE_CONFIG.C.limit}
        </span>

        <span style={{ color: "#e53935" }}>
          {roleCounts.A}/{ROLE_CONFIG.A.limit}
        </span>
      </div>
    </div>
  );
}

function RoleColumn({ participant, role }) {
  const config = ROLE_CONFIG[role];

  const players = getPlayersByRole(participant.rosa, role);

  return (
    <div
      style={{
        marginBottom: "24px",
      }}
    >
      {/* HEADER RUOLO */}
      <div
        style={{
          height: "27px",
          borderRadius: "7px",
          background: config.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 9px",
          color: "#fff",
          fontWeight: "800",
          fontSize: "16px",
          boxSizing: "border-box",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.15)",
        }}
      >
        <span>{config.label}</span>

        <span
          style={{
            fontSize: "15px",
            fontWeight: "500",
            opacity: 0.95,
          }}
        >
          {players.length}%
        </span>

        <span
          style={{
            fontSize: "17px",
            lineHeight: 1,
          }}
        >
          ⌃
        </span>
      </div>

      {/* SLOT GIOCATORI */}
      <div
        style={{
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
                minHeight: "34px",
                borderRadius: "6px",
                border: "1px solid #21173d",
                background: "linear-gradient(90deg, #0b0620, #10082b)",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                overflow: "hidden",
              }}
            >
              {player ? (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "5px",
                  }}
                >
                  <span
                    style={{
                      color: "#ddd",
                      fontSize: "13px",
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
                      color: "#f4f4f4",
                      fontSize: "12px",
                      fontWeight: "700",
                      flexShrink: 0,
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

export default function RostersView() {
  const { partecipanti } = useAuctionSessionContext();

  if (!partecipanti || partecipanti.length === 0) {
    return (
      <div
        className="card"
        style={{
          width: "100%",
          marginTop: "20px",
          color: "#94a3b8",
          textAlign: "center",
          padding: "30px",
        }}
      >
        Nessun partecipante disponibile.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        marginTop: "20px",
        overflow: "hidden",
        background: "linear-gradient(180deg, #08021b 0%, #050114 100%)",
        borderRadius: "14px",
        padding: "8px 0 30px",
        boxSizing: "border-box",
      }}
    >
      {/* =====================================================
          CARD SQUADRE
          ===================================================== */}

      <div
        style={{
          display: "flex",
          gap: "7px",
          overflowX: "auto",
          padding: "8px 8px 20px",
          scrollbarWidth: "thin",
        }}
      >
        {partecipanti.map((participant) => (
          <TeamCard key={participant.id} participant={participant} />
        ))}
      </div>

      {/* =====================================================
          ROSE
          ===================================================== */}

      <div
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: "10px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${partecipanti.length}, minmax(175px, 1fr))`,
            gap: "5px",
            minWidth: `${partecipanti.length * 180}px`,
            padding: "10px 8px 0",
            boxSizing: "border-box",
          }}
        >
          {partecipanti.map((participant) => (
            <div
              key={participant.id}
              style={{
                minWidth: 0,
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
