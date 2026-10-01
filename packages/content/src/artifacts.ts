import { z } from "zod";
import { remainingCardScanManifest as scans } from "./card-scan-manifest.js";

// Mechanical text transcribed from the supplied English fronts. Not runtime-parsed.
const definitions = [
  ["grotesque_statue", "Grotesque Statue", ["item"], "When you gain this card from the deck, gain 5 Clues. Once per round, you may spend 1 Clue to prevent all Sanity loss from a single effect."],
  ["sword_of_saint_jerome", "Sword of Saint Jerome", ["item", "weapon", "magical"], "Gain +2 Will and +5 Strength when resolving Combat Encounters. If you defeat a Monster during a Combat Encounter, recover 1 Sanity."],
  ["lightning_gun", "Lightning Gun", ["item", "weapon", "magical"], "Gain +6 Strength when resolving Combat Encounters. Action: You and each Monster on your space lose 1 Health."],
  ["pallid_mask", "Pallid Mask", ["item", "magical"], "During the Encounter Phase, you may choose an encounter as if there were no Monsters on your space."],
  ["de_vermis_mysteriis", "De Vermis Mysteriis", ["item", "tome"], "Action: Test Lore. If you pass, you may spend 1 Sanity to improve 1 skill of your choice."],
  ["ttka_halot", "T'tka Halot", ["item", "tome"], "Action: Test Lore. If you pass, you may spend 1 Sanity to choose 1 Monster on your space to lose 3 Health."],
  ["flute_of_the_outer_gods", "Flute of the Outer Gods", ["item", "magical"], "Action: Spend 2 Health and 2 Sanity to defeat all Monsters on your space."],
  ["cultes_des_goules", "Cultes des Goules", ["item", "tome"], "Action: Test Lore. If you pass, you may spend 1 Sanity to gain 2 Clues."],
  ["necronomicon", "Necronomicon", ["item", "tome"], "Action: Test Lore. If you pass, you may spend 1 Sanity to gain 2 Spells."],
  ["gate_box", "Gate Box", ["item", "magical"], "Investigators on your space roll 1 additional die when resolving tests during Other World Encounters. If you close a Gate during an Other World Encounter, gain 1 Clue."],
  ["glass_of_mortlan", "Glass of Mortlan", ["item", "magical"], "Each 6 you roll when resolving a Spell effect counts as 2 successes. You may prevent the loss of 1 Sanity when resolving your Spell effects."],
  ["the_silver_key", "The Silver Key", ["item", "magical"], "Once per round, you may spend 1 less Clue to pay for an effect. You may reroll 1 die when resolving a test during an Other World Encounter."],
  ["ruby_of_rlyeh", "Ruby of R'lyeh", ["item", "magical"], "Once per round, during the Action Phase, you may spend 1 Sanity and perform 1 additional action."],
  ["mi_go_brain_case", "Mi-go Brain Case", ["item", "magical"], "Action: You and another investigator may trade possessions. In addition, he may move to your space; if he does, move to his previous space."],
] as const;

const artifactSchema = z.object({
  id: z.string().regex(/^artifact_[a-z0-9_]+$/), name: z.string().min(1), traits: z.array(z.enum(["item", "weapon", "magical", "tome"])).min(1), effectText: z.string().min(1),
  imageUrl: z.string().startsWith("/cards/artifacts/"), backImageUrl: z.literal("/cards/artifacts/back.webp"),
  sourceScan: z.string().startsWith("source-assets/artifacts/"), sourceCellIndex: z.number().int().nonnegative(),
  verification: z.literal("artwork_verified_from_scan"), rulesStatus: z.literal("transcribed_pending_execution"),
}).strict();
export type ArtifactCardData = z.infer<typeof artifactSchema>;
export const baseGameArtifacts: readonly ArtifactCardData[] = definitions.map(([slug, name, traits, effectText]) => {
  const sheet = scans.decks.find(deck => deck.family === "artifact")?.sheets.find(sheet => sheet.ids?.includes(slug));
  if (!sheet?.ids) throw new Error(`Artifact scan missing: ${slug}`);
  return artifactSchema.parse({ id: `artifact_${slug}`, name, traits, effectText, imageUrl: `/cards/artifacts/${slug}.webp`, backImageUrl: "/cards/artifacts/back.webp",
    sourceScan: `source-assets/${sheet.file}`, sourceCellIndex: sheet.ids.indexOf(slug), verification: "artwork_verified_from_scan", rulesStatus: "transcribed_pending_execution" });
});

export function validateArtifactContent(cards: readonly ArtifactCardData[]): void {
  const parsed = z.array(artifactSchema).parse(cards);
  if (new Set(parsed.map(card => card.id)).size !== parsed.length) throw new Error("Artifact cards contain duplicate IDs.");
  for (const card of parsed) {
    const expected = baseGameArtifacts.find(candidate => candidate.id === card.id);
    if (!expected || JSON.stringify(card) !== JSON.stringify(expected)) throw new Error(`Invalid base-game Artifact mapping for ${card.id}.`);
  }
}
validateArtifactContent(baseGameArtifacts);
