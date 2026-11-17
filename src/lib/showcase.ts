// Vitrine de l'accueil. Pour remplacer un emplacement par une vraie vidéo :
// déposer le fichier dans public/showcase/ puis renseigner `video`
// (et éventuellement `poster`, une image fixe affichée avant la lecture).
// Tant que `video` est vide, la carte affiche un emplacement.
export const genres = [
  "Réaliste",
  "Showcase produit",
  "AI UGC",
  "Animation",
  "Cinématographique",
] as const;
export type Genre = (typeof genres)[number];

export type ShowcaseItem = {
  id: string;
  title: string;
  genre: Genre;
  format: "16:9" | "9:16";
  video?: string;
  poster?: string;
};

const CDN =
  "https://pchdggpprfnyzmcnpigy.supabase.co/storage/v1/object/public/showcase";
const clip = (n: number) => ({
  video: `${CDN}/v${n}.mp4`,
  poster: `${CDN}/v${n}.jpg`,
});

export const showcase: ShowcaseItem[] = [
  {
    id: "s7",
    title: "Sérum en avis face caméra",
    genre: "AI UGC",
    format: "9:16",
    ...clip(7),
  },
  {
    id: "s1",
    title: "Road trip en coccinelle",
    genre: "Animation",
    format: "16:9",
    ...clip(1),
  },
  {
    id: "s4",
    title: "Matin dans le village",
    genre: "Cinématographique",
    format: "16:9",
    ...clip(4),
  },
  {
    id: "s9",
    title: "Citronnade minute",
    genre: "Showcase produit",
    format: "9:16",
    ...clip(9),
  },
  {
    id: "s2",
    title: "Podcast animé",
    genre: "Animation",
    format: "9:16",
    ...clip(2),
  },
  {
    id: "s6",
    title: "Vlog au coucher du soleil",
    genre: "Réaliste",
    format: "16:9",
    ...clip(6),
  },
  {
    id: "s8",
    title: "Écouteurs au quotidien",
    genre: "AI UGC",
    format: "9:16",
    ...clip(8),
  },
  {
    id: "s3",
    title: "La crème et le chat",
    genre: "Animation",
    format: "9:16",
    ...clip(3),
  },
  {
    id: "s5",
    title: "Ruelle en été",
    genre: "Réaliste",
    format: "16:9",
    ...clip(5),
  },
];

// Prompts de départ proposés dans le studio, par genre.
export const starters: Record<Genre, string> = {
  Réaliste:
    "Une femme verse du café dans une tasse en céramique, lumière naturelle du matin, gros plan, mouvement de caméra lent.",
  "Showcase produit":
    "Une bouteille de parfum en verre tourne lentement sur un socle blanc, reflets nets, fond studio blanc, éclairage premium.",
  "AI UGC":
    "Une jeune femme filme un selfie dans sa cuisine et présente un produit avec enthousiasme, style smartphone, lumière naturelle.",
  Animation:
    "Un petit robot jaune traverse une ville en papier découpé, style animation 3D douce, couleurs vives.",
  Cinématographique:
    "Un coureur traverse une rue mouillée la nuit, néons, ralenti, travelling latéral, grain de film, format cinéma.",
};
