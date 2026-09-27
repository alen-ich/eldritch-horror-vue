import { z } from "zod";

export type MonsterType = "normal" | "epic";
export type MonsterSkill = "will" | "strength";

export interface MonsterCombatCheck {
  skill: MonsterSkill;
  modifier: number;
  damage: number;
}

export interface MonsterToughness {
  base: number;
  perInvestigator: number;
}

export interface MonsterData {
  id: string;
  name: string;
  type: MonsterType;
  set: "core";
  count: number;
  horrorCheck: MonsterCombatCheck | null | "ancient_one";
  damageCheck: MonsterCombatCheck | null | "ancient_one";
  toughness: MonsterToughness | "ancient_one";
  spawnEffect?: string;
  reckoningEffect?: string;
  specialEffect?: string;
  imageUrl: string;
  wikiPageUrl: string;
}

const normal = (
  id: string,
  name: string,
  count: number,
  horrorCheck: MonsterData["horrorCheck"],
  damageCheck: MonsterData["damageCheck"],
  toughness: MonsterData["toughness"],
  effects: Pick<MonsterData, "spawnEffect" | "reckoningEffect" | "specialEffect"> = {},
): MonsterData => ({
  id: `monster_${id}`,
  name,
  type: "normal",
  set: "core",
  count,
  horrorCheck,
  damageCheck,
  toughness,
  ...effects,
  imageUrl: `/monsters/monster_${id}.webp`,
  wikiPageUrl: `https://eldritchhorror.fandom.com/wiki/${name.replaceAll(" ", "_")}`,
});

const epic = (
  id: string,
  name: string,
  horrorCheck: MonsterCombatCheck | null,
  damageCheck: MonsterCombatCheck | null,
  toughness: MonsterToughness,
  effects: Pick<MonsterData, "spawnEffect" | "reckoningEffect" | "specialEffect"> = {},
  pageName = name,
): MonsterData => ({
  id: `epic_monster_${id}`,
  name,
  type: "epic",
  set: "core",
  count: 1,
  horrorCheck,
  damageCheck,
  toughness,
  ...effects,
  imageUrl: `/monsters/epic_monster_${id}.webp`,
  wikiPageUrl: `https://eldritchhorror.fandom.com/wiki/${pageName.replaceAll(" ", "_")}`,
});

const will = (modifier: number, damage: number): MonsterCombatCheck => ({ skill: "will", modifier, damage });
const strength = (modifier: number, damage: number): MonsterCombatCheck => ({ skill: "strength", modifier, damage });
const fixed = (base: number): MonsterToughness => ({ base, perInvestigator: 0 });
const scaling = (base: number): MonsterToughness => ({ base, perInvestigator: 1 });

