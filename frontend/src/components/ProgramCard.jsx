export function ProgramCard({ item }) {
  const date = new Date(item.startsAt);
  return (
    <article className="program-card">
      <div className="program-card__image">
        <img src={item.imageSrc} alt={`${item.title} performance`} />
      </div>
      <div className="program-card__body">
        <p className="card-label">{item.country}</p>
        <h3>{item.title}</h3>
        <p>
          {item.company}
          {item.director && (
            <>
              <br />
              Director: {item.director}
            </>
          )}
        </p>
        <div className="program-card__meta">
          <span>
            <b>
              {date
                .toLocaleDateString("en-GB", { day: "numeric", month: "long" })
                .toUpperCase()}{" "}
              |{" "}
              {date.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
            <br />
            {item.venue}
          </span>
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </article>
  );
}
