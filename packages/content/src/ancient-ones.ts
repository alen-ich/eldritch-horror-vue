import { locationIds } from "@eldritch/protocol";
import { z } from "zod";

export const ancientOneIds = ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"] as const;
export type AncientOneId = (typeof ancientOneIds)[number];

export interface MythosStageComposition {
  green: number;
  yellow: number;
  blue: number;
}

export type AncientOneSetupInstruction =
  | { type: "set_aside_monster"; monsterId: string; quantity: number }
  | { type: "set_aside_encounter_deck"; deckId: string }
  | { type: "place_eldritch_token_on_omen"; omen: "green"; quantity: number };

export type FinalMystery =
  | { type: "defeat_epic_monster"; monsterId: string; spawnLocationId?: string; mysteriesRequired?: number }
  | { type: "special_encounter_progress"; deckId: string; eligibleSpace: "gate"; target: "half_investigators" }
  | { type: "immediate_loss" };

export interface AncientOneData {
  id: AncientOneId;
  name: string;
  epithet: string;
  startingDoom: number;
  mythosDeck: readonly [MythosStageComposition, MythosStageComposition, MythosStageComposition];
  setup: readonly AncientOneSetupInstruction[];
  frontEffectIds: readonly string[];
  awakenedEffectIds: readonly string[];
  cultist: {
    normalToughness: number;
    awakenedToughness?: number;
    normalEffectIds: readonly string[];
    awakenedEffectIds: readonly string[];
  };
  finalMystery: FinalMystery;
  imageUrl: string;
  sourceSha256: string;
}

export const baseGameAncientOnes = [
  {
    id: "cthulhu",
    name: "Cthulhu",
    epithet: "The Madness from the Sea",
    startingDoom: 12,
    mythosDeck: [
      { green: 0, yellow: 2, blue: 2 },
      { green: 1, yellow: 3, blue: 0 },
      { green: 3, yellow: 4, blue: 0 },
    ],
    setup: [
      { type: "set_aside_monster", monsterId: "monster_deep_one", quantity: 1 },
      { type: "set_aside_monster", monsterId: "monster_star_spawn", quantity: 1 },
      { type: "set_aside_encounter_deck", deckId: "special_encounter_cthulhu" },
    ],
    frontEffectIds: ["cthulhu_eldritch_space_entry", "cthulhu_sea_reckoning", "win_after_three_mysteries", "awaken_at_zero_doom"],
    awakenedEffectIds: ["cthulhu_eldritch_space_entry_awakened", "cthulhu_replace_doom_with_sanity", "cthulhu_sanity_reckoning_loss"],
    cultist: {
      normalToughness: 1,
      awakenedToughness: 2,
      normalEffectIds: ["cthulhu_cultist_pre_will_sanity_loss_1"],
      awakenedEffectIds: ["cthulhu_cultist_pre_will_sanity_loss_2"],
    },
    finalMystery: {
      type: "defeat_epic_monster",
      monsterId: "epic_monster_cthulhu",
      spawnLocationId: "space_3",
      mysteriesRequired: 3,
    },
    imageUrl: "/ancient-ones/cthulhu.jpg",
    sourceSha256: "e408dceaf95bc679579b1e40d30bb688191ad06be80925d6efab24daadb8e77a",
  },
  {
    id: "shub_niggurath",
    name: "Shub-Niggurath",
    epithet: "The Black Goat of the Woods",
    startingDoom: 13,
    mythosDeck: [
      { green: 1, yellow: 2, blue: 1 },
      { green: 3, yellow: 2, blue: 1 },
      { green: 2, yellow: 4, blue: 0 },
    ],
    setup: [
      { type: "set_aside_monster", monsterId: "monster_ghoul", quantity: 2 },
      { type: "set_aside_monster", monsterId: "monster_goat_spawn", quantity: 2 },
      { type: "set_aside_monster", monsterId: "monster_dark_young", quantity: 1 },
    ],
    frontEffectIds: ["shub_spawn_random_monster_reckoning", "shub_advance_doom_at_ten_monsters", "win_after_three_mysteries", "shub_awaken"],
    awakenedEffectIds: ["shub_spawn_epic_and_gather_brood", "shub_replace_doom_with_monster_spawn", "shub_loss_at_six_monsters", "shub_force_epic_encounter_reckoning"],
    cultist: {
      normalToughness: 1,
      awakenedToughness: 2,
      normalEffectIds: ["shub_cultist_reckoning_spawn_brood_then_discard"],
      awakenedEffectIds: ["shub_cultist_reckoning_move_toward_epic"],
    },
    finalMystery: {
      type: "defeat_epic_monster",
      monsterId: "epic_monster_shub_niggurath",
      spawnLocationId: "the_heart_of_africa",
    },
    imageUrl: "/ancient-ones/shub-niggurath.jpg",
    sourceSha256: "97c854976158540c0f66f107ffd95344151bb4427c3aa7664771503c5f4d4e8d",
  },
  {
    id: "yog_sothoth",
    name: "Yog-Sothoth",
    epithet: "The Lurker at the Threshold",
    startingDoom: 14,
    mythosDeck: [
      { green: 0, yellow: 2, blue: 1 },
      { green: 2, yellow: 3, blue: 1 },
      { green: 3, yellow: 4, blue: 0 },
    ],
    setup: [{ type: "set_aside_encounter_deck", deckId: "special_encounter_yog_sothoth" }],
    frontEffectIds: ["yog_gate_reckoning_doom_or_spell", "win_after_three_mysteries", "awaken_at_zero_doom"],
    awakenedEffectIds: ["yog_replace_gate_doom_with_sheet_gate", "yog_loss_at_three_sheet_gates", "yog_gate_reckoning_move_gate_or_spell"],
    cultist: {
      normalToughness: 1,
      awakenedToughness: 1,
      normalEffectIds: ["yog_cultist_defeat_sanity_loss_and_spell_gain"],
      awakenedEffectIds: ["yog_cultist_pre_will_sanity_per_spell"],
    },
    finalMystery: {
      type: "special_encounter_progress",
      deckId: "special_encounter_yog_sothoth",
      eligibleSpace: "gate",
      target: "half_investigators",
    },
    imageUrl: "/ancient-ones/yog-sothoth.jpg",
    sourceSha256: "8eb06883e088b22b8007d3bdc7ddf0172a7e6fcef69b15e07e33dd68ba48bb9a",
  },
  {
    id: "azathoth",
    name: "Azathoth",
    epithet: "The Daemon Sultan",
    startingDoom: 15,
    mythosDeck: [
      { green: 1, yellow: 2, blue: 1 },
      { green: 2, yellow: 3, blue: 1 },
      { green: 2, yellow: 4, blue: 0 },
    ],
    setup: [{ type: "place_eldritch_token_on_omen", omen: "green", quantity: 1 }],
    frontEffectIds: ["azathoth_green_omen_eldritch_doom", "win_after_three_mysteries", "azathoth_awaken"],
    awakenedEffectIds: ["azathoth_immediate_loss"],
    cultist: {
      normalToughness: 1,
      normalEffectIds: ["azathoth_cultist_post_will_health_loss_and_defeat"],
      awakenedEffectIds: [],
    },
    finalMystery: { type: "immediate_loss" },
    imageUrl: "/ancient-ones/azathoth.jpg",
    sourceSha256: "82ed63b0bfc31586b2e8ac2d3996a646c15528626105eff5fe56cfe1ae8900d1",
  },
] as const satisfies readonly AncientOneData[];

const effectIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const componentIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const mythosStageSchema = z.object({
  green: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  blue: z.number().int().nonnegative(),
}).strict();
const setupInstructionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_aside_monster"), monsterId: componentIdSchema, quantity: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("set_aside_encounter_deck"), deckId: componentIdSchema }).strict(),
  z.object({ type: z.literal("place_eldritch_token_on_omen"), omen: z.literal("green"), quantity: z.number().int().positive() }).strict(),
]);
const finalMysterySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("defeat_epic_monster"),
    monsterId: componentIdSchema,
    spawnLocationId: z.enum(locationIds).optional(),
    mysteriesRequired: z.number().int().positive().optional(),
  }).strict(),
  z.object({
    type: z.literal("special_encounter_progress"),
    deckId: componentIdSchema,
    eligibleSpace: z.literal("gate"),
    target: z.literal("half_investigators"),
  }).strict(),
  z.object({ type: z.literal("immediate_loss") }).strict(),
]);
const ancientOneSchema = z.object({
  id: z.enum(ancientOneIds),
  name: z.string().min(1),
  epithet: z.string().min(1),
  startingDoom: z.number().int().positive(),
  mythosDeck: z.tuple([mythosStageSchema, mythosStageSchema, mythosStageSchema]),
  setup: z.array(setupInstructionSchema),
  frontEffectIds: z.array(effectIdSchema).min(1),
  awakenedEffectIds: z.array(effectIdSchema).min(1),
  cultist: z.object({
    normalToughness: z.number().int().positive(),
    awakenedToughness: z.number().int().positive().optional(),
    normalEffectIds: z.array(effectIdSchema),
    awakenedEffectIds: z.array(effectIdSchema),
  }).strict(),
  finalMystery: finalMysterySchema,
  imageUrl: z.string().regex(/^\/ancient-ones\/[a-z-]+\.jpg$/),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export function validateAncientOneContent(ancientOnes: readonly AncientOneData[]): void {
  const parsed = z.array(ancientOneSchema).parse(ancientOnes);
  const ids = new Set(parsed.map((ancientOne) => ancientOne.id));
  if (ids.size !== parsed.length) throw new Error("Ancient One content contains duplicate IDs.");
  if (ids.size !== ancientOneIds.length || ancientOneIds.some((id) => !ids.has(id))) {
    throw new Error("Ancient One content does not match the base-game roster.");
  }
  for (const ancientOne of parsed) {
    if (ancientOne.mythosDeck.some((stage) => stage.green + stage.yellow + stage.blue === 0)) {
      throw new Error(`${ancientOne.id} has an empty Mythos stage.`);
    }
  }
}

validateAncientOneContent(baseGameAncientOnes);