export const baseGameMonsters: readonly MonsterData[] = [
  normal("byakhee", "Byakhee", 1, will(0, 1), strength(0, 2), fixed(2), {
    specialEffect: "After defeating this Monster during a Combat Encounter, the investigator may lose 1 Sanity and move 3 spaces instead of resolving another encounter.",
  }),
  normal("colour_out_of_space", "Colour Out of Space", 1, will(0, 2), null, fixed(2), {
    spawnEffect: "Move this Monster to Tunguska.",
    specialEffect: "After the Will test, roll 1 die; on a 5 or 6, defeat this Monster.",
  }),
  normal("cultist", "Cultist", 5, "ancient_one", "ancient_one", "ancient_one", {
    specialEffect: "Combat statistics and effects are defined by the selected Ancient One.",
  }),
  normal("cthonian", "Cthonian", 1, will(-1, 2), strength(-2, 3), fixed(4), {
    spawnEffect: "Move this Monster to The Heart of Africa.",
  }),
  normal("dark_young", "Dark Young", 1, will(-1, 3), strength(-3, 3), fixed(5), {
    reckoningEffect: "Roll 1 die; on a 1 or 2, advance Doom by 1.",
  }),
  normal("deep_one", "Deep One", 1, will(0, 2), strength(-1, 1), fixed(2), {
    reckoningEffect: "Each investigator on this space loses 1 Sanity.",
  }),
  normal("elder_thing", "Elder Thing", 1, will(0, 3), strength(-1, 2), fixed(3), {
    spawnEffect: "Move this Monster to Antarctica.",
  }),
  normal("ghost", "Ghost", 1, will(-1, 2), null, fixed(2), {
    specialEffect: "If the investigator passes the Will test, this Monster loses Health equal to the test result.",
  }),
  normal("ghoul", "Ghoul", 2, will(1, 1), strength(0, 2), fixed(1), {
    specialEffect: "If the investigator loses Health from the Strength test, they gain a Paranoia Condition.",
  }),
  normal("gnoph_keh", "Gnoph-Keh", 1, will(0, 1), strength(-2, 2), fixed(3), {
    spawnEffect: "Move this Monster to The Himalayas.",
    reckoningEffect: "Each investigator on this space loses 1 Health.",
  }),
  normal("goat_spawn", "Goat Spawn", 2, will(0, 1), strength(-2, 2), fixed(2), {
    specialEffect: "After defeating this Monster during a Combat Encounter, the investigator may gain a Dark Pact Condition to discard 1 Monster from any space.",
  }),
  normal("gug", "Gug", 1, will(0, 2), strength(-2, 3), fixed(4), {
    specialEffect: "After defeating this Monster during a Combat Encounter, the investigator does not resolve an additional encounter.",
  }),
  normal("hound_of_tindalos", "Hound of Tindalos", 1, will(0, 2), strength(-1, 3), fixed(3), {
    reckoningEffect: "Move this Monster to the nearest space containing an investigator; then an investigator on that space immediately encounters it.",
  }),
  normal("lloigor", "Lloigor", 1, will(0, 2), strength(-2, 3), fixed(4), {
    reckoningEffect: "Each investigator on this space or an adjacent space loses 1 Health and 1 Sanity.",
  }),
  normal("maniac", "Maniac", 1, will(1, 1), strength(-1, 2), fixed(1), {
    specialEffect: "If the investigator fails the Strength test, they may discard 1 Ally Asset instead of losing Health.",
  }),
  normal("mi_go", "Mi-go", 1, will(0, 1), strength(-2, 2), fixed(3), {
    reckoningEffect: "Discard the nearest Clue and move this Monster to that space.",
    specialEffect: "After defeating this Monster during a Combat Encounter, gain 1 Artifact.",
  }),
  normal("mummy", "Mummy", 1, will(0, 2), strength(-2, 2), fixed(3), {
    spawnEffect: "Move this Monster to The Pyramids.",
  }),
  normal("nightgaunt", "Nightgaunt", 1, will(0, 2), strength(-2, 1), fixed(2), {
    reckoningEffect: "If an investigator is on this space, move that investigator and this Monster 1 space and the investigator becomes Delayed; otherwise move this Monster 2 spaces toward the nearest investigator.",
  }),
  normal("riot", "Riot", 1, null, strength(-3, 3), fixed(3), {
    specialEffect: "Before the Strength test, the investigator may test Influence -1; on a pass, defeat this Monster.",
  }),
  normal("serpent_people", "Serpent People", 1, will(0, 2), strength(-1, 3), fixed(2), {
    spawnEffect: "Move this Monster to The Amazon.",
    reckoningEffect: "Roll 1 die; on a 1 or 2, the nearest investigator moves 1 space toward this Monster.",
  }),
  normal("shoggoth", "Shoggoth", 1, will(0, 3), strength(-2, 2), fixed(4), {
    reckoningEffect: "This Monster recovers all Health.",
  }),
  normal("skeleton", "Skeleton", 1, will(0, 2), strength(-2, 1), fixed(2), {
    specialEffect: "After defeating this Monster during a Combat Encounter, recover 1 Sanity.",
  }),
  normal("star_spawn", "Star Spawn", 1, will(-1, 3), strength(-3, 3), fixed(5), {
    reckoningEffect: "Roll 1 die; on a 1 or 2, advance Doom by 1.",
  }),
  normal("vampire", "Vampire", 1, will(0, 1), strength(-2, 2), fixed(3), {
    specialEffect: "If the investigator fails the Will test, do not resolve the Strength test.",
  }),
  normal("warlock", "Warlock", 1, will(0, 1), strength(-1, 1), fixed(1), {
    reckoningEffect: "Roll 1 die; on a 1 or 2, the nearest investigator gains a Cursed Condition.",
    specialEffect: "If the investigator fails the Will test, they lose 1 Health.",
  }),
  normal("witch", "Witch", 1, will(-1, 0), strength(-1, 1), fixed(1), {
    reckoningEffect: "Each investigator with a Cursed Condition loses 1 Health.",
    specialEffect: "If the investigator fails the Will test, they gain a Cursed Condition.",
  }),
  normal("wraith", "Wraith", 1, will(-1, 2), strength(-1, 2), fixed(3), {
    spawnEffect: "The Lead Investigator gains a Cursed Condition.",
    specialEffect: "When this Monster is defeated, an investigator may discard a Cursed Condition.",
  }),
  normal("zombie", "Zombie", 1, will(0, 1), strength(-1, 2), fixed(2), {
    reckoningEffect: "Spawn the Zombie Horde Epic Monster on this space; if it is spawned, discard this Monster.",
  }),
  epic("cthulhu", "Cthulhu", will(-2, 5), strength(-2, 4), scaling(3), {
    specialEffect: "Sanity lost from the Will test is placed on the Ancient One sheet.",
  }, "Cthulhu (Monster)"),
  epic("cthylla", "Cthylla", will(-1, 4), strength(-2, 2), scaling(2), {
    reckoningEffect: "A Deep One Monster ambushes the nearest investigator.",
  }),
  epic("dunwich_horror", "Dunwich Horror", will(-1, 3), strength(-2, 3), scaling(2), {
    reckoningEffect: "Roll 1 die; if the result is less than or equal to the number of investigators, spawn 1 Gate.",
    specialEffect: "If The Dunwich Horror Prelude is in play, this Monster has toughness equal to investigators plus 4 instead.",
  }),
  epic("nug", "Nug", will(-1, 2), strength(-2, 4), scaling(2), {
    reckoningEffect: "Spawn 1 Ghoul Monster on this space.",
  }),
  epic("shub_niggurath", "Shub-Niggurath", will(-1, 4), strength(-3, 5), scaling(3), {
    specialEffect: "This Epic Monster cannot lose Health unless 3 Mysteries have been solved.",
  }, "Shub-Niggurath (Monster)"),
  epic("spinner_of_webs", "Spinner of Webs", will(0, 2), strength(-2, 2), scaling(2), {
    specialEffect: "If the investigator fails the Will test, do not resolve the Strength test.",
  }),
  epic("tick_tock_men", "Tick Tock Men", null, strength(-2, 3), scaling(2), {
    specialEffect: "Investigators cannot spend Clues to reroll dice during this Combat Encounter.",
  }),
  epic("wind_walker", "Wind-Walker", will(0, 2), strength(-2, 2), scaling(2), {
    specialEffect: "Before the Will test, lose 1 Health and 1 Sanity unless the investigator spends 1 Clue.",
  }),
  epic("zombie_horde", "Zombie Horde", will(0, 2), strength(-3, 3), fixed(5), {
    reckoningEffect: "Roll 1 die; on a 1 or 2, advance Doom by 1.",
    specialEffect: "If the investigator loses Health from the Strength test, discard 1 Ally Asset.",
  }),
] as const;

