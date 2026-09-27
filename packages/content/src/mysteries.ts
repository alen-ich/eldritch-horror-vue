import type { AncientOneId } from "@eldritch/protocol";
import { z } from "zod";

export const mysteryIds = [
  "azathoth_occult_research", "azathoth_omen_of_devastation", "azathoth_seed_of_the_daemon_sultan", "azathoth_the_true_name",
  "cthulhu_rlyeh_risen", "cthulhu_the_deep_ones_attack", "cthulhu_the_stars_are_right", "cthulhu_watching_the_stars",
  "shub_hunting_the_thousand", "shub_nature_of_the_all_mother", "shub_rituals_in_the_wild", "shub_spawn_of_the_black_goat",
  "yog_arcane_understanding", "yog_spawn_of_yog_sothoth", "yog_the_beyond_one", "yog_where_the_old_ones_broke_through",
] as const;

export type MysteryId = (typeof mysteryIds)[number];
export type InvestigatorScaledTarget = "investigator_count" | "half_investigator_count" | "twice_investigator_count";

export type MysterySetup =
  | { type: "place_mystery_token"; locationId: string }
  | { type: "place_eldritch_tokens"; locationIds: readonly string[] }
  | { type: "place_random_eldritch_tokens"; count: "half_investigator_count"; destination: "location" }
  | { type: "each_investigator_places_eldritch_token"; destination: "nearest_sea_without_eldritch_token" }
  | { type: "move_all_clues"; destination: "nearest_sea" | "nearest_wilderness" }
  | { type: "spawn_epic_monster"; monsterId: string; locationId: string };

export type MysteryProgress =
  | { type: "research_encounter_clue"; amount: 1 }
  | { type: "location_test"; location: "mystery_token" | "eldritch_token"; skill: "observation"; clueCost: 2; reward: "move_eldritch_token_to_card" }
  | { type: "close_matching_omen_gate"; clueCost: 1; reward: "place_eldritch_token_on_card" }
  | { type: "special_encounter"; deckId: string; locationId: string; reward: "card_defined_eldritch_tokens" }
  | { type: "deep_one_ambush"; location: "eldritch_token"; clueCostAfterDefeat: 1; reward: "move_eldritch_token_to_card" }
  | { type: "defeat_epic_monster"; monsterId: string }
  | { type: "collect_defeated_non_epic_monster"; clueCost: 2 }
  | { type: "successful_spell_lore_test"; clueCost: 1; discardResolvedSpell: true; reward: "place_eldritch_token_on_card" }
  | { type: "close_gate"; spellCost: 2; reward: "place_closed_gate_on_card" };

export type MysteryCompletion =
  | { timing: "end_mythos"; metric: "clues" | "eldritch_tokens" | "gates"; target: "investigator_count" | "half_investigator_count"; cleanup?: "discard_board_eldritch_tokens" | "return_collected_gates_to_box"; preserveBoardEldritchTokens?: true }
  | { timing: "end_mythos"; metric: "collected_monster_toughness"; target: "twice_investigator_count" }
  | { timing: "end_mythos"; metric: "epic_monster_defeated"; monsterId: string };

export interface MysteryData {
  id: MysteryId;
  ancientOneId: AncientOneId;
  name: string;
  imageUrl: string;
  backImageUrl: string;
  scanVerification: "supplied_english_scan";
  setup: readonly MysterySetup[];
  progress: MysteryProgress;
  completion: MysteryCompletion;
}

type MysteryDefinition = Omit<MysteryData, "imageUrl" | "backImageUrl" | "scanVerification">;

