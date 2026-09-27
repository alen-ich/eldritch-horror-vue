import type { AncientOneId } from "@eldritch/protocol";
import { z } from "zod";

export const mysteryIds = [
  "azathoth_occult_research",
  "azathoth_omen_of_devastation",
  "azathoth_seed_of_the_daemon_sultan",
  "azathoth_the_true_name",
  "cthulhu_rlyeh_risen",
  "cthulhu_the_deep_ones_attack",
  "cthulhu_the_stars_are_right",
  "cthulhu_watching_the_stars",
  "shub_hunting_the_thousand",
  "shub_nature_of_the_all_mother",
  "shub_rituals_in_the_wild",
  "shub_spawn_of_the_black_goat",
  "yog_arcane_understanding",
  "yog_spawn_of_yog_sothoth",
  "yog_the_beyond_one",
  "yog_where_the_old_ones_broke_through",
] as const;

export type MysteryId = (typeof mysteryIds)[number];
export type MysteryTarget = "investigator_count" | "half_investigator_count" | "twice_investigator_count" | "card_defined";
export type MysteryMechanic =
  | { type: "collect_clues"; trigger: "research_encounter"; target: "investigator_count" }
  | { type: "collect_eldritch_tokens"; method: "close_matching_gate" | "visit_token"; target: "half_investigator_count" }
  | { type: "special_encounter"; locationId: string; target: "card_defined" }
  | { type: "defeat_epic_monster"; monsterId: string; spawnLocationId: string }
  | { type: "collect_monsters"; targetToughness: "twice_investigator_count" }
  | { type: "wild_space_ritual"; target: "card_defined" }
  | { type: "cast_spell"; target: "card_defined" }
  | { type: "collect_gates"; target: "half_investigator_count" };

export interface MysteryData {
  id: MysteryId;
  ancientOneId: AncientOneId;
  name: string;
  summaryRu: string;
  mechanic: MysteryMechanic;
  sourcePage: number;
  sourceSha256: string;
  verification: "reference_summary_only";
}

const sourceSha256 = "f17958795136f3c2ed4fe5292a6c3296490e64328f0792d3aadce4113a5c2bd8";

export const baseGameMysteries = [
  { id: "azathoth_occult_research", ancientOneId: "azathoth", name: "Occult Research", summaryRu: "После исследовательского контакта полученная улика может продвинуть тайну.", mechanic: { type: "collect_clues", trigger: "research_encounter", target: "investigator_count" }, sourcePage: 2, sourceSha256, verification: "reference_summary_only" },
  { id: "azathoth_omen_of_devastation", ancientOneId: "azathoth", name: "Omen of Devastation", summaryRu: "Закрытие врат текущего знамения и расход улик продвигают тайну.", mechanic: { type: "collect_eldritch_tokens", method: "close_matching_gate", target: "half_investigator_count" }, sourcePage: 2, sourceSha256, verification: "reference_summary_only" },
  { id: "azathoth_seed_of_the_daemon_sultan", ancientOneId: "azathoth", name: "Seed of the Daemon Sultan", summaryRu: "Особое расследование места падения небесного тела в Тунгуске.", mechanic: { type: "special_encounter", locationId: "tunguska", target: "card_defined" }, sourcePage: 2, sourceSha256, verification: "reference_summary_only" },
  { id: "azathoth_the_true_name", ancientOneId: "azathoth", name: "The True Name", summaryRu: "Сыщики находят жетоны Древних и тратят улики, чтобы перенести их на карту.", mechanic: { type: "collect_eldritch_tokens", method: "visit_token", target: "half_investigator_count" }, sourcePage: 2, sourceSha256, verification: "reference_summary_only" },
  { id: "cthulhu_rlyeh_risen", ancientOneId: "cthulhu", name: "R'lyeh Risen", summaryRu: "Особые контакты в Р'льехе на морской клетке 3 продвигают тайну.", mechanic: { type: "special_encounter", locationId: "space_3", target: "card_defined" }, sourcePage: 3, sourceSha256, verification: "reference_summary_only" },
  { id: "cthulhu_the_deep_ones_attack", ancientOneId: "cthulhu", name: "The Deep Ones Attack!", summaryRu: "Победа над глубоководными тварями в морских местах и расход улик продвигают тайну.", mechanic: { type: "collect_eldritch_tokens", method: "visit_token", target: "half_investigator_count" }, sourcePage: 3, sourceSha256, verification: "reference_summary_only" },
  { id: "cthulhu_the_stars_are_right", ancientOneId: "cthulhu", name: "The Stars Are Right!", summaryRu: "Полученные в исследовательских контактах улики переносятся на карту тайны.", mechanic: { type: "collect_clues", trigger: "research_encounter", target: "investigator_count" }, sourcePage: 3, sourceSha256, verification: "reference_summary_only" },
  { id: "cthulhu_watching_the_stars", ancientOneId: "cthulhu", name: "Watching the Stars", summaryRu: "Тайна решается победой над эпическим монстром Ктиллой.", mechanic: { type: "defeat_epic_monster", monsterId: "epic_monster_cthylla", spawnLocationId: "space_12" }, sourcePage: 3, sourceSha256, verification: "reference_summary_only" },
  { id: "shub_hunting_the_thousand", ancientOneId: "shub_niggurath", name: "Hunting the Thousand", summaryRu: "Побеждённые обычные монстры собираются до удвоенной стойкости от числа сыщиков.", mechanic: { type: "collect_monsters", targetToughness: "twice_investigator_count" }, sourcePage: 4, sourceSha256, verification: "reference_summary_only" },
  { id: "shub_nature_of_the_all_mother", ancientOneId: "shub_niggurath", name: "Nature of the All-Mother", summaryRu: "Полученные в исследовательских контактах улики переносятся на карту тайны.", mechanic: { type: "collect_clues", trigger: "research_encounter", target: "investigator_count" }, sourcePage: 4, sourceSha256, verification: "reference_summary_only" },
  { id: "shub_rituals_in_the_wild", ancientOneId: "shub_niggurath", name: "Rituals in the Wild", summaryRu: "Контакты в диких местностях и связанные жетоны продвигают тайну.", mechanic: { type: "wild_space_ritual", target: "card_defined" }, sourcePage: 4, sourceSha256, verification: "reference_summary_only" },
  { id: "shub_spawn_of_the_black_goat", ancientOneId: "shub_niggurath", name: "Spawn of the Black Goat", summaryRu: "Тайна решается победой над эпическим монстром Нугом.", mechanic: { type: "defeat_epic_monster", monsterId: "epic_monster_nug", spawnLocationId: "card_defined" }, sourcePage: 4, sourceSha256, verification: "reference_summary_only" },
  { id: "yog_arcane_understanding", ancientOneId: "yog_sothoth", name: "Arcane Understanding", summaryRu: "Успешное применение заклинания с расходом улики продвигает тайну.", mechanic: { type: "cast_spell", target: "card_defined" }, sourcePage: 5, sourceSha256, verification: "reference_summary_only" },
  { id: "yog_spawn_of_yog_sothoth", ancientOneId: "yog_sothoth", name: "Spawn of Yog-Sothoth", summaryRu: "Тайна решается победой над Данвичским ужасом в Аркхэме.", mechanic: { type: "defeat_epic_monster", monsterId: "epic_monster_dunwich_horror", spawnLocationId: "arkham" }, sourcePage: 5, sourceSha256, verification: "reference_summary_only" },
  { id: "yog_the_beyond_one", ancientOneId: "yog_sothoth", name: "The Beyond One", summaryRu: "Полученные в исследовательских контактах улики переносятся на карту тайны.", mechanic: { type: "collect_clues", trigger: "research_encounter", target: "investigator_count" }, sourcePage: 5, sourceSha256, verification: "reference_summary_only" },
  { id: "yog_where_the_old_ones_broke_through", ancientOneId: "yog_sothoth", name: "Where the Old Ones Broke Through", summaryRu: "Закрытые врата собираются на карте после сброса заклинаний.", mechanic: { type: "collect_gates", target: "half_investigator_count" }, sourcePage: 5, sourceSha256, verification: "reference_summary_only" },
] as const satisfies readonly MysteryData[];

const componentIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const mechanicSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("collect_clues"), trigger: z.literal("research_encounter"), target: z.literal("investigator_count") }).strict(),
  z.object({ type: z.literal("collect_eldritch_tokens"), method: z.enum(["close_matching_gate", "visit_token"]), target: z.literal("half_investigator_count") }).strict(),
  z.object({ type: z.literal("special_encounter"), locationId: componentIdSchema, target: z.literal("card_defined") }).strict(),
  z.object({ type: z.literal("defeat_epic_monster"), monsterId: componentIdSchema, spawnLocationId: componentIdSchema }).strict(),
  z.object({ type: z.literal("collect_monsters"), targetToughness: z.literal("twice_investigator_count") }).strict(),
  z.object({ type: z.literal("wild_space_ritual"), target: z.literal("card_defined") }).strict(),
  z.object({ type: z.literal("cast_spell"), target: z.literal("card_defined") }).strict(),
  z.object({ type: z.literal("collect_gates"), target: z.literal("half_investigator_count") }).strict(),
]);

const mysterySchema = z.object({
  id: z.enum(mysteryIds),
  ancientOneId: z.enum(["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"]),
  name: z.string().min(1),
  summaryRu: z.string().min(1),
  mechanic: mechanicSchema,
  sourcePage: z.number().int().min(2).max(5),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  verification: z.literal("reference_summary_only"),
}).strict();

export function validateMysteryContent(mysteries: readonly MysteryData[]): void {
  const parsed = z.array(mysterySchema).parse(mysteries);
  const ids = new Set(parsed.map((mystery) => mystery.id));
  if (ids.size !== parsed.length) throw new Error("Mystery content contains duplicate IDs.");
  if (ids.size !== mysteryIds.length || mysteryIds.some((id) => !ids.has(id))) {
    throw new Error("Mystery content does not match the base-game roster.");
  }
  for (const ancientOneId of ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"] as const) {
    if (parsed.filter((mystery) => mystery.ancientOneId === ancientOneId).length !== 4) {
      throw new Error(`${ancientOneId} must have exactly four Mysteries.`);
    }
  }
}

validateMysteryContent(baseGameMysteries);
