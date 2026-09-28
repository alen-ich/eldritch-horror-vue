import { investigatorIds, locationIds, type InvestigatorId, type LocationId } from "@eldritch/protocol";
import { z } from "zod";
import type { AssetId } from "./assets.js";

export const skillNames = ["lore", "influence", "observation", "strength", "will"] as const;
export type SkillName = (typeof skillNames)[number];

export interface InvestigatorData {
  id: InvestigatorId;
  name: string;
  occupation: string;
  health: number;
  sanity: number;
  skills: Readonly<Record<SkillName, number>>;
  startingLocationId: LocationId;
  startingEquipment: readonly string[];
  startingAssetIds: readonly AssetId[];
  startingClues: number;
  role: string;
  actionAbility: string;
  passiveAbility: string;
}

export const baseGameInvestigators: readonly InvestigatorData[] = [
  { id: "akachi_onyele", name: "Akachi Onyele", occupation: "Shaman", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingLocationId: "space_15", startingEquipment: ["Mists of Releh Spell", "1 Clue"], startingAssetIds: [], startingClues: 1, role: "Gate closer / mobility", actionAbility: "Look at the top 2 Gate tokens; return one to the top and one to the bottom of the stack.", passiveAbility: "After closing a Gate, she may move to any space containing a Gate or Clue." },
  { id: "charlie_kane", name: "Charlie Kane", occupation: "Politician", health: 4, sanity: 8, skills: { lore: 2, influence: 4, observation: 3, strength: 2, will: 2 }, startingLocationId: "san_francisco", startingEquipment: ["Personal Assistant Asset"], startingAssetIds: ["asset_personal_assistant"], startingClues: 0, role: "Support / asset economy", actionAbility: "Choose another investigator to immediately perform 1 additional action.", passiveAbility: "During his Acquire Assets action, purchased cards may be given directly to other investigators." },
  { id: "diana_stanley", name: "Diana Stanley", occupation: "Redeemed Cultist", health: 7, sanity: 5, skills: { lore: 4, influence: 2, observation: 3, strength: 3, will: 1 }, startingLocationId: "space_7", startingEquipment: ["Arcane Manuscripts Asset", "Wither Spell"], startingAssetIds: ["asset_arcane_manuscripts"], startingClues: 0, role: "Magic / monster control", actionAbility: "If a Cultist is on her space, either discard every Monster there or move one Cultist to any space.", passiveAbility: "Reduces Horror loss from Combat Encounters by 1." },
  { id: "jacqueline_fine", name: "Jacqueline Fine", occupation: "Psychic", health: 4, sanity: 8, skills: { lore: 4, influence: 2, observation: 3, strength: 1, will: 3 }, startingLocationId: "space_5", startingEquipment: ["Flesh Ward Spell", "1 Clue"], startingAssetIds: [], startingClues: 1, role: "Support / research / magic", actionAbility: "Trade any number of Clues with an investigator anywhere on the board.", passiveAbility: "Once per round, when another investigator gains a Condition, she may inspect its back and gain 1 Clue." },
  { id: "jim_culver", name: "Jim Culver", occupation: "Musician", health: 7, sanity: 5, skills: { lore: 3, influence: 3, observation: 2, strength: 2, will: 3 }, startingLocationId: "space_6", startingEquipment: ["Shriveling Spell", "1 Clue"], startingAssetIds: [], startingClues: 1, role: "Support / combat", actionAbility: "Each investigator on his space recovers 1 Sanity.", passiveAbility: "Investigators on his space roll 1 extra die during Combat Encounters." },
  { id: "leo_anderson", name: "Leo Anderson", occupation: "Expedition Leader", health: 6, sanity: 6, skills: { lore: 2, influence: 2, observation: 3, strength: 3, will: 3 }, startingLocationId: "buenos_aires", startingEquipment: ["Hired Muscle Asset"], startingAssetIds: ["asset_hired_muscle"], startingClues: 0, role: "Expedition / all-rounder", actionAbility: "Test Influence; on success, gain an Ally of choice from the reserve or discard pile.", passiveAbility: "Investigators on his Wilderness space roll 1 additional die on tests." },
  { id: "lily_chen", name: "Lily Chen", occupation: "Martial Artist", health: 6, sanity: 6, skills: { lore: 2, influence: 2, observation: 2, strength: 4, will: 3 }, startingLocationId: "shanghai", startingEquipment: ["Protective Amulet Asset", "Lucky Rabbit's Foot Asset"], startingAssetIds: ["asset_protective_amulet", "asset_lucky_rabbits_foot"], startingClues: 0, role: "Combat / development", actionAbility: "Convert Health to Sanity, or Sanity to Health, on a one-for-one basis.", passiveAbility: "When improving a skill, she may improve it twice instead of once." },
  { id: "lola_hayes", name: "Lola Hayes", occupation: "Actress", health: 5, sanity: 7, skills: { lore: 2, influence: 4, observation: 2, strength: 2, will: 3 }, startingLocationId: "tokyo", startingEquipment: [".18 Derringer Asset", "Improve 1 skill of choice"], startingAssetIds: ["asset_18_derringer"], startingClues: 0, role: "Flexible support", actionAbility: "Spend improvement tokens and redistribute them, improving one chosen skill for each token spent.", passiveAbility: "Once per round, an investigator on her space may roll 1 additional die for a test." },
  { id: "mark_harrigan", name: "Mark Harrigan", occupation: "Soldier", health: 8, sanity: 4, skills: { lore: 1, influence: 2, observation: 2, strength: 4, will: 4 }, startingLocationId: "space_14", startingEquipment: [".38 Revolver Asset", "Kerosene Asset"], startingAssetIds: ["asset_38_revolver", "asset_kerosene"], startingClues: 0, role: "Combat", actionAbility: "He and one Monster on his space each lose 1 Health.", passiveAbility: "Cannot become Delayed or Detained unless he chooses to." },
  { id: "norman_withers", name: "Norman Withers", occupation: "Astronomer", health: 5, sanity: 7, skills: { lore: 3, influence: 1, observation: 3, strength: 2, will: 4 }, startingLocationId: "arkham", startingEquipment: ["Feed the Mind Spell"], startingAssetIds: [], startingClues: 0, role: "Gate closer / magic", actionAbility: "Spend 2 Clues to discard a Monster on a space that contains a Gate.", passiveAbility: "Once per round, may spend 1 Sanity instead of spending 1 Clue." },
  { id: "silas_marsh", name: "Silas Marsh", occupation: "Sailor", health: 8, sanity: 4, skills: { lore: 1, influence: 3, observation: 3, strength: 3, will: 3 }, startingLocationId: "sydney", startingEquipment: ["Fishing Net Asset"], startingAssetIds: ["asset_fishing_net"], startingClues: 0, role: "Sea mobility / combat", actionAbility: "Move 1 space along a Ship path, then perform 1 additional action.", passiveAbility: "Investigators on Sea spaces roll 1 additional die on tests." },
  { id: "trish_scarborough", name: "Trish Scarborough", occupation: "Spy", health: 7, sanity: 5, skills: { lore: 1, influence: 3, observation: 4, strength: 3, will: 2 }, startingLocationId: "space_16", startingEquipment: [".45 Automatic Asset"], startingAssetIds: ["asset_45_automatic"], startingClues: 0, role: "Research / clue efficiency", actionAbility: "If she has no Clues, gain 1 Clue.", passiveAbility: "When an investigator on her space spends a Clue to reroll, that investigator may reroll up to 2 dice." },
] as const;

const investigatorSchema = z.object({
  id: z.enum(investigatorIds), name: z.string().min(1), occupation: z.string().min(1),
  health: z.number().int().positive(), sanity: z.number().int().positive(),
  skills: z.object(Object.fromEntries(skillNames.map((skill) => [skill, z.number().int().min(1).max(4)])) as Record<SkillName, z.ZodNumber>),
  startingLocationId: z.enum(locationIds), startingEquipment: z.array(z.string().min(1)),
  startingAssetIds: z.array(z.string().regex(/^asset_[a-z0-9_]+$/)),
  startingClues: z.number().int().nonnegative(),
  role: z.string().min(1), actionAbility: z.string().min(1), passiveAbility: z.string().min(1),
});

export function validateInvestigatorContent(investigators: readonly InvestigatorData[]): void {
  const parsed = z.array(investigatorSchema).parse(investigators);
  const ids = new Set(parsed.map((investigator) => investigator.id));
  if (ids.size !== parsed.length) throw new Error("Investigator content contains duplicate IDs.");
  if (ids.size !== investigatorIds.length || investigatorIds.some((id) => !ids.has(id))) {
    throw new Error("Investigator content does not match the protocol roster.");
  }
}

validateInvestigatorContent(baseGameInvestigators);
