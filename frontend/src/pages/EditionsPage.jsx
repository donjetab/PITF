import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { NewsletterSection } from "../components/NewsletterSection";
import { contentService, useContentData } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";

const fallbackDescription =
  "Explore the performances, artists and moments that shaped this PITF edition.";

export function EditionsPage() {
  const { ready, revision } = useContentData();
  const timelineRef = useRef(null);
  const editions = contentService.getEditions().sort((first, second) => second.number - first.number);
  const newsletter = contentService.getHomeContent().newsletter;
  const heroSection = contentService.getPageContent("editions", "hero");
  const hero = heroSection?.content || {};

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return undefined;

    const elements = [...timeline.querySelectorAll("[data-edition-reveal]")];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      elements.forEach((element) => element.classList.add("is-visible"));
      timeline.style.setProperty("--timeline-progress", "100%");
      return undefined;
    }

    let animationFrame = 0;
    const updateTimeline = () => {
      const bounds = timeline.getBoundingClientRect();
      const lineStart = 32;
      const lineEnd = Math.max(lineStart, timeline.offsetHeight - 128);
      const viewportGuide = window.innerHeight * 0.58;
      const progress = Math.min(
        lineEnd,
        Math.max(lineStart, viewportGuide - bounds.top),
      );

      timeline.style.setProperty("--timeline-progress", `${progress}px`);
      elements.forEach((element) => {
        if (element.classList.contains("is-visible")) return;
        const revealPoint = element.offsetTop + element.offsetHeight * 0.16;
        if (progress >= revealPoint) element.classList.add("is-visible");
      });
      animationFrame = 0;
    };

    const requestUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateTimeline);
    };

    updateTimeline();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [revision]);

  if (!ready) return <PublicLoading label="Unfolding the archive" />;

  return (
    <div className="editions-page">
      <header className="editions-hero">
        <div className="editions-hero__image" aria-hidden="true" style={heroSection?.media?.largeUrl ? { backgroundImage: `url("${heroSection.media.largeUrl}")` } : undefined} />
        <div className="editions-hero__content">
          <p>{hero.kicker}</p>
          <h1>{hero.title}</h1>
          <span>{hero.text}</span>
        </div>
      </header>

      <main
        className="editions-timeline"
        aria-label="PITF editions"
        ref={timelineRef}
      >
        <span className="editions-timeline__marker" aria-hidden="true" />
        {editions.map((edition, index) => (
          <article
            className={`edition-entry ${index % 2 ? "edition-entry--reverse" : ""} ${index === 0 ? "is-visible" : ""}`}
            id={`edition-${edition.number}`}
            key={edition.id}
            data-edition-reveal
            style={{ "--edition-delay": `${(index % 3) * 90}ms` }}
          >
            <div className="edition-entry__content">
              <div className="edition-entry__identity">
                <span className="edition-entry__number">
                  {String(edition.number).padStart(2, "0")}
                </span>
                <img src={edition.logoSrc} alt="" />
              </div>

              <div className="edition-entry__copy">
                <div className="edition-entry__year">
                  <span>{edition.year}</span>
                  <i />
                </div>
                <h2>{edition.title}</h2>
                <p>{edition.headerDescription || edition.description || fallbackDescription}</p>
                <Link className="outline-button" to={`/editions/${edition.slug}`}>
                  Explore edition <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            <Link
              className="edition-entry__visual"
              to={`/editions/${edition.slug}`}
              aria-label={`Open ${edition.title}, ${edition.year}`}
            >
              <img src={edition.bannerSrc} alt={`${edition.title}, ${edition.year}`} />
            </Link>
          </article>
        ))}
      </main>

      <div className="editions-page__newsletter">
        <NewsletterSection content={newsletter} />
      </div>
    </div>
  );
}
