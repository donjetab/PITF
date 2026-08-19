import { useState } from "react";
export function EditionsCarousel({ editions }) {
  const [active, setActive] = useState(editions.length - 1);
  const move = (direction) =>
    setActive(
      (index) => (index + direction + editions.length) % editions.length,
    );
  const offsetFor = (index) => {
    let d = index - active;
    if (d > editions.length / 2) d -= editions.length;
    if (d < -editions.length / 2) d += editions.length;
    return d;
  };
  return (
    <section className="editions-section">
      <div
        className="edition-backdrop"
        key={editions[active].id}
        style={{
          backgroundImage: `linear-gradient(#020c1acc,#020c1af5),url("${editions[active].bannerSrc}")`,
        }}
      />
      <div className="section-shell">
        <h2>All PITF Editions</h2>
        <div
          className="carousel"
          aria-roledescription="carousel"
          aria-label="PITF editions"
        >
          <button onClick={() => move(-1)} aria-label="Previous edition">
            ‹
          </button>
          <div className="carousel__stage">
            {editions.map((edition, index) => {
              const offset = offsetFor(index);
              return (
                Math.abs(offset) <= 2 && (
                  <button
                    key={edition.id}
                    className={`edition-card offset-${offset}`}
                    onClick={() => setActive(index)}
                    aria-current={index === active ? "true" : undefined}
                  >
                    <img
                      className="edition-emblem"
                      src={edition.logoSrc}
                      alt=""
                    />
                    <b>{edition.title}</b>
                    {edition.year && <i>{edition.year}</i>}
                  </button>
                )
              );
            })}
          </div>
          <button onClick={() => move(1)} aria-label="Next edition">
            ›
          </button>
        </div>
        <div className="carousel-dots" aria-hidden="true">
          {editions.map((item, index) => (
            <span key={item.id} className={index === active ? "active" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}
