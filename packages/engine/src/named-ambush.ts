import type { GameContent, GameState } from "./index.js";
import type { CombatCheck } from "./combat.js";

interface NamedAmbushStats {
  horrorCheck: CombatCheck | null;
  damageCheck: CombatCheck;
  toughness: number;
  beforeStrengthSanityLoss: number;
}

/** Resolve only verified named ambushes; never consume or place a physical token. */
export function namedAmbushStats(state: GameState, content: GameContent, monsterId: string): NamedAmbushStats | undefined {
  const monster = content.monsters?.find(card => card.id === monsterId);
  if (!monster || monster.type !== "normal") return undefined;
  if (monsterId === "monster_cultist") {
    const profile = content.ancientOnes?.cthulhu?.normalCultistCombat;
    if (state.ancientOneId !== "cthulhu" || state.awakened || !profile
      || monster.horrorCheck !== "ancient_one" || monster.damageCheck !== "ancient_one" || monster.toughness !== "ancient_one"
      || monster.specialEffect !== "Combat statistics and effects are defined by the selected Ancient One."
      || profile.horrorCheck !== null || profile.damageCheck?.modifier !== 0 || profile.damageCheck.damage !== 1
      || profile.toughness !== 1 || profile.beforeStrengthSanityLoss !== 1
      || !Array.isArray(profile.effectIds) || profile.effectIds.length !== 1 || profile.effectIds[0] !== "cthulhu_cultist_pre_strength_sanity_loss_1") return undefined;
    return { horrorCheck: null, damageCheck: { modifier: 0, damage: 1 }, toughness: 1, beforeStrengthSanityLoss: 1 };
  }
  if ((monsterId !== "monster_deep_one" && monsterId !== "monster_star_spawn") || monster.specialEffect
    || !monster.horrorCheck || monster.horrorCheck === "ancient_one" || !monster.damageCheck || monster.damageCheck === "ancient_one"
    || monster.toughness === "ancient_one") return undefined;
  return { horrorCheck: monster.horrorCheck, damageCheck: monster.damageCheck,
    toughness: monster.toughness.base + monster.toughness.perInvestigator * state.players.filter(player => !player.defeated && !player.eliminated).length,
    beforeStrengthSanityLoss: 0 };
}
