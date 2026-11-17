import type { Genre } from "./showcase";

// Préréglages guidés : quelques champs simples produisent un prompt complet.
export type PresetField = {
  key: string;
  label: string;
  placeholder: string;
  options?: string[];
};
export type Preset = {
  id: string;
  genre: Genre;
  name: string;
  pitch: string;
  ratio: "16:9" | "9:16";
  fields: PresetField[];
  build: (v: Record<string, string>) => string;
};

const or = (v: string | undefined, d: string) => (v && v.trim()) || d;

export const presets: Preset[] = [
  {
    id: "packshot",
    genre: "Showcase produit",
    name: "Packshot studio",
    pitch: "Votre produit sous son meilleur angle.",
    ratio: "9:16",
    fields: [
      {
        key: "product",
        label: "Produit",
        placeholder: "Une bouteille de parfum ambrée",
      },
      {
        key: "set",
        label: "Décor",
        placeholder: "Socle blanc",
        options: [
          "Fond studio blanc",
          "Marbre noir",
          "Sable et soleil",
          "Eau et reflets",
        ],
      },
      {
        key: "move",
        label: "Mouvement",
        placeholder: "Rotation lente",
        options: [
          "Rotation lente à 360°",
          "Zoom avant macro",
          "Produit en lévitation",
          "Éclaboussure au ralenti",
        ],
      },
    ],
    build: (v) =>
      `${or(v.product, "Un produit")} sur ${or(v.set, "fond studio blanc").toLowerCase()}, ${or(v.move, "rotation lente à 360°").toLowerCase()}, éclairage studio premium, reflets nets, mise au point parfaite, rendu publicitaire haut de gamme.`,
  },
  {
    id: "ugc-review",
    genre: "AI UGC",
    name: "Avis face caméra",
    pitch: "Le témoignage qui convertit.",
    ratio: "9:16",
    fields: [
      {
        key: "who",
        label: "Personne",
        placeholder: "Une femme de 30 ans souriante",
        options: [
          "Une jeune femme souriante",
          "Un homme trentenaire décontracté",
          "Une étudiante enthousiaste",
          "Un père de famille",
        ],
      },
      {
        key: "product",
        label: "Produit montré",
        placeholder: "Un sérum pour le visage",
      },
      {
        key: "place",
        label: "Lieu",
        placeholder: "Sa salle de bain",
        options: ["Sa cuisine", "Sa salle de bain", "Sa voiture", "Son salon"],
      },
    ],
    build: (v) =>
      `${or(v.who, "Une jeune femme souriante")} se filme en selfie dans ${or(v.place, "sa cuisine").toLowerCase()} et présente ${or(v.product, "un produit").toLowerCase()} face caméra avec enthousiasme, style vidéo smartphone authentique, lumière naturelle, légers mouvements de main.`,
  },
  {
    id: "ugc-unboxing",
    genre: "AI UGC",
    name: "Unboxing",
    pitch: "La découverte en direct.",
    ratio: "9:16",
    fields: [
      {
        key: "product",
        label: "Produit",
        placeholder: "Une paire de baskets blanches",
      },
      {
        key: "mood",
        label: "Réaction",
        placeholder: "Surprise",
        options: ["Surprise et ravie", "Impressionnée", "Calme et satisfaite"],
      },
    ],
    build: (v) =>
      `Des mains ouvrent un colis sur une table et découvrent ${or(v.product, "un produit").toLowerCase()}, réaction ${or(v.mood, "surprise et ravie").toLowerCase()}, plan rapproché filmé au smartphone, lumière naturelle, style UGC spontané.`,
  },
  {
    id: "cine-scene",
    genre: "Cinématographique",
    name: "Scène de film",
    pitch: "Un plan digne du cinéma.",
    ratio: "16:9",
    fields: [
      {
        key: "scene",
        label: "Scène",
        placeholder: "Un coureur dans une rue mouillée",
      },
      {
        key: "camera",
        label: "Caméra",
        placeholder: "Travelling",
        options: [
          "Travelling latéral",
          "Drone qui s’élève",
          "Caméra à l’épaule",
          "Lent zoom avant",
        ],
      },
      {
        key: "light",
        label: "Lumière",
        placeholder: "Néons",
        options: [
          "Néons de nuit",
          "Heure dorée",
          "Brume bleutée",
          "Clair-obscur",
        ],
      },
    ],
    build: (v) =>
      `${or(v.scene, "Un personnage marche seul dans une rue")}, ${or(v.camera, "travelling latéral").toLowerCase()}, ${or(v.light, "néons de nuit").toLowerCase()}, ralenti, grain de film, profondeur de champ, format cinéma.`,
  },
  {
    id: "anim-character",
    genre: "Animation",
    name: "Personnage animé",
    pitch: "Votre mascotte prend vie.",
    ratio: "16:9",
    fields: [
      {
        key: "character",
        label: "Personnage",
        placeholder: "Un petit robot jaune",
      },
      {
        key: "style",
        label: "Style",
        placeholder: "3D douce",
        options: [
          "Animation 3D douce",
          "Dessin animé 2D",
          "Pâte à modeler",
          "Papier découpé",
        ],
      },
      {
        key: "action",
        label: "Action",
        placeholder: "Il fait coucou",
        options: [
          "Fait coucou à la caméra",
          "Danse joyeusement",
          "Court dans une ville",
          "Découvre un cadeau",
        ],
      },
    ],
    build: (v) =>
      `${or(v.character, "Un petit personnage mignon")} ${or(v.action, "fait coucou à la caméra").toLowerCase()}, style ${or(v.style, "animation 3D douce").toLowerCase()}, couleurs vives, éclairage doux, mouvements fluides et expressifs.`,
  },
  {
    id: "real-life",
    genre: "Réaliste",
    name: "Moment de vie",
    pitch: "Vrai, simple, naturel.",
    ratio: "9:16",
    fields: [
      { key: "scene", label: "Scène", placeholder: "Une femme verse du café" },
      {
        key: "place",
        label: "Lieu",
        placeholder: "Cuisine lumineuse",
        options: [
          "Cuisine lumineuse",
          "Terrasse de café",
          "Rue animée",
          "Bureau moderne",
        ],
      },
    ],
    build: (v) =>
      `${or(v.scene, "Une personne prend son café")} dans ${or(v.place, "une cuisine lumineuse").toLowerCase()}, rendu photoréaliste, lumière naturelle, plan rapproché, mouvement de caméra lent et stable.`,
  },
];
