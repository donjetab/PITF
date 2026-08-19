export function BrandMark({ compact = false }) {
  return (
    <span className={`brand ${compact ? "brand--compact" : ""}`}>
      <img
        src="/assets/logo.png"
        alt="Prishtina International Theatre Festival"
      />
    </span>
  );
}
