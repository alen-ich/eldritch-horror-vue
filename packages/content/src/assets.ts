import { z } from "zod";
import { baseGameAssetDefinitions } from "./assets.generated.js";

export const assetTraits = ["ally", "item", "magical", "service", "teamwork", "tome", "trinket", "weapon"] as const;
export type AssetTrait = (typeof assetTraits)[number];

export const assetAbilityTypes = [
  "action", "combat_consumable", "on_gain", "once_per_round", "passive", "passive_and_action",
  "passive_and_rest_trigger", "passive_aura", "reaction", "rest_trigger", "triggered_passive",
] as const;
export type AssetAbilityType = (typeof assetAbilityTypes)[number];

export type AssetEngineEffect =
  | { type: "round_test_die_increment"; amount: 1 }
  | { type: "discard_prevent_sanity_loss"; amount: 2 }
  | { type: "discard_prevent_health_loss"; amount: 2 }
  | { type: "round_test_reroll" }
  | { type: "test_reroll"; skill: "influence" | "strength" }
  | { type: "city_test_aura"; amount: 1 }
  | { type: "skill_bonus"; skill: "influence" | "strength"; amount: 1 }
  | { type: "acquire_six_counts_as_two" }
  | { type: "rest_recover_additional_sanity"; amount: 1 }
  | { type: "rest_health_or_discard_cursed"; amount: 1 }
  | { type: "rest_test_gain_artifact"; skill: "observation"; modifier: -2 }
  | { type: "on_gain_recover_all_and_discard" };

export const assetIds = baseGameAssetDefinitions.map(({ id }) => id);
export type AssetId = (typeof baseGameAssetDefinitions)[number]["id"];

export interface AssetCardData {
  id: AssetId;
  name: string;
  value: number;
  traits: readonly AssetTrait[];
  abilityType: AssetAbilityType;
  effectText: string;
  engineEffects: readonly AssetEngineEffect[];
  /** Verified applicability to ordinary location/Research, not combat or Other World. */
  nonCombatEncounterSupport: "unsupported" | "irrelevant" | "city_test_aura" | "skill_test" | "health_prevention" | "sanity_prevention";
  sourceImageFilename: string;
  imageUrl: string;
  backImageUrl: "/cards/assets/back.webp";
  verification: "artwork_verified_from_scan";
  rulesStatus: "transcribed_pending_execution";
}

const engineEffectsByAssetId: Readonly<Partial<Record<AssetId, readonly AssetEngineEffect[]>>> = {
  asset_personal_assistant: [{ type: "skill_bonus", skill: "influence", amount: 1 }, { type: "test_reroll", skill: "influence" }],
  asset_fine_clothes: [{ type: "acquire_six_counts_as_two" }],
  asset_king_james_bible: [{ type: "rest_recover_additional_sanity", amount: 1 }],
  asset_witch_doctor: [{ type: "rest_health_or_discard_cursed", amount: 1 }],
  asset_puzzle_box: [{ type: "rest_test_gain_artifact", skill: "observation", modifier: -2 }],
  asset_private_care: [{ type: "on_gain_recover_all_and_discard" }],
  asset_urban_guide: [{ type: "city_test_aura", amount: 1 }],
  asset_lucky_rabbits_foot: [{ type: "round_test_reroll" }],
  asset_hired_muscle: [{ type: "skill_bonus", skill: "strength", amount: 1 }, { type: "test_reroll", skill: "strength" }],
  asset_bandages: [{ type: "discard_prevent_health_loss", amount: 2 }],
  asset_whiskey: [{ type: "discard_prevent_sanity_loss", amount: 2 }],
  asset_lucky_cigarette_case: [{ type: "round_test_die_increment", amount: 1 }],
};

// Explicitly scan-verified scopes. An empty effect list alone never means safe.
const nonCombatIrrelevantAssetIds: readonly string[] = [
  "asset_arcane_manuscripts", "asset_fine_clothes", "asset_king_james_bible",
  "asset_protective_amulet", "asset_38_revolver", "asset_45_automatic", "asset_holy_cross",
  "asset_witch_doctor",
  "asset_puzzle_box",
];

