import { useAdminAuctionContext } from "../context/useAuctionContexts";

export default function PlaceholderView() {
  const { vistaCorrente } = useAdminAuctionContext();

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
        Sezione "{vistaCorrente.toUpperCase()}" in fase di sviluppo...
      </h2>
    </div>
  );
}