const baseGameMysteryDefinitions = [
  {
    id: "azathoth_occult_research", ancientOneId: "azathoth", name: "Occult Research",
    setup: [], progress: { type: "research_encounter_clue", amount: 1 },
    completion: { timing: "end_mythos", metric: "clues", target: "investigator_count" },
  },
  {
    id: "azathoth_omen_of_devastation", ancientOneId: "azathoth", name: "Omen of Devastation",
    setup: [], progress: { type: "close_matching_omen_gate", clueCost: 1, reward: "place_eldritch_token_on_card" },
    completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "half_investigator_count" },
  },
  {
    id: "azathoth_seed_of_the_daemon_sultan", ancientOneId: "azathoth", name: "Seed of the Daemon Sultan",
    setup: [{ type: "place_mystery_token", locationId: "tunguska" }], progress: { type: "location_test", location: "mystery_token", skill: "observation", clueCost: 2, reward: "move_eldritch_token_to_card" },
    completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "half_investigator_count" },
  },
  {
    id: "azathoth_the_true_name", ancientOneId: "azathoth", name: "The True Name",
    setup: [{ type: "place_random_eldritch_tokens", count: "half_investigator_count", destination: "location" }], progress: { type: "location_test", location: "eldritch_token", skill: "observation", clueCost: 2, reward: "move_eldritch_token_to_card" },
    completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "half_investigator_count" },
  },
  {
    id: "cthulhu_rlyeh_risen", ancientOneId: "cthulhu", name: "R'lyeh Risen",
    setup: [{ type: "place_mystery_token", locationId: "space_3" }], progress: { type: "special_encounter", deckId: "special_encounter_cthulhu", locationId: "space_3", reward: "card_defined_eldritch_tokens" },
    completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "half_investigator_count" },
  },
  {
    id: "cthulhu_the_deep_ones_attack", ancientOneId: "cthulhu", name: "The Deep Ones Attack!",
    setup: [{ type: "each_investigator_places_eldritch_token", destination: "nearest_sea_without_eldritch_token" }], progress: { type: "deep_one_ambush", location: "eldritch_token", clueCostAfterDefeat: 1, reward: "move_eldritch_token_to_card" },
    completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "investigator_count", preserveBoardEldritchTokens: true },
  },
  {
    id: "cthulhu_the_stars_are_right", ancientOneId: "cthulhu", name: "The Stars Are Right!",
    setup: [{ type: "move_all_clues", destination: "nearest_sea" }], progress: { type: "research_encounter_clue", amount: 1 },
    completion: { timing: "end_mythos", metric: "clues", target: "investigator_count" },
  },
  {
    id: "cthulhu_watching_the_stars", ancientOneId: "cthulhu", name: "Watching the Stars",
    setup: [{ type: "spawn_epic_monster", monsterId: "epic_monster_cthylla", locationId: "space_12" }], progress: { type: "defeat_epic_monster", monsterId: "epic_monster_cthylla" },
    completion: { timing: "end_mythos", metric: "epic_monster_defeated", monsterId: "epic_monster_cthylla" },
  },
  {
    id: "shub_hunting_the_thousand", ancientOneId: "shub_niggurath", name: "Hunting the Thousand",
    setup: [], progress: { type: "collect_defeated_non_epic_monster", clueCost: 2 }, completion: { timing: "end_mythos", metric: "collected_monster_toughness", target: "twice_investigator_count" },
  },
  {
    id: "shub_nature_of_the_all_mother", ancientOneId: "shub_niggurath", name: "Nature of the All-Mother",
    setup: [{ type: "move_all_clues", destination: "nearest_wilderness" }], progress: { type: "research_encounter_clue", amount: 1 }, completion: { timing: "end_mythos", metric: "clues", target: "investigator_count" },
  },
  {
    id: "shub_rituals_in_the_wild", ancientOneId: "shub_niggurath", name: "Rituals in the Wild",
    setup: [{ type: "place_eldritch_tokens", locationIds: ["space_4", "space_10", "space_21", "tunguska"] }], progress: { type: "location_test", location: "eldritch_token", skill: "observation", clueCost: 2, reward: "move_eldritch_token_to_card" },
    completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "half_investigator_count", cleanup: "discard_board_eldritch_tokens" },
  },
  {
    id: "shub_spawn_of_the_black_goat", ancientOneId: "shub_niggurath", name: "Spawn of the Black Goat",
    setup: [{ type: "spawn_epic_monster", monsterId: "epic_monster_nug", locationId: "the_amazon" }], progress: { type: "defeat_epic_monster", monsterId: "epic_monster_nug" }, completion: { timing: "end_mythos", metric: "epic_monster_defeated", monsterId: "epic_monster_nug" },
  },
  {
    id: "yog_arcane_understanding", ancientOneId: "yog_sothoth", name: "Arcane Understanding",
    setup: [], progress: { type: "successful_spell_lore_test", clueCost: 1, discardResolvedSpell: true, reward: "place_eldritch_token_on_card" }, completion: { timing: "end_mythos", metric: "eldritch_tokens", target: "investigator_count" },
  },
  {
    id: "yog_spawn_of_yog_sothoth", ancientOneId: "yog_sothoth", name: "Spawn of Yog-Sothoth",
    setup: [{ type: "spawn_epic_monster", monsterId: "epic_monster_dunwich_horror", locationId: "arkham" }], progress: { type: "defeat_epic_monster", monsterId: "epic_monster_dunwich_horror" }, completion: { timing: "end_mythos", metric: "epic_monster_defeated", monsterId: "epic_monster_dunwich_horror" },
  },
  {
    id: "yog_the_beyond_one", ancientOneId: "yog_sothoth", name: "The Beyond One",
    setup: [], progress: { type: "research_encounter_clue", amount: 1 }, completion: { timing: "end_mythos", metric: "clues", target: "investigator_count" },
  },
  {
    id: "yog_where_the_old_ones_broke_through", ancientOneId: "yog_sothoth", name: "Where the Old Ones Broke Through",
    setup: [], progress: { type: "close_gate", spellCost: 2, reward: "place_closed_gate_on_card" }, completion: { timing: "end_mythos", metric: "gates", target: "half_investigator_count", cleanup: "return_collected_gates_to_box" },
  },
] as const satisfies readonly MysteryDefinition[];

const mysteryBackImageUrls: Record<AncientOneId, string> = {
  azathoth: "/cards/mysteries/azathoth-back.webp",
  cthulhu: "/cards/mysteries/cthulhu-back.webp",
  shub_niggurath: "/cards/mysteries/shub_niggurath-back.webp",
  yog_sothoth: "/cards/mysteries/yog_sothoth-back.webp",
};

