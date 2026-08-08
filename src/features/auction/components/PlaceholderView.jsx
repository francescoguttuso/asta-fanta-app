export default function PlaceholderView({ view }) {
  return (
    <div
      className="card"
      style={{
        width: "100%",
        marginTop: "20px",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <h2 style={{ color: "#94a3b8" }}>
        Sezione "{view.toUpperCase()}" in fase di sviluppo...
      </h2>
    </div>
  );
}
