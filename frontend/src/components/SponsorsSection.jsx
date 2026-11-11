import { useEffect, useRef } from "react";

export function SponsorsSection({ sponsors, content = {} }) {
  const viewportRef = useRef(null);
  const beltRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const belt = beltRef.current;
    if (!viewport || !belt) return undefined;

    const configure = () => {
      animationRef.current?.cancel();

      const mobile = viewport.clientWidth <= 640;
      const visibleCount = mobile ? 2 : viewport.clientWidth <= 980 ? 2 : 4;
      const overflowing = sponsors.length > visibleCount;
      const gap = mobile ? 10 : viewport.clientWidth <= 980 ? 16 : 48;
      const itemWidth =
        (viewport.clientWidth - gap * (visibleCount - 1)) / visibleCount;

      viewport.style.setProperty("--sponsor-gap", `${gap}px`);
      viewport.style.setProperty("--sponsor-item-width", `${itemWidth}px`);
      if (!overflowing) return;

      const firstSet = belt.firstElementChild;
      const distance = firstSet?.getBoundingClientRect().width || 0;
      if (!distance) return;

      animationRef.current = belt.animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(-${distance}px)` },
        ],
        {
          duration: (distance / (mobile ? 68 : 35)) * 1000,
          iterations: Infinity,
          easing: "linear",
        },
      );
    };

    const observer = new ResizeObserver(configure);
    observer.observe(viewport);
    requestAnimationFrame(configure);

    return () => {
      observer.disconnect();
      animationRef.current?.cancel();
    };
  }, [sponsors.length]);

  const logoSet = (copy = false) => (
    <div className="sponsor-list__set" aria-hidden={copy || undefined}>
      {sponsors.map((sponsor) => (
        <div key={`${sponsor.id}${copy ? "-copy" : ""}`}>
          {sponsor.website ? <a href={sponsor.website} target="_blank" rel="noreferrer" aria-label={`Visit ${sponsor.name}`}>
            <img src={sponsor.logoSrc} alt={copy ? "" : sponsor.name} />
          </a> :
          <img
            src={sponsor.logoSrc}
            alt={copy ? "" : sponsor.name}
          />}
        </div>
      ))}
    </div>
  );

  return (
    <section className="sponsors section-shell">
      <p className="kicker">{content.kicker || "Sponsors"}</p>
      <h2>{content.title || "Together for the art"}</h2>
      <p>{content.text || "PITF is organized by passionate individuals and institutions committed to the development and promotion of contemporary theatre in Kosovo and beyond."}</p>
      <div className="sponsor-swiper">
        <div className="sponsor-list" ref={viewportRef}>
          <div className="sponsor-list__belt" ref={beltRef}>
            {logoSet()}
            {logoSet(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
