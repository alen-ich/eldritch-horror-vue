import { z } from "zod";
import { baseGameAssetDefinitions } from "./assets.generated.js";

export const assetTraits = ["ally", "item", "magical", "service", "teamwork", "tome", "trinket", "weapon"] as const;
export type AssetTrait = (typeof assetTraits)[number];

export const assetAbilityTypes = [
  "action", "combat_consumable", "on_gain", "once_per_round", "passive", "passive_and_action",
  "passive_and_rest_trigger", "passive_aura", "reaction", "rest_trigger", "triggered_passive",
] as const;
export type AssetAbilityType = (typeof assetAbilityTypes)[number];

export const assetIds = baseGameAssetDefinitions.map(({ id }) => id);
export type AssetId = (typeof baseGameAssetDefinitions)[number]["id"];

export interface AssetCardData {
  id: AssetId;
  name: string;
  value: number;
  traits: readonly AssetTrait[];
  abilityType: AssetAbilityType;
  effectText: string;
  sourceImageFilename: string;
  imageUrl: string;
  backImageUrl: "/cards/assets/back.webp";
  verification: "artwork_verified_from_scan";
  rulesStatus: "transcribed_pending_execution";
}

export const baseGameAssets: readonly AssetCardData[] = baseGameAssetDefinitions.map((definition) => ({
  ...definition,
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
