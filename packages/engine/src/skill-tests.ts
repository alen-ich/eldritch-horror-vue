import type { SkillId } from "@eldritch/protocol";

export interface DicePoolInput {
  skill: SkillId;
  baseSkill: number;
  improvement?: number;
  modifier?: number;
  itemBonuses?: readonly number[];
  otherBonuses?: readonly number[];
}

export interface DicePoolCalculation {
  skill: SkillId;
  baseSkill: number;
  improvement: number;
  modifier: number;
  itemBonus: number;
  otherBonus: number;
  dicePool: number;
}

export function calculateDicePool(input: DicePoolInput): DicePoolCalculation {
  const improvement = input.improvement ?? 0;
  const modifier = input.modifier ?? 0;
  const itemBonus = Math.max(0, ...(input.itemBonuses ?? []));
  const otherBonus = (input.otherBonuses ?? []).reduce((total, bonus) => total + bonus, 0);
  return {
    skill: input.skill,
    baseSkill: input.baseSkill,
    improvement,
    modifier,
    itemBonus,
    otherBonus,
    dicePool: Math.max(1, input.baseSkill + improvement + modifier + itemBonus + otherBonus),
  };
}

export function countTestSuccesses(dice: readonly number[], successThreshold = 5): number {
  return dice.filter((die) => die >= successThreshold).length;
}
