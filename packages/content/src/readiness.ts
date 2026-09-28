import { z } from "zod";

export const contentFamilyIds = [
  "map",
  "investigators",
  "starting_possessions",
  "ancient_ones",
  "mysteries",
  "monsters",
  "gates",
  "assets",
  "artifacts",
  "spells",
  "conditions",
  "mythos_cards",
  "encounter_cards",
  "reference_card_setup",
] as const;

export type ContentFamilyId = (typeof contentFamilyIds)[number];
export type ContentReadinessStatus = "verified" | "needs_review" | "absent";

export interface ContentFamilyReadiness {
  id: ContentFamilyId;
  status: ContentReadinessStatus;
  source: string;
  notes: string;
}

const contentFamilyReadinessSchema = z.object({
  id: z.enum(contentFamilyIds),
  status: z.enum(["verified", "needs_review", "absent"]),
  source: z.string().min(1),
  notes: z.string().min(1),
}).strict();

export const baseGameContentReadiness: readonly ContentFamilyReadiness[] = [
  { id: "map", status: "verified", source: "map data PDF and registered board scan", notes: "All 36 spaces and 70 routes are validated." },
  { id: "investigators", status: "verified", source: "base investigator data PDF", notes: "All 12 investigator sheets are represented." },
  { id: "starting_possessions", status: "needs_review", source: "investigator sheet transcription", notes: "Names are display strings and are not linked to stable component IDs." },
  { id: "ancient_ones", status: "verified", source: "four base-game Ancient One sheet scans", notes: "Starting Doom, Mythos compositions, setup dependencies, Cultist overrides, awakening effects, and Final Mysteries are structured; referenced components remain separate readiness requirements." },
  { id: "mysteries", status: "verified", source: "16 English base-game Mystery fronts and four Ancient One backs", notes: "All four-card Ancient One decks are structured and linked to scan-verified artwork generated from the current source files." },
  { id: "monsters", status: "verified", source: "Eldritch Horror Wiki Core entries cross-checked against supplied base-game monster PDF", notes: "All 34 normal and 9 Epic Monster tokens are structured with Core counts, combat statistics, effects, and token images." },
  { id: "gates", status: "verified", source: "nine English base-game Gate faces and shared back", notes: "The complete Gate pool is structured with unique city locations, Omen symbols, and scan-verified artwork." },
  { id: "assets", status: "needs_review", source: "40 English base-game Asset fronts, shared back, and supplied rules JSON", notes: "The complete roster has stable IDs, artwork, values, traits, timing categories, and effect text; effects are not yet executable and require engine-level verification." },
  { id: "artifacts", status: "absent", source: "not supplied", notes: "No executable Artifact deck is structured." },
  { id: "spells", status: "absent", source: "not supplied", notes: "No executable Spell deck is structured." },
  { id: "conditions", status: "absent", source: "not supplied", notes: "No executable Condition deck or hidden backs are structured." },
  { id: "mythos_cards", status: "needs_review", source: "51 supplied English card-front scans", notes: "The complete 18 green, 21 yellow, and 12 blue roster is scan-verified; printed effects and icon sequences are not yet executable." },
  { id: "encounter_cards", status: "needs_review", source: "28 English General, Europe, and Asia/Australia fronts with three shared backs", notes: "These three location decks are scan-verified and cataloged but their effects are not executable. America (8 cards), Research, Other World, Expedition, and Special encounters remain absent." },
  { id: "reference_card_setup", status: "verified", source: "English base-game Icon Reference card scans", notes: "Gate spawn, Clue spawn, and Monster Surge values are structured and scan-verified for 1-8 investigators." },
] as const;

export function validateContentReadiness(entries: readonly ContentFamilyReadiness[]): void {
  const parsed = z.array(contentFamilyReadinessSchema).parse(entries);
  const ids = new Set(parsed.map((entry) => entry.id));
  if (ids.size !== parsed.length) throw new Error("Content readiness contains duplicate family IDs.");
  const missing = contentFamilyIds.filter((id) => !ids.has(id));
  if (missing.length > 0) throw new Error(`Content readiness is missing required families: ${missing.join(", ")}.`);
}

export function incompleteContentFamilies(
  entries: readonly ContentFamilyReadiness[],
): ContentFamilyReadiness[] {
  validateContentReadiness(entries);
  return entries.filter((entry) => entry.status !== "verified");
}

export function assertCompleteBaseGameContent(
  entries: readonly ContentFamilyReadiness[] = baseGameContentReadiness,
): void {
  const incomplete = incompleteContentFamilies(entries);
  if (incomplete.length === 0) return;
  throw new Error(`Complete base-game setup is unavailable; incomplete content: ${incomplete.map((entry) => `${entry.id} (${entry.status})`).join(", ")}.`);
}

validateContentReadiness(baseGameContentReadiness);