export const baseGameMysteries: readonly MysteryData[] = baseGameMysteryDefinitions.map((mystery) => ({
  ...mystery,
  imageUrl: `/cards/mysteries/${mystery.id}.webp`,
  backImageUrl: mysteryBackImageUrls[mystery.ancientOneId],
  scanVerification: "supplied_english_scan",
}));

const componentIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const setupSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place_mystery_token"), locationId: componentIdSchema }).strict(),
  z.object({ type: z.literal("place_eldritch_tokens"), locationIds: z.array(componentIdSchema).min(1) }).strict(),
  z.object({ type: z.literal("place_random_eldritch_tokens"), count: z.literal("half_investigator_count"), destination: z.literal("location") }).strict(),
  z.object({ type: z.literal("each_investigator_places_eldritch_token"), destination: z.literal("nearest_sea_without_eldritch_token") }).strict(),
  z.object({ type: z.literal("move_all_clues"), destination: z.enum(["nearest_sea", "nearest_wilderness"]) }).strict(),
  z.object({ type: z.literal("spawn_epic_monster"), monsterId: componentIdSchema, locationId: componentIdSchema }).strict(),
]);
const progressSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("research_encounter_clue"), amount: z.literal(1) }).strict(),
  z.object({ type: z.literal("location_test"), location: z.enum(["mystery_token", "eldritch_token"]), skill: z.literal("observation"), clueCost: z.literal(2), reward: z.literal("move_eldritch_token_to_card") }).strict(),
  z.object({ type: z.literal("close_matching_omen_gate"), clueCost: z.literal(1), reward: z.literal("place_eldritch_token_on_card") }).strict(),
  z.object({ type: z.literal("special_encounter"), deckId: componentIdSchema, locationId: componentIdSchema, reward: z.literal("card_defined_eldritch_tokens") }).strict(),
  z.object({ type: z.literal("deep_one_ambush"), location: z.literal("eldritch_token"), clueCostAfterDefeat: z.literal(1), reward: z.literal("move_eldritch_token_to_card") }).strict(),
  z.object({ type: z.literal("defeat_epic_monster"), monsterId: componentIdSchema }).strict(),
  z.object({ type: z.literal("collect_defeated_non_epic_monster"), clueCost: z.literal(2) }).strict(),
  z.object({ type: z.literal("successful_spell_lore_test"), clueCost: z.literal(1), discardResolvedSpell: z.literal(true), reward: z.literal("place_eldritch_token_on_card") }).strict(),
  z.object({ type: z.literal("close_gate"), spellCost: z.literal(2), reward: z.literal("place_closed_gate_on_card") }).strict(),
]);
const completionSchema = z.discriminatedUnion("metric", [
  z.object({ timing: z.literal("end_mythos"), metric: z.enum(["clues", "eldritch_tokens", "gates"]), target: z.enum(["investigator_count", "half_investigator_count"]), cleanup: z.enum(["discard_board_eldritch_tokens", "return_collected_gates_to_box"]).optional(), preserveBoardEldritchTokens: z.literal(true).optional() }).strict(),
  z.object({ timing: z.literal("end_mythos"), metric: z.literal("collected_monster_toughness"), target: z.literal("twice_investigator_count") }).strict(),
  z.object({ timing: z.literal("end_mythos"), metric: z.literal("epic_monster_defeated"), monsterId: componentIdSchema }).strict(),
]);
const mysterySchema = z.object({
  id: z.enum(mysteryIds), ancientOneId: z.enum(["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"]),
  name: z.string().min(1),
  imageUrl: z.string().regex(/^\/cards\/mysteries\/[a-z0-9_]+\.webp$/),
  backImageUrl: z.string().regex(/^\/cards\/mysteries\/[a-z0-9_]+-back\.webp$/),
  scanVerification: z.literal("supplied_english_scan"),
  setup: z.array(setupSchema), progress: progressSchema, completion: completionSchema,
}).strict();

export function mysteryTargetValue(target: InvestigatorScaledTarget, investigatorCount: number): number {
  if (!Number.isInteger(investigatorCount) || investigatorCount < 1) throw new Error("Investigator count must be a positive integer.");
  if (target === "half_investigator_count") return Math.ceil(investigatorCount / 2);
  if (target === "twice_investigator_count") return investigatorCount * 2;
  return investigatorCount;
}

export function validateMysteryContent(mysteries: readonly MysteryData[]): void {
  const parsed = z.array(mysterySchema).parse(mysteries);
  const ids = new Set(parsed.map(({ id }) => id));
  if (ids.size !== parsed.length) throw new Error("Mystery content contains duplicate IDs.");
  if (ids.size !== mysteryIds.length || mysteryIds.some((id) => !ids.has(id))) throw new Error("Mystery content does not match the base-game roster.");
  for (const ancientOneId of ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"] as const) {
    if (parsed.filter((mystery) => mystery.ancientOneId === ancientOneId).length !== 4) throw new Error(`${ancientOneId} must have exactly four Mysteries.`);
  }
}

validateMysteryContent(baseGameMysteries);