export const baseGameAssets: readonly AssetCardData[] = baseGameAssetDefinitions.map((definition) => ({
  ...definition,
  engineEffects: engineEffectsByAssetId[definition.id] ?? [],
  nonCombatEncounterSupport: definition.id === "asset_whiskey" ? "sanity_prevention" : definition.id === "asset_bandages" ? "health_prevention" : ["asset_personal_assistant", "asset_lucky_rabbits_foot", "asset_hired_muscle", "asset_lucky_cigarette_case"].includes(definition.id) ? "skill_test" : definition.id === "asset_urban_guide" ? "city_test_aura" : nonCombatIrrelevantAssetIds.includes(definition.id) ? "irrelevant" : "unsupported",
  imageUrl: `/cards/assets/${definition.id.slice("asset_".length)}.webp`,
  backImageUrl: "/cards/assets/back.webp",
  verification: "artwork_verified_from_scan",
  rulesStatus: "transcribed_pending_execution",
}));

const assetSchema = z.object({
  id: z.string().regex(/^asset_[a-z0-9_]+$/),
  name: z.string().min(1),
  value: z.number().int().min(1).max(4),
  traits: z.array(z.enum(assetTraits)).min(1),
  abilityType: z.enum(assetAbilityTypes),
  effectText: z.string().min(1),
  engineEffects: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("round_test_die_increment"), amount: z.literal(1) }).strict(),
    z.object({ type: z.literal("discard_prevent_sanity_loss"), amount: z.literal(2) }).strict(),
    z.object({ type: z.literal("discard_prevent_health_loss"), amount: z.literal(2) }).strict(),
    z.object({ type: z.literal("round_test_reroll") }).strict(),
    z.object({ type: z.literal("test_reroll"), skill: z.enum(["influence", "strength"]) }).strict(),
    z.object({ type: z.literal("city_test_aura"), amount: z.literal(1) }).strict(),
    z.object({ type: z.literal("skill_bonus"), skill: z.enum(["influence", "strength"]), amount: z.literal(1) }).strict(),
    z.object({ type: z.literal("acquire_six_counts_as_two") }).strict(),
    z.object({ type: z.literal("rest_recover_additional_sanity"), amount: z.literal(1) }).strict(),
    z.object({ type: z.literal("rest_health_or_discard_cursed"), amount: z.literal(1) }).strict(),
    z.object({ type: z.literal("rest_test_gain_artifact"), skill: z.literal("observation"), modifier: z.literal(-2) }).strict(),
    z.object({ type: z.literal("on_gain_recover_all_and_discard") }).strict(),
  ])),
  nonCombatEncounterSupport: z.enum(["unsupported", "irrelevant", "city_test_aura", "skill_test", "health_prevention", "sanity_prevention"]),
  sourceImageFilename: z.string().regex(/^\d{2}_[a-z0-9_]+\.jpg$/),
  imageUrl: z.string().regex(/^\/cards\/assets\/[a-z0-9_]+\.webp$/),
  backImageUrl: z.literal("/cards/assets/back.webp"),
  verification: z.literal("artwork_verified_from_scan"),
  rulesStatus: z.literal("transcribed_pending_execution"),
}).strict();

export function validateAssetContent(assets: readonly AssetCardData[]): void {
  const parsed = z.array(assetSchema).length(40).parse(assets);
  const ids = new Set(parsed.map(({ id }) => id));
  if (ids.size !== parsed.length) throw new Error("Asset content contains duplicate IDs.");
  const names = new Set(parsed.map(({ name }) => name));
  if (names.size !== parsed.length) throw new Error("Asset content contains duplicate names.");
  for (const asset of parsed) {
    const slug = asset.id.slice("asset_".length);
    if (asset.imageUrl !== `/cards/assets/${slug}.webp`) throw new Error(`Asset image does not match its ID: ${asset.id}.`);
    if (!asset.sourceImageFilename.endsWith(`_${slug}.jpg`)) throw new Error(`Asset source image does not match its ID: ${asset.id}.`);
  }
}

validateAssetContent(baseGameAssets);
