import { z } from "zod";

const assetDefinitions = [
  ["spirit_dagger", "Spirit Dagger"], ["holy_water", "Holy Water"], ["private_care", "Private Care"],
  ["bull_whip", "Bull Whip"], ["axe", "Axe"], ["personal_assistant", "Personal Assistant"],
  ["puzzle_box", "Puzzle Box"], ["lodge_researcher", "Lodge Researcher"], ["fishing_net", "Fishing Net"],
  ["hired_muscle", "Hired Muscle"], ["bandages", "Bandages"], ["private_investigator", "Private Investigator"],
  ["18_derringer", ".18 Derringer"], ["double_barreled_shotgun", "Double-barreled Shotgun"],
  ["arcane_scholar", "Arcane Scholar"], ["arcane_manuscripts", "Arcane Manuscripts"], ["dynamite", "Dynamite"],
  ["fine_clothes", "Fine Clothes"], ["cat_burglar", "Cat Burglar"], ["lucky_cigarette_case", "Lucky Cigarette Case"],
  ["protective_amulet", "Protective Amulet"], ["vatican_missionary", "Vatican Missionary"], ["whiskey", "Whiskey"],
  ["kerosene", "Kerosene"], ["delivery_service", "Delivery Service"], ["silver_twilight_ritual", "Silver Twilight Ritual"],
  ["pocket_watch", "Pocket Watch"], ["carbine_rifle", "Carbine Rifle"], ["45_automatic", ".45 Automatic"],
  ["38_revolver", ".38 Revolver"], ["sanctuary", "Sanctuary"], ["urban_guide", "Urban Guide"],
  ["charter_flight", "Charter Flight"], ["witch_doctor", "Witch Doctor"], ["lucky_rabbits_foot", "Lucky Rabbit's Foot"],
  ["wireless_report", "Wireless Report"], ["arcane_tome", "Arcane Tome"], ["king_james_bible", "King James Bible"],
  ["agency_quarantine", "Agency Quarantine"], ["holy_cross", "Holy Cross"],
] as const;

export const assetIds = assetDefinitions.map(([slug]) => `asset_${slug}` as const);
export type AssetId = (typeof assetIds)[number];

export interface AssetCardData {
  id: AssetId;
  name: string;
  imageUrl: string;
  backImageUrl: "/cards/assets/back.webp";
  verification: "front_verified_from_scan";
  rulesStatus: "pending_verified_transcription";
}

export const baseGameAssets: readonly AssetCardData[] = assetDefinitions.map(([slug, name]) => ({
  id: `asset_${slug}`,
  name,
  imageUrl: `/cards/assets/${slug}.webp`,
  backImageUrl: "/cards/assets/back.webp",
  verification: "front_verified_from_scan",
  rulesStatus: "pending_verified_transcription",
}));

const assetSchema = z.object({
  id: z.string().regex(/^asset_[a-z0-9_]+$/),
  name: z.string().min(1),
  imageUrl: z.string().regex(/^\/cards\/assets\/[a-z0-9_]+\.webp$/),
  backImageUrl: z.literal("/cards/assets/back.webp"),
  verification: z.literal("front_verified_from_scan"),
  rulesStatus: z.literal("pending_verified_transcription"),
}).strict();

export function validateAssetContent(assets: readonly AssetCardData[]): void {
  const parsed = z.array(assetSchema).length(40).parse(assets);
  const ids = new Set(parsed.map(({ id }) => id));
  if (ids.size !== parsed.length) throw new Error("Asset content contains duplicate IDs.");
  const names = new Set(parsed.map(({ name }) => name));
  if (names.size !== parsed.length) throw new Error("Asset content contains duplicate names.");
}

validateAssetContent(baseGameAssets);
