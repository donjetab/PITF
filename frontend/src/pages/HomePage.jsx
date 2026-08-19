import { contentService } from "../services/contentService";
import { HeroSection } from "../components/HeroSection";
import { AboutPreview } from "../components/AboutPreview";
import { LatestEditionSection } from "../components/LatestEditionSection";
import { ProgramPreview } from "../components/ProgramPreview";
import { EditionsCarousel } from "../components/EditionsCarousel";
import { SponsorsSection } from "../components/SponsorsSection";
import { NewsletterSection } from "../components/NewsletterSection";
export function HomePage() {
  const content = contentService.getHomeContent(),
    latest = contentService.getLatestEdition();
  return (
    <>
      <HeroSection content={content.hero} />
      <AboutPreview content={content.about} />
      <LatestEditionSection edition={latest} />
      <ProgramPreview items={contentService.getProgram(latest.id)} />
      <EditionsCarousel editions={contentService.getEditions()} />
      <SponsorsSection sponsors={contentService.getSponsors()} />
      <NewsletterSection content={content.newsletter} />
    </>
  );
}
