import { TOGETHER_POSITION } from "../lib/together-placement.ts";
import { unproject } from "../lib/geo.ts";
import type { Installation, Survey } from "../types";
import officialArtworks from "./official-artworks.json" with { type: "json" };
import surveyData from "./survey.json" with { type: "json" };
// Photo-informed placements remain approximate until the event survey. These also
// drive directions and route endpoints, rather than only moving the rendered pins.
const sitePositions: Record<string, [number, number]> = {
  "flower-power": [-1.59, -398.48],
  loop: [-154, -714],
  "today-i-love-you": [-185, -321],
  "coloured-peonies": [-169.96, -159],
  unity: [-146, -101],
  "the-stars-come-out-at-night": [-80.25, 615.1],
  together: TOGETHER_POSITION,
  // The small fountain beside Chavasse Park, beyond the bus station.
  paradigm: [186, 159],
  "dream-herd": [116, -111],
  pop: [588, -278],
};
const survey = surveyData as Survey;
type Seed = [
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  string,
  string,
  string?,
];
const seeds: Seed[] = [
  [
    "invisible-cities",
    "Invisible Cities",
    "Atelier Sisu",
    "Pier Head North",
    "Waterfront",
    -2.99718,
    53.40605,
    "#b4a1ff",
    "Walk between sculptural aluminium forms, shifting colours and sound. A reflection on the many different ways we experience a city.",
  ],
  [
    "today-i-love-you",
    "Today I Love You",
    "Massimo Uberti",
    "Liverpool Parish Church",
    "Waterfront",
    -2.99496,
    53.40662,
    "#ffaebf",
    "A simple declaration, written in light. Pause for a moment with an artwork that turns words into a shared experience.",
  ],
  [
    "coloured-peonies",
    "Coloured Peonies",
    "TILT",
    "Cunard Building, The Strand",
    "Waterfront",
    -2.99466,
    53.40502,
    "#ffc2eb",
    "Giant illuminated flowers create a canopy of colour. Circular seats underneath invite people to gather and spend time together.",
  ],
  [
    "unity",
    "Unity",
    "Amigo & Amigo",
    "George’s Dock Way",
    "Waterfront",
    -2.99357,
    53.40373,
    "#fda36e",
    "Five intertwined human figures form a colourful seven-metre sculpture celebrating community and connection.",
  ],
  [
    "colour-rush",
    "Colour Rush",
    "Liz West",
    "Martin Luther King Building",
    "Albert Dock",
    -2.9916,
    53.40172,
    "#ff7cc0",
    "An octagonal beacon of patterned colour rises above a mirrored base, bringing reflections and luminous stripes together.",
    "VisitLiverpool_product_page_8__16b11b50-f52c-41d2-9535-d4cb0788f4ba.png",
  ],
  [
    "the-stars-come-out-at-night",
    "The Stars Come Out at Night",
    "Stellar Creates",
    "Anchor Courtyard, Royal Albert Dock",
    "Albert Dock",
    -2.99105,
    53.39976,
    "#9fbbff",
    "A slowly turning sculpture casts star patterns into its surroundings, creating a moment of wonder beneath a shared night sky.",
  ],
  [
    "together",
    "Together",
    "Murugiah, Sam Wiehl & GloMoth",
    "Wapping Dock Wall",
    "Albert Dock",
    -2.98917,
    53.39939,
    "#ffc574",
    "An imaginative world of characters, colour and sound, shaped with Liverpool communities to celebrate identity and belonging.",
  ],
  [
    "paradigm",
    "Paradigm",
    "This is Loop",
    "Thomas Steers Way, Liverpool ONE",
    "City centre",
    -2.98853,
    53.40219,
    "#7ee1f2",
    "A radiant sphere of illuminated rods explores how small individual actions can become a shared force for change.",
  ],
  [
    "dream-herd",
    "Dream Herd",
    "Amigo & Amigo",
    "Derby Square",
    "City centre",
    // Approximate public plaza placement, centred on the mapped Derby Square circle.
    -2.990251,
    53.404998,
    "#ffe697",
    "A playful take on counting sheep. Touch-responsive light and sound invite people into a collective dreamscape.",
  ],
  [
    "pop",
    "POP!",
    "Gentilhomme",
    "Williamson Square",
    "City centre",
    -2.98274,
    53.40682,
    "#a5e5a2",
    "Five colourful monoliths conceal playful characters. Visitors use voices, clapping and song to persuade them to emerge.",
    "VisitLiverpool_product_page_2__8a4bb19f-4cba-4fdc-a70b-c2abdcefcb6b.png",
  ],
  [
    "the-anooki",
    "The Anooki",
    "Inook",
    "Liverpool Town Hall",
    "Commercial district",
    -2.99162,
    53.40693,
    "#e4edff",
    "Two larger-than-life friends play hide-and-seek around the Town Hall columns, inviting smiles and a little exploration.",
    "VisitLiverpool_product_page_9__d9daa4df-0196-4772-80b1-e46f17baefb6.png",
  ],
  [
    "flower-power",
    "Flower Power",
    "Spectaculaires – Allumeurs d’images",
    "Exchange Flags",
    "Commercial district",
    -2.99178,
    53.40769,
    "#f8a1e7",
    "Seven faceted flowers fill the square with colourful reflections. Music selected by visitors brings everyone into the same shared atmosphere.",
  ],
  [
    "loop",
    "LOOP",
    "EKUMEN × Murugiah",
    "St Paul’s Square",
    "Commercial district",
    -2.99405,
    53.41033,
    "#e2efa5",
    "Six giant zoetropes invite visitors to work together, bringing illustrations, light and sound to life through movement.",
    "VisitLiverpool_product_page_1__64f4f11d-7647-42d9-bf60-bab7464c2db9.png",
  ],
];
// Official installation numbers supplied in the event-map screenshot, batch 01.
const officialOrder = [
  "the-anooki",
  "flower-power",
  "loop",
  "today-i-love-you",
  "invisible-cities",
  "coloured-peonies",
  "unity",
  "colour-rush",
  "the-stars-come-out-at-night",
  "together",
  "paradigm",
  "dream-herd",
  "pop",
];
export const installations: Installation[] = [...seeds]
  .sort((a, b) => officialOrder.indexOf(a[0]) - officialOrder.indexOf(b[0]))
  .map(
    ([id, name, artist, location, area, lon, lat, color, description], i) => {
      const override = survey.installationOverrides.find((o) => o.id === id);
      const official = officialArtworks[id as keyof typeof officialArtworks];
      return {
        id,
        number: i + 1,
        name,
        artist,
        location: official.location || location,
        area,
        coordinates:
          override?.coordinates ??
          (sitePositions[id] ? unproject(...sitePositions[id]) : [lon, lat]),
        color,
        description: official.description || description,
        source: official.source,
        artworkPlacement: [
          "today-i-love-you",
          "invisible-cities",
          "coloured-peonies",
          "unity",
          "colour-rush",
          "the-stars-come-out-at-night",
          "together",
        ].includes(id)
          ? "pending"
          : "illustrative",
        positionStatus: override ? "surveyed" : "approximate",
        photos: [
          {
            src: official.image,
            alt: name + " — official River of Light 2026 artwork image",
            credit: "VisitLiverpool · artwork creators",
            kind: "artwork" as const,
          },
          ...survey.photos.filter(
            (p) => p.installationId === id && p.kind === "site",
          ),
        ],
      };
    },
  );
