import { z } from "zod";
import { remainingCardScanManifest as scans } from "./card-scan-manifest.js";

export const tokenEncounterDeckIds = [
  "research_azathoth", "research_cthulhu", "research_shub_niggurath", "research_yog_sothoth", "other_world",
  "expedition_the_heart_of_africa", "expedition_the_himalayas", "expedition_the_amazon", "expedition_tunguska", "expedition_antarctica", "expedition_the_pyramids",
  "special_cthulhu", "special_yog_sothoth",
] as const;
export type TokenEncounterDeckId = typeof tokenEncounterDeckIds[number];
export const tokenEncounterFamilies = ["research", "other_world", "expedition", "special"] as const;
export type TokenEncounterFamily = typeof tokenEncounterFamilies[number];

export const baseGameTokenEncounterCounts: Readonly<Record<TokenEncounterDeckId, number>> = Object.fromEntries(
  tokenEncounterDeckIds.map(id => [id, id.startsWith("research_") ? 8 : id.startsWith("expedition_") ? 3 : id.startsWith("special_") ? 6 : 24]),
) as Record<TokenEncounterDeckId, number>;

const names: Partial<Record<TokenEncounterDeckId, string>> = {
  expedition_the_heart_of_africa: "The Heart of Africa", expedition_the_himalayas: "The Himalayas", expedition_the_amazon: "The Amazon",
  expedition_tunguska: "Tunguska", expedition_antarctica: "Antarctica", expedition_the_pyramids: "The Pyramids",
  special_cthulhu: "R'lyeh Risen", special_yog_sothoth: "The Key and the Gate",
};

const cardSchema = z.object({
  id: z.string().min(1), deck: z.enum(tokenEncounterDeckIds), family: z.enum(tokenEncounterFamilies), number: z.number().int().positive(),
  name: z.string().min(1), sections: z.array(z.enum(["city", "wilderness", "sea", "initial", "pass", "fail"])),
  imageUrl: z.string().startsWith("/cards/encounters/"), backImageUrl: z.string().startsWith("/cards/encounters/"),
  sourceScan: z.string().startsWith("source-assets/"), sourceBackScan: z.string().startsWith("source-assets/"), sourceCellIndex: z.number().int().nonnegative(),
  verification: z.literal("artwork_verified_from_scan"), effectStatus: z.literal("not_executable"),
}).strict();
export type TokenEncounterCard = z.infer<typeof cardSchema>;

export const baseGameScannedTokenEncounters: readonly TokenEncounterCard[] = scans.decks.filter(deck => deck.family !== "artifact").flatMap(deck => {
  const id = z.enum(tokenEncounterDeckIds).parse(deck.id);
  const family = z.enum(tokenEncounterFamilies).parse(deck.family);
  return deck.sheets.flatMap(sheet => sheet.numbers.map((number, index) => ({
    id: `encounter_${id}_${String(number).padStart(2, "0")}`, deck: id, family, number,
    name: sheet.titles?.[index] ?? names[id] ?? `Research encounter ${number}`,
    sections: family === "research" ? ["city", "wilderness", "sea"] as const : ["initial", "pass", "fail"] as const,
    imageUrl: `/cards/encounters/${id}/${String(number).padStart(2, "0")}.webp`, backImageUrl: `/cards/encounters/${id}/back.webp`,
    sourceScan: `source-assets/${sheet.file}`, sourceBackScan: `source-assets/${deck.backScan}`, sourceCellIndex: index,
    verification: "artwork_verified_from_scan" as const, effectStatus: "not_executable" as const,
  }))).map(card => cardSchema.parse(card));
});

export function validateTokenEncounterContent(cards: readonly TokenEncounterCard[]): void {
  const parsed = z.array(cardSchema).parse(cards);
  if (new Set(parsed.map(card => card.id)).size !== parsed.length) throw new Error("Token encounter cards contain duplicate IDs.");
  for (const card of parsed) {
    const expected = baseGameScannedTokenEncounters.find(candidate => candidate.id === card.id);
    if (!expected || JSON.stringify(card) !== JSON.stringify(cardSchema.parse(expected))) throw new Error(`Invalid base-game encounter mapping for ${card.id}.`);
  }
}

export function missingBaseGameTokenEncounterIds(cards: readonly TokenEncounterCard[]): string[] {
  validateTokenEncounterContent(cards);
  const ids = new Set(cards.map(card => card.id));
  return tokenEncounterDeckIds.flatMap(deck => Array.from({ length: baseGameTokenEncounterCounts[deck] }, (_, i) => `encounter_${deck}_${String(i + 1).padStart(2, "0")}`)).filter(id => !ids.has(id));
}

validateTokenEncounterContent(baseGameScannedTokenEncounters);
if (missingBaseGameTokenEncounterIds(baseGameScannedTokenEncounters).length) throw new Error("The base-game token encounter scan catalog is incomplete.");
