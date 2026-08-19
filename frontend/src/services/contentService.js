import { editions } from "../data/editions";
import { festivalDays, programItems } from "../data/program";
import { media } from "../data/media";
import { sponsors } from "../data/sponsors";
import { homeContent, site } from "../data/site";
const clone = (value) => structuredClone(value);
export const contentService = {
  getSite: () => clone(site),
  getHomeContent: () => clone(homeContent),
  getEditions: () => clone(editions),
  getLatestEdition: () => clone(editions.at(-1)),
  getProgram: (editionId) =>
    clone(programItems.filter((item) => item.editionId === editionId)),
  getFestivalDays: (editionId) =>
    clone(festivalDays.filter((day) => day.editionId === editionId)),
  getMedia: () => clone(media),
  getSponsors: () => clone(sponsors),
};
