export function SponsorsSection({ sponsors }) {
  return (
    <section className="sponsors section-shell">
      <p className="kicker">Sponsors</p>
      <h2>Together for the art</h2>
      <p>
        PITF is organized by passionate individuals and institutions committed
        to the development and promotion of contemporary theatre in Kosovo and
        beyond.
      </p>
      <div className="sponsor-list">
        {sponsors.map((sponsor) => (
          <div key={sponsor.id}>
            <img src={sponsor.logoSrc} alt={sponsor.name} />
          </div>
        ))}
      </div>
    </section>
  );
}
