import { useMemo, useState } from "react";
import { CALENDARIO_CAMPIONATO } from "@/data/calendarioData";

const teamColors = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#f59e0b",
  "#fb7185",
];

function MatchCard({ match }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 48px 1fr",
        alignItems: "center",
        gap: "8px",
        padding: "12px 14px",
        borderRadius: "10px",
        background: "linear-gradient(90deg, #0b0620, #12082d)",
        border: "1px solid #21173d",
      }}
    >
      <div style={{ textAlign: "right", color: "#e5e7eb", fontWeight: 700 }}>
        {match.home}
      </div>

      <div
        style={{
          textAlign: "center",
          color: "#fff",
          fontWeight: 900,
          fontSize: "16px",
        }}
      >
        {match.homeScore} - {match.awayScore}
      </div>

      <div style={{ color: "#e5e7eb", fontWeight: 700 }}>
        {match.away}
      </div>
    </div>
  );
}

function RoundCard({ round, index }) {
  const accent = teamColors[index % teamColors.length];

  return (
    <section
      style={{
        background: "linear-gradient(145deg, #10052c 0%, #08021b 100%)",
        border: "1px solid #28174a",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 8px 24px rgba(0,0,0,.22)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div>
          <div
            style={{
              color: accent,
              fontSize: "18px",
              fontWeight: 900,
            }}
          >
            {round.label}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
            {round.serieALabel}
          </div>
        </div>

        <span
          style={{
            padding: "5px 9px",
            borderRadius: "999px",
            background: "#170c35",
            color: "#a5b4fc",
            fontSize: "11px",
            fontWeight: 800,
          }}
        >
          5 SCONTRI
        </span>
      </div>

      <div style={{ display: "grid", gap: "7px" }}>
        {round.matches.map((match, matchIndex) => (
          <MatchCard
            key={`${round.label}-${matchIndex}-${match.home}-${match.away}`}
            match={match}
          />
        ))}
      </div>
    </section>
  );
}

export default function CalendarView() {
  const [selectedRound, setSelectedRound] = useState("TUTTE");

  const visibleRounds = useMemo(() => {
    if (selectedRound === "TUTTE") return CALENDARIO_CAMPIONATO;

    return CALENDARIO_CAMPIONATO.filter(
      (round) => round.label === selectedRound,
    );
  }, [selectedRound]);

  return (
    <div
      style={{
        width: "100%",
        marginTop: "20px",
        padding: "8px 0 40px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(145deg, #16083d 0%, #0c0528 100%)",
          border: "1px solid #35127a",
          borderRadius: "18px",
          padding: "18px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: "24px",
                fontWeight: 900,
              }}
            >
              📅 Calendario Campionato
            </h2>
            <div
              style={{
                color: "#94a3b8",
                marginTop: "5px",
                fontSize: "13px",
              }}
            >
              38 giornate · 10 squadre · 5 scontri diretti per giornata
            </div>
          </div>

          <select
            value={selectedRound}
            onChange={(event) => setSelectedRound(event.target.value)}
            style={{
              background: "#0b0620",
              color: "#fff",
              border: "1px solid #4c2a78",
              borderRadius: "9px",
              padding: "9px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <option value="TUTTE">Tutte le giornate</option>
            {CALENDARIO_CAMPIONATO.map((round) => (
              <option key={round.label} value={round.label}>
                {round.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "14px",
        }}
      >
        {visibleRounds.map((round) => (
          <RoundCard
            key={round.label}
            round={round}
            index={CALENDARIO_CAMPIONATO.indexOf(round)}
          />
        ))}
      </div>
    </div>
  );
}