export const baseGameNormalMonsters = baseGameMonsters.filter((monster) => monster.type === "normal");
export const baseGameEpicMonsters = baseGameMonsters.filter((monster) => monster.type === "epic");

const combatCheckSchema = z.object({
  skill: z.enum(["will", "strength"]),
  modifier: z.number().int(),
  damage: z.number().int().nonnegative(),
}).strict();
const toughnessSchema = z.object({
  base: z.number().int().positive(),
  perInvestigator: z.number().int().min(0).max(1),
}).strict();
const monsterSchema = z.object({
  id: z.string().regex(/^(monster|epic_monster)_[a-z0-9_]+$/),
  name: z.string().min(1),
  type: z.enum(["normal", "epic"]),
  set: z.literal("core"),
  count: z.number().int().positive(),
  horrorCheck: z.union([combatCheckSchema, z.literal("ancient_one"), z.null()]),
  damageCheck: z.union([combatCheckSchema, z.literal("ancient_one"), z.null()]),
  toughness: z.union([toughnessSchema, z.literal("ancient_one")]),
  spawnEffect: z.string().min(1).optional(),
  reckoningEffect: z.string().min(1).optional(),
  specialEffect: z.string().min(1).optional(),
  imageUrl: z.string().regex(/^\/monsters\/(monster|epic_monster)_[a-z0-9_]+\.webp$/),
  wikiPageUrl: z.string().url().startsWith("https://eldritchhorror.fandom.com/wiki/"),
}).strict();

export function validateMonsterContent(monsters: readonly MonsterData[]): void {
  const parsed = z.array(monsterSchema).parse(monsters);
  const ids = new Set(parsed.map((monster) => monster.id));
  if (ids.size !== parsed.length) throw new Error("Monster content contains duplicate IDs.");
  for (const monster of parsed) {
    if (monster.type === "normal" && !monster.id.startsWith("monster_")) throw new Error(`${monster.id} has an invalid normal Monster ID.`);
    if (monster.type === "epic" && !monster.id.startsWith("epic_monster_")) throw new Error(`${monster.id} has an invalid Epic Monster ID.`);
    if (monster.horrorCheck !== null && monster.horrorCheck !== "ancient_one" && monster.horrorCheck.skill !== "will") {
      throw new Error(`${monster.id} has an invalid horror check skill.`);
    }
    if (monster.damageCheck !== null && monster.damageCheck !== "ancient_one" && monster.damageCheck.skill !== "strength") {
      throw new Error(`${monster.id} has an invalid damage check skill.`);
    }
  }
  const normalCount = parsed.filter((monster) => monster.type === "normal").reduce((total, monster) => total + monster.count, 0);
  const epicCount = parsed.filter((monster) => monster.type === "epic").reduce((total, monster) => total + monster.count, 0);
  if (normalCount !== 34 || epicCount !== 9) throw new Error(`Base-game Monster token counts must be 34 normal and 9 epic; got ${normalCount} and ${epicCount}.`);
}

validateMonsterContent(baseGameMonsters);
