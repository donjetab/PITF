import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NewsletterSection } from "../components/NewsletterSection";
import { contentService, useContentData } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";

const statistics = [
  {
    icon: `${import.meta.env.BASE_URL}assets/icons/edition-icon.png`,
    value: 10,
    label: "Editions",
    text: "A decade of theatre and cultural exchange.",
  },
  {
    icon: `${import.meta.env.BASE_URL}assets/icons/countries.png`,
    value: 20,
    suffix: "+",
    label: "Countries",
    text: "Artists and companies from around the world.",
  },
  {
    icon: `${import.meta.env.BASE_URL}assets/icons/performance-icon.png`,
    value: 50,
    suffix: "+",
    label: "Performances",
    text: "Across main stage, off programs and special events.",
  },
  {
    icon: `${import.meta.env.BASE_URL}assets/icons/audience-icon.png`,
    value: 5000,
    suffix: "+",
    label: "Audience members",
    text: "Uniting audiences through the power of live performance.",
  },
];

const team = [
  { name: "Ilir Tafa", role: "Founder of PITF", image: `${import.meta.env.BASE_URL}assets/staff/Ilir_Tafa_2.png` },
  { name: "Zijad Mehic", role: "Festival Director", image: `${import.meta.env.BASE_URL}assets/staff/Zijad Mehic.jpg` },
  { name: "Ilir Bytyqi", role: "Art Image Director", image: `${import.meta.env.BASE_URL}assets/staff/Ilir_Bytyqi.jpg` },
  { name: "Doruntina Alshiqi", role: "Artistic Director of PITF", image: `${import.meta.env.BASE_URL}assets/staff/Doruntina_Alshiqi.jpg` },
  { name: "Amir Petrovci", role: "AAB Theatre “Faruk Begolli” Organizer", image: `${import.meta.env.BASE_URL}assets/staff/Amir_Petrovci.jpg` },
  { name: "Erona Salihu", role: "PR & Communication Director", image: `${import.meta.env.BASE_URL}assets/staff/Erona_Salihu.jpg` },
];

function identityKey(value) {
  return String(value || "").toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "");
}

function mediaImage(media) {
  return media?.largeUrl || media?.mediumUrl || media?.thumbnailUrl || media?.originalUrl || null;
}

function SectionTitle({ children }) {
  return (
    <div className="about-page__section-title about-reveal" data-about-reveal>
      <span />
      <h2>{children}</h2>
      <span />
    </div>
  );
}

function EditorialHeading({ value }) {
  const sourceLines = value?.split(/\s+—\s+/) || [];
  const lines = sourceLines.length > 1 ? sourceLines : [sourceLines[0]?.split(" ").slice(0, -2).join(" "), sourceLines[0]?.split(" ").slice(-2).join(" ")].filter(Boolean);
  return lines.map((line, index) => {
    const words = line.split(" ");
    const last = words.pop();
    return <span key={line}>{words.join(" ")} {last && <em>{last}</em>}{index < lines.length - 1 && <br />}</span>;
  });
}

function AnimatedStat({ value, suffix = "" }) {
  const numberRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const element = numberRef.current;
    if (!element) return undefined;
    let animationFrame;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setDisplayValue(value);
          observer.disconnect();
          return;
        }

        const duration = 1500;
        const start = performance.now();
        const update = (time) => {
          const progress = Math.min((time - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.round(value * eased));
          if (progress < 1) animationFrame = requestAnimationFrame(update);
        };

        animationFrame = requestAnimationFrame(update);
        observer.disconnect();
      },
      { threshold: 0.45 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value]);

  return (
    <strong ref={numberRef}>
      <span className="about-page__stat-value">{displayValue}</span>
      {suffix && <span className="about-page__stat-suffix">{suffix}</span>}
    </strong>
  );
}

