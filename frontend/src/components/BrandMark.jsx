export function BrandMark({ compact = false }) {
  return (
    <span className={`brand ${compact ? "brand--compact" : ""}`}>
      <img
        src={`${import.meta.env.BASE_URL}assets/logo.png`}
        alt="Prishtina International Theatre Festival"
      />
    </span>
  );
}
