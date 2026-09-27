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
  { id: "ancient_ones", status: "absent", source: "not supplied", notes: "No Ancient One sheets or Mythos deck compositions are structured." },
  { id: "mysteries", status: "absent", source: "not supplied", notes: "No Mystery deck is structured." },
  { id: "monsters", status: "absent", source: "not supplied", notes: "No normal or Epic Monster tokens are structured." },
  { id: "gates", status: "absent", source: "not supplied", notes: "No Gate token faces or pool composition are structured." },
  { id: "assets", status: "absent", source: "not supplied", notes: "No executable Asset deck is structured." },
  { id: "artifacts", status: "absent", source: "not supplied", notes: "No executable Artifact deck is structured." },
  { id: "spells", status: "absent", source: "not supplied", notes: "No executable Spell deck is structured." },
  { id: "conditions", status: "absent", source: "not supplied", notes: "No executable Condition deck or hidden backs are structured." },
  { id: "mythos_cards", status: "needs_review", source: "189-card OCR catalog", notes: "Scans exist, but OCR text is not authoritative or executable." },
  { id: "encounter_cards", status: "needs_review", source: "189-card OCR catalog", notes: "Scans exist, but OCR text is not authoritative or executable." },
  { id: "reference_card_setup", status: "absent", source: "not supplied", notes: "Player-count setup and spawn values are unavailable." },
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
