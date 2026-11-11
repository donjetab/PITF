import { Fragment, useEffect, useRef } from "react";
import { contentService, useContentData } from "../services/contentService";
import { HeroSection } from "../components/HeroSection";
import { AboutPreview } from "../components/AboutPreview";
import { LatestEditionSection } from "../components/LatestEditionSection";
import { ProgramPreview } from "../components/ProgramPreview";
import { EditionsCarousel } from "../components/EditionsCarousel";
import { SponsorsSection } from "../components/SponsorsSection";
import { NewsletterSection } from "../components/NewsletterSection";
import { NewsCard } from "../components/NewsCard";
import { PublicLoading } from "../components/PublicLoading";
export function HomePage() {
  const { ready, revision } = useContentData();
  const pageRef = useRef(null);
  const content = contentService.getHomeContent(),
    latest = contentService.getLatestEdition();
  const program = contentService.getFeaturedProgram();
  const editions = contentService.getEditions();
  const sponsors = contentService.getSponsors();
  const featuredNews = contentService.getFeaturedNews();
  const sections = contentService.getHomepageSections().filter((section) => section.isVisible).sort((a, b) => a.order - b.order);
  const sectionConfig = Object.fromEntries(sections.map((section) => [section.key, section.configuration || {}]));

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    const groups = [
      ".about__image, .about__copy > *",
      ".latest__copy > *:not(.latest__smoke), .latest__art",
      ".program-section .section-heading > *",
      ".editions-section h2, .editions-section .carousel, .carousel-dots",
      ".sponsors > .kicker, .sponsors > h2, .sponsors > p, .sponsor-swiper",
      ".newsletter > div > *, .newsletter form",
    ];

    groups.forEach((selector) => {
      page.querySelectorAll(selector).forEach((element, index) => {
        element.classList.add("motion-reveal");
        element.style.setProperty("--motion-delay", `${Math.min(index, 5) * 70}ms`);
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8%" },
    );

    page.querySelectorAll(".motion-reveal").forEach((element) =>
      observer.observe(element),
    );

    const heroElements = page.querySelectorAll(".hero-content > *");
    heroElements.forEach((element, index) => {
      element.classList.add(
        element.matches("h1") ? "hero-title-animated" : "hero-motion",
      );
      element.style.setProperty("--motion-delay", `${180 + index * 110}ms`);
    });
    requestAnimationFrame(() =>
      heroElements.forEach((element) => element.classList.add("is-revealed")),
    );

    let frame;
    const updateParallax = () => {
      frame = undefined;
      const newsletter = page.querySelector(".newsletter");
      const smoke = page.querySelector(".latest__smoke");

      if (newsletter) {
        const rect = newsletter.getBoundingClientRect();
        const shift = Math.max(-28, Math.min(28, (window.innerHeight / 2 - rect.top) * 0.035));
        newsletter.style.setProperty("--cta-parallax", `${shift}px`);
      }

      if (smoke) {
        const rect = smoke.parentElement.getBoundingClientRect();
        const shift = Math.max(-18, Math.min(18, (window.innerHeight / 2 - rect.top) * 0.025));
        smoke.style.setProperty("--smoke-parallax", `${shift}px`);
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateParallax);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    updateParallax();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [revision]);

  if (!ready || !latest || !content.hero.titleParts) return <PublicLoading label="Opening night" />;

  const sectionViews = {
    hero: <HeroSection content={content.hero} />,
    about: <AboutPreview content={content.about} />,
    "featured-edition": <LatestEditionSection edition={latest} />,
    "featured-program": program.length > 0 ? <ProgramPreview items={program} content={sectionConfig["featured-program"]} editionYear={latest.year} /> : null,
    editions: editions.length > 0 ? <EditionsCarousel editions={editions} title={sectionConfig.editions?.title} /> : null,
    "featured-news": featuredNews.length > 0 ? <section className="edition-news section-shell"><div className="edition-section-heading"><h2>{sectionConfig["featured-news"]?.title || "News"}</h2></div><div className="edition-news__grid">{featuredNews.map((item) => <NewsCard item={item} key={item.id} />)}</div></section> : null,
    sponsors: sponsors.length > 0 ? <SponsorsSection sponsors={sponsors} content={sectionConfig.sponsors} /> : null,
    newsletter: <NewsletterSection content={content.newsletter} />,
  };

  return (
    <div className="home-page" ref={pageRef}>
      {sections.map((section) => sectionViews[section.key] ? <Fragment key={section.id}>{sectionViews[section.key]}</Fragment> : null)}
    </div>
  );
}
