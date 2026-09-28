import { z } from "zod";

export const locationEncounterDecks = ["general", "america", "europe", "asia_australia"] as const;
export type LocationEncounterDeck = (typeof locationEncounterDecks)[number];
export type EncounterSection = "city" | "wilderness" | "sea" | "san_francisco" | "arkham" | "buenos_aires" | "london" | "rome" | "istanbul" | "shanghai" | "tokyo" | "sydney";

export const baseGameLocationEncounterCounts: Readonly<Record<LocationEncounterDeck, number>> = {
  general: 12,
  america: 8,
  europe: 8,
  asia_australia: 8,
};

const sectionsByDeck: Readonly<Record<LocationEncounterDeck, readonly EncounterSection[]>> = {
  general: ["city", "wilderness", "sea"],
  america: ["arkham", "san_francisco", "buenos_aires"],
  europe: ["london", "rome", "istanbul"],
  asia_australia: ["shanghai", "tokyo", "sydney"],
};

export interface LocationEncounterCard {
  id: string;
  deck: LocationEncounterDeck;
  number: number;
  sections: readonly EncounterSection[];
  imageUrl: string;
  backImageUrl: string;
  sourceScan: string;
  verification: "verified_from_scan";
  effectStatus: "not_executable";
}

const scannedSheets = [
  { deck: "america", numbers: [1, 2, 3, 4, 5], sourceScan: "source-assets/america/photo_2026-09-28_21-17-55.jpg" },
  { deck: "america", numbers: [6, 7, 8], sourceScan: "source-assets/america/photo_2026-09-28_21-18-03.jpg" },
  { deck: "general", numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], sourceScan: "source-assets/general/photo_2026-09-28_21-07-03.jpg" },
  { deck: "general", numbers: [11, 12], sourceScan: "source-assets/general/photo_2026-09-28_21-07-15.jpg" },
  { deck: "europe", numbers: [1, 2, 3, 4, 5], sourceScan: "source-assets/europe/photo_2026-09-28_21-08-11.jpg" },
  { deck: "europe", numbers: [6, 7, 8], sourceScan: "source-assets/europe/photo_2026-09-28_21-08-38.jpg" },
  { deck: "asia_australia", numbers: [1, 2, 3, 6, 7, 8], sourceScan: "source-assets/asia/photo_2026-09-28_21-07-33.jpg" },
  { deck: "asia_australia", numbers: [4, 5], sourceScan: "source-assets/asia/photo_2026-09-28_21-07-59.jpg" },
] as const satisfies readonly { deck: LocationEncounterDeck; numbers: readonly number[]; sourceScan: string }[];

export const baseGameScannedLocationEncounters: readonly LocationEncounterCard[] = scannedSheets.flatMap(({ deck, numbers, sourceScan }) =>
  numbers.map((number) => ({
    id: `encounter_${deck}_${String(number).padStart(2, "0")}`,
    deck,
    number,
    sections: sectionsByDeck[deck],
    imageUrl: `/cards/encounters/${deck}/${String(number).padStart(2, "0")}.webp`,
    backImageUrl: `/cards/encounters/${deck}/back.webp`,
    sourceScan,
    verification: "verified_from_scan",
    effectStatus: "not_executable",
  })),
);

const encounterSchema = z.object({
  id: z.string().regex(/^encounter_(general|america|europe|asia_australia)_\d{2}$/),
  deck: z.enum(locationEncounterDecks),
  number: z.number().int().positive(),
  sections: z.array(z.string().min(1)).length(3),
  imageUrl: z.string().regex(/^\/cards\/encounters\/(general|america|europe|asia_australia)\/\d{2}\.webp$/),
  backImageUrl: z.string().regex(/^\/cards\/encounters\/(general|america|europe|asia_australia)\/back\.webp$/),
  sourceScan: z.string().startsWith("source-assets/"),
  verification: z.literal("verified_from_scan"),
  effectStatus: z.literal("not_executable"),
}).strict();

export function validateLocationEncounterContent(cards: readonly LocationEncounterCard[]): void {
  const parsed = z.array(encounterSchema).parse(cards);
  if (new Set(parsed.map(card => card.id)).size !== parsed.length) throw new Error("Location encounter cards contain duplicate IDs.");
  for (const card of parsed) {
    if (card.number > baseGameLocationEncounterCounts[card.deck]
      || card.id !== `encounter_${card.deck}_${String(card.number).padStart(2, "0")}`
      || card.imageUrl !== `/cards/encounters/${card.deck}/${String(card.number).padStart(2, "0")}.webp`
      || card.backImageUrl !== `/cards/encounters/${card.deck}/back.webp`
      || card.sections.join(",") !== sectionsByDeck[card.deck].join(",")) {
      throw new Error(`Invalid base-game encounter mapping for ${card.id}.`);
    }
  }
}

export function missingBaseGameLocationEncounterIds(cards: readonly LocationEncounterCard[]): string[] {
  validateLocationEncounterContent(cards);
  const present = new Set(cards.map(card => card.id));
  return locationEncounterDecks.flatMap(deck =>
    Array.from({ length: baseGameLocationEncounterCounts[deck] }, (_, index) => `encounter_${deck}_${String(index + 1).padStart(2, "0")}`)
      .filter(id => !present.has(id)));
}

validateLocationEncounterContent(baseGameScannedLocationEncounters);
