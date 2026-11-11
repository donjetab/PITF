// Shared records can be referenced by editions, activities, news and galleries.
export const media = [
  {
    id: "media-hero",
    type: "image",
    src: `${import.meta.env.BASE_URL}assets/hero-background.png`,
    alt: "PITF opening ceremony at AAB Theatre",
    caption: null,
    credit: null,
    editionId: null,
  },
  {
    id: "media-about",
    type: "image",
    src: `${import.meta.env.BASE_URL}assets/about-pic.jpg`,
    alt: "A dramatic PITF stage performance",
    caption: null,
    credit: null,
    editionId: null,
  },
  {
    id: "media-edition-10",
    type: "image",
    src: `${import.meta.env.BASE_URL}assets/theatre-image.png`,
    alt: "An empty theatre stage prepared for PITF",
    caption: null,
    credit: null,
    editionId: 10,
  },
];
