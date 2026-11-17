// Vitrine de l'accueil. Pour remplacer un emplacement par une vraie vidéo :
// déposer le fichier dans public/showcase/ puis renseigner `video`
// (et éventuellement `poster`, une image fixe affichée avant la lecture).
// Tant que `video` est vide, la carte affiche un emplacement « Vidéo à venir ».
export type ShowcaseItem = {
  id: string;
  title: string;
  tag: "Cinéma" | "Nature" | "Ville" | "Portrait";
  format: "16:9" | "9:16";
  idea: string;
  video?: string;
  poster?: string;
};

export const showcase: ShowcaseItem[] = [
  {
    id: "s1",
    title: "Lumière d’aube sur la vallée",
    tag: "Nature",
    format: "16:9",
    idea: "dune",
  },
  {
    id: "s2",
    title: "Néons sous la pluie",
    tag: "Ville",
    format: "9:16",
    idea: "orb",
  },
  {
    id: "s3",
    title: "Plan-séquence au crépuscule",
    tag: "Cinéma",
    format: "16:9",
    idea: "orb",
  },
  {
    id: "s4",
    title: "Portrait en mouvement",
    tag: "Portrait",
    format: "9:16",
    idea: "bloom",
  },
  {
    id: "s5",
    title: "Vagues au ralenti",
    tag: "Nature",
    format: "16:9",
    idea: "dune",
  },
  {
    id: "s6",
    title: "Course de nuit en ville",
    tag: "Ville",
    format: "9:16",
    idea: "orb",
  },
  {
    id: "s7",
    title: "Ombres et silhouettes",
    tag: "Cinéma",
    format: "16:9",
    idea: "bloom",
  },
];
