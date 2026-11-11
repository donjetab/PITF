export function PublicLoading({ label = "Preparing the stage" }) {
  return (
    <section className="pitf-loading" role="status" aria-live="polite" aria-label={label}>
      <div className="pitf-loading__spotlights" aria-hidden="true"><i /><i /><i /></div>
      <div className="pitf-loading__stage">
        <div className="pitf-loading__orbit" aria-hidden="true"><i /><i /><i /></div>
        <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" />
        <p>Prishtina International Theater Festival</p>
        <h1>{label}<span aria-hidden="true">…</span></h1>
        <div className="pitf-loading__line" aria-hidden="true"><i /></div>
        <small>The curtain will rise in a moment</small>
      </div>
    </section>
  );
}
