const knownYears = {
  1: 2017,
  2: 2018,
  3: 2019,
  4: 2020,
  5: 2021,
  6: 2022,
  7: 2023,
  8: 2024,
  9: 2025,
  10: 2026,
};
export const editions = Array.from({ length: 10 }, (_, index) => {
  const number = index + 1,
    year = knownYears[number];
  return {
    id: number,
    slug: `edition-${number}`,
    number,
    title: `${number}${number === 1 ? "st" : number === 2 ? "nd" : number === 3 ? "rd" : "th"} Edition`,
    year,
    dates: number === 10 ? { start: "2026-05-18", end: "2026-05-23" } : null,
    description:
      number === 10 ? "A milestone edition. A decade of theatre." : null,
    logoMediaId: `edition-${number}-logo`,
    logoSrc:
      number === 1
        ? "/assets/editions/2017/logo - 2017.jpg"
        : `/assets/editions/${year}/${number}.jpg`,
    bannerSrc:
      number === 1
        ? "/assets/editions/2017/banner - 2017.jpg"
        : `/assets/editions/${year}/${number}-banner.jpg`,
    heroMediaId: number === 10 ? "media-edition-10" : null,
    dayIds:
      number === 10
        ? [
            "edition-10-day-1",
            "edition-10-day-2",
            "edition-10-day-3",
            "edition-10-day-4",
          ]
        : [],
    programItemIds:
      number === 10
        ? ["program-10-1", "program-10-2", "program-10-3", "program-10-4"]
        : [],
  };
});
