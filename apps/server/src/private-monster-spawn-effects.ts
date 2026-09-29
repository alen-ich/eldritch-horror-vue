import type { LocationId } from "@eldritch/protocol";
import type { MonsterCombatDefinition } from "@eldritch/engine";

/** Explicit typed transcriptions; unknown printed spawn text remains unsupported. */
export const monsterSpawnDestinationById: Readonly<Partial<Record<string, LocationId>>> = {
  monster_colour_out_of_space: "tunguska",
  monster_cthonian: "the_heart_of_africa",
  monster_elder_thing: "antarctica",
  monster_gnoph_keh: "the_himalayas",
  monster_mummy: "the_pyramids",
  monster_serpent_people: "the_amazon",
};

export function typedMonsterSpawnEffect(id: string, hasPrintedEffect: boolean): MonsterCombatDefinition["spawnEffect"] {
  if (!hasPrintedEffect) return undefined;
  const locationId = monsterSpawnDestinationById[id];
  return locationId ? { type: "move_to", locationId } : { type: "unsupported" };
}
