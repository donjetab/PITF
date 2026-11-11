import { useRef, useState } from "react";
import { Link } from "react-router-dom";
export function EditionsCarousel({ editions, title = "All PITF Editions" }) {
  const orderedEditions = [...editions].sort((first, second) => second.number - first.number || second.year - first.year);
  const [active, setActive] = useState(0);
  const lastMoveAt = useRef(Number.NEGATIVE_INFINITY);
  const move = (direction) => {
    const now = performance.now();
    if (now - lastMoveAt.current < 480) return;
    lastMoveAt.current = now;
    setActive(
      (index) => (index + direction + orderedEditions.length) % orderedEditions.length,
    );
  };
  const offsetFor = (index) => {
    let d = index - active;
    if (d > orderedEditions.length / 2) d -= orderedEditions.length;
    if (d < -orderedEditions.length / 2) d += orderedEditions.length;
    return d;
  };
  return (
    <section className="editions-section">
      <div
        className="edition-backdrop"
        key={orderedEditions[active].id}
        style={{
          backgroundImage: `url("${orderedEditions[active].detailHeaderSrc || orderedEditions[active].bannerSrc}")`,
        }}
      />
      <div className="section-shell">
        <h2>{title}</h2>
        <div
          className="carousel"
          aria-roledescription="carousel"
          aria-label="PITF editions"
        >
          <button onClick={() => move(-1)} aria-label="Previous edition">
            ‹
          </button>
          <div className="carousel__stage">
            {orderedEditions.map((edition, index) => {
              const offset = offsetFor(index);
              return (
                Math.abs(offset) <= 2 && (
                  <Link
                    key={edition.id}
                    className={`edition-card offset-${offset}`}
                    to={`/editions/${edition.slug}`}
                    aria-current={index === active ? "true" : undefined}
                  >
                    <img
                      className="edition-emblem"
                      src={edition.logoSrc}
                      alt=""
                    />
                    <b>{edition.title}</b>
                    {edition.year && <i>{edition.year}</i>}
                  </Link>
                )
              );
            })}
          </div>
          <button onClick={() => move(1)} aria-label="Next edition">
            ›
          </button>
        </div>
        <div className="carousel-dots" aria-hidden="true">
          {orderedEditions.map((item, index) => (
            <span key={item.id} className={index === active ? "active" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}
