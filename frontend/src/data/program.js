// Only details visible in the supplied reference are recorded; unknowns stay null.
export const programItems = [
  {
    id: "program-10-1",
    editionId: 10,
    title: "The Kanun of the Farm",
    country: "Kosovo",
    company: "Urban Theatre",
    director: "Xheraldina Krasniqi",
    startsAt: "2026-05-18T20:00:00",
    venue: "National Theatre of Kosovo",
    mediaIds: ["program-10-1-image"],
    imageSrc:
      "/assets/editions/2026/1/1. shfaqja/702611503_1958866245055773_7942505020317894340_n.jpg",
  },
  {
    id: "program-10-2",
    editionId: 10,
    title: "Gideon’s Knot",
    country: "Bosnia and Herzegovina",
    company: "JU Pozorište mladih Sarajevo",
    director: "Selma Alispahić",
    startsAt: "2026-05-19T20:00:00",
    venue: "National Theatre of Kosovo",
    mediaIds: ["program-10-2-image"],
    imageSrc:
      "/assets/editions/2026/2/1. shfaqja/702671234_1959705558305175_3508399858379615757_n.jpg",
  },
  {
    id: "program-10-3",
    editionId: 10,
    title: "Chicken",
    country: "North Macedonia",
    company: "Vortex Theater / Skopje Comedy Theater",
    director: "Teodora Siljanoska",
    startsAt: "2026-05-20T20:00:00",
    venue: "National Theatre of Kosovo",
    mediaIds: ["program-10-3-image"],
    imageSrc:
      "/assets/editions/2026/3/1. shfaqja/702571023_1960575558218175_9037491117308950254_n.jpg",
  },
  {
    id: "program-10-4",
    editionId: 10,
    title: "The Fortress",
    country: "Italy",
    company: "AteliercuncheON researchtheatre",
    director: "Andrea Benaglio",
    startsAt: "2026-05-21T20:00:00",
    venue: "National Theatre of Kosovo",
    mediaIds: ["program-10-4-image"],
    imageSrc:
      "/assets/editions/2026/4/1. shfaqja/703064755_1961414774800920_5383734200807447820_n.jpg",
  },
];
export const festivalDays = programItems.map((item, index) => ({
  id: `edition-10-day-${index + 1}`,
  editionId: 10,
  dayNumber: index + 1,
  date: item.startsAt.slice(0, 10),
  title: `Day ${index + 1}`,
  description: null,
  activities: [
    {
      id: `activity-10-${index + 1}-1`,
      type: "performance",
      order: 1,
      programItemId: item.id,
      title: item.title,
      body: null,
      mediaIds: [],
      videoIds: [],
    },
  ],
}));