export function AboutPage() {
  const { ready } = useContentData();
  const about = contentService.getAbout();
  const newsletter = about.newsletter;
  const intro = about.sections.intro?.content || {};
  const statisticsContent = about.sections.statistics?.content || {};
  const mission = about.sections.mission?.content || {};
  const teamContent = about.sections.team?.content || {};
  const contentMedia = about.sections.team?.mediaItems || [];
  const apiStatistics = statisticsContent.items?.map((item, index) => ({ ...item, icon: statistics[index]?.icon })) || statistics;
  const assignedTeamMedia = contentMedia.filter((item) => item.role === "team");
  const usedTeamMedia = new Set();
  const apiTeam = teamContent.people?.map((person, index) => {
    const personKey = identityKey(person.name);
    const namedMatch = contentMedia.find((item) => {
      const media = item.media || {};
      return !usedTeamMedia.has(media.id) && [media.originalFilename, media.alt, media.caption].some((value) => {
        const mediaKey = identityKey(value);
        return personKey && mediaKey && (mediaKey.includes(personKey) || personKey.includes(mediaKey));
      });
    });
    const matched = namedMatch || assignedTeamMedia.find((item) => !usedTeamMedia.has(item.media?.id));
    if (matched?.media?.id) usedTeamMedia.add(matched.media.id);
    return { ...person, image: mediaImage(matched?.media) || team[index]?.image };
  }) || team;
  const apiGallery = contentMedia
    .filter((item) => item.role === "gallery" && !usedTeamMedia.has(item.media?.id))
    .map((item) => mediaImage(item.media))
    .filter(Boolean);
  const pageRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7%" },
    );

    page.querySelectorAll("[data-about-reveal]").forEach((element) =>
      observer.observe(element),
    );

    return () => observer.disconnect();
  }, [ready]);

  if (!ready) return <PublicLoading label="Setting the scene" />;

  return (
    <div className="about-page" ref={pageRef}>
      <section className="about-page__intro section-shell">
        <div className="about-page__intro-copy">
          <p className="about-page__eyebrow about-reveal" data-about-reveal>{intro.eyebrow} <span /></p>
          <h1 className="about-reveal" data-about-reveal style={{ "--about-delay": "90ms" }}>
            <EditorialHeading value={intro.title} />
          </h1>
          <p className="about-reveal" data-about-reveal style={{ "--about-delay": "180ms" }}>
            {intro.paragraphs?.[0]}
          </p>
          <p className="about-reveal" data-about-reveal style={{ "--about-delay": "250ms" }}>
            {intro.paragraphs?.[1]}
          </p>
        </div>
        <div className="about-page__stage about-reveal about-reveal--right" data-about-reveal aria-hidden="true">
          <img src={about.sections.intro?.media?.largeUrl || `${import.meta.env.BASE_URL}assets/theatre-image.png`} alt="" />
        </div>
      </section>

      <section className="about-page__numbers section-shell">
        <SectionTitle>PITF in numbers</SectionTitle>
        <div className="about-page__stats">
          {apiStatistics.map((item, index) => (
            <article
              className="about-reveal"
              data-about-reveal
              key={item.label}
              style={{ "--about-delay": `${index * 85}ms` }}
            >
              <img src={item.icon} alt="" aria-hidden="true" />
              <AnimatedStat value={item.value} suffix={item.suffix} />
              <h3>{item.label}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page__mission section-shell">
        <div className="about-page__mission-image about-reveal about-reveal--left" data-about-reveal>
          <img src={about.sections.mission?.media?.largeUrl || `${import.meta.env.BASE_URL}assets/about-pic.jpg`} alt="A theatre performance backstage" />
        </div>
        <div className="about-page__mission-copy">
          <p className="about-page__eyebrow about-reveal" data-about-reveal>{mission.eyebrow} <span /></p>
          <h2 className="about-reveal" data-about-reveal style={{ "--about-delay": "90ms" }}>
            <EditorialHeading value={mission.title} />
          </h2>
          <p className="about-reveal" data-about-reveal style={{ "--about-delay": "170ms" }}>
            {mission.text}
          </p>
        </div>
      </section>

      <section className="about-page__team section-shell">
        <SectionTitle>{teamContent.title}</SectionTitle>
        <p className="about-page__team-intro about-reveal" data-about-reveal>
          {teamContent.intro}
        </p>
        <div className="about-page__team-grid">
          {apiTeam.map((person, index) => (
            <article
              className="about-reveal"
              data-about-reveal
              key={person.name}
              style={{ "--about-delay": `${Math.min(index, 3) * 75}ms` }}
            >
              <img src={person.image} alt={person.name} />
              <div>
                <h3>{person.name}</h3>
                <p>{person.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page__gallery">
        <h2 className="about-reveal" data-about-reveal>Gallery</h2>
        <div className="about-page__gallery-rows about-reveal" data-about-reveal style={{ "--about-delay": "100ms" }}>
          {[apiGallery.slice(0, 3), apiGallery.slice(3)].filter((row) => row.length).map((row, rowIndex) => (
            <div
              className={`about-page__gallery-row about-page__gallery-row--${rowIndex === 0 ? "forward" : "reverse"}`}
              style={{ "--about-gallery-duration": `${Math.max(row.length * 12.67, 38)}s` }}
              key={row[0]}
            >
              <div className="about-page__gallery-track">
                {[false, true].map((copy) => (
                  <div
                    className="about-page__gallery-set"
                    aria-hidden={copy || undefined}
                    key={copy ? "copy" : "original"}
                  >
                    {row.map((image, imageIndex) => (
                      <img
                        key={`${image}-${copy ? "copy" : "original"}`}
                        src={image}
                        alt={copy ? "" : `PITF gallery moment ${rowIndex * 3 + imageIndex + 1}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Link className="outline-button about-reveal" data-about-reveal style={{ "--about-delay": "160ms" }} to="/editions">
          See more <span>→</span>
        </Link>
      </section>

      <div className="about-page__newsletter-reveal about-reveal" data-about-reveal>
        <NewsletterSection content={newsletter} />
      </div>
    </div>
  );
}
