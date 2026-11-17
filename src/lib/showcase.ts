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

export const showcase: ShowcaseItem[] = [
  {
    id: "s1",
    title: "Sneaker en rotation",
    genre: "Showcase produit",
    format: "9:16",
  },
  {
    id: "s2",
    title: "Avis client face caméra",
    genre: "AI UGC",
    format: "9:16",
  },
  {
    id: "s3",
    title: "Course sous la pluie",
    genre: "Cinématographique",
    format: "16:9",
  },
  { id: "s4", title: "Café du matin", genre: "Réaliste", format: "9:16" },
  { id: "s5", title: "Mascotte en action", genre: "Animation", format: "16:9" },
  {
    id: "s6",
    title: "Parfum en lévitation",
    genre: "Showcase produit",
    format: "9:16",
  },
  { id: "s7", title: "Unboxing spontané", genre: "AI UGC", format: "9:16" },
  {
    id: "s8",
    title: "Poursuite de nuit",
    genre: "Cinématographique",
    format: "16:9",
  },
  {
    id: "s9",
    title: "Marché en plein soleil",
    genre: "Réaliste",
    format: "16:9",
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
