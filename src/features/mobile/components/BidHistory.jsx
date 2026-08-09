export default function BidHistory({ bids }) {
  return (
    <div className="card" style={{ marginTop: "15px" }}>
      <h4 style={{ margin: "0 0 10px 0" }}>📜 Ultime Offerte</h4>
      {bids.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
          Nessuna offerta registrata.
        </p>
      ) : (
        bids.map((bid, index) => (
          <div
            key={index}
            style={{
              fontSize: "0.85rem",
              marginBottom: "4px",
              color: "#cbd5e1",
            }}
          >
            <strong>{bid.nome}</strong>: {bid.importo} FM{" "}
            <span style={{ color: "#64748b" }}>({bid.ora})</span>
          </div>
        ))
      )}
    </div>
  );
}
