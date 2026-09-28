import { calculateDicePool, countTestSuccesses } from "./skill-tests.js";

export interface CombatCheck {
  modifier: number;
  damage: number;
}

export interface StandardCombatInput {
  will: number;
  strength: number;
  willImprovement?: number;
  strengthImprovement?: number;
  currentHealth: number;
  currentSanity: number;
  monsterDamage: number;
  monsterToughness: number;
  horrorCheck: CombatCheck | null;
  damageCheck: CombatCheck | null;
  willItemBonuses?: readonly number[];
  strengthItemBonuses?: readonly number[];
  successThreshold?: number;
}

export interface CombatTestResult {
  dice: number[];
  successes: number;
}

export interface StandardCombatResult {
  horrorTest?: CombatTestResult;
  strengthTest?: CombatTestResult;
  sanityLost: number;
  healthLost: number;
  monsterHealthLost: number;
  investigatorDefeated: boolean;
  monsterDefeated: boolean;
}

/** Generic printed-stat combat only. Callers must resolve Monster-specific text first. */
export function resolveStandardCombat(input: StandardCombatInput, rollDie: () => number): StandardCombatResult {
  for (const [label, value] of Object.entries({
    will: input.will,
    strength: input.strength,
    currentHealth: input.currentHealth,
    currentSanity: input.currentSanity,
    monsterDamage: input.monsterDamage,
    monsterToughness: input.monsterToughness,
  })) {
    if (!Number.isInteger(value) || value < 0 || (label === "monsterToughness" && value === 0)) {
      throw new Error(`${label} must be a valid nonnegative integer${label === "monsterToughness" ? " greater than zero" : ""}.`);
    }
  }
  if (input.currentHealth === 0 || input.currentSanity === 0) throw new Error("A defeated investigator cannot fight.");
  if (input.successThreshold !== undefined && (!Number.isInteger(input.successThreshold) || input.successThreshold < 1 || input.successThreshold > 6)) {
    throw new Error("The success threshold must be an integer from 1 to 6.");
  }
  for (const check of [input.horrorCheck, input.damageCheck]) {
    if (check && (!Number.isInteger(check.modifier) || !Number.isInteger(check.damage) || check.damage < 0)) {
      throw new Error("Combat check statistics must be integers with nonnegative damage.");
    }
  }
  const threshold = input.successThreshold ?? 5;
  const roll = (count: number): number[] => Array.from({ length: count }, () => {
    const die = rollDie();
    if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error("A combat die must be an integer from 1 to 6.");
    return die;
  });

  let horrorTest: CombatTestResult | undefined;
  let sanityLost = 0;
  if (input.horrorCheck) {
    const dice = roll(calculateDicePool({
      skill: "will", baseSkill: input.will, improvement: input.willImprovement,
      modifier: input.horrorCheck.modifier, itemBonuses: input.willItemBonuses,
    }).dicePool);
    horrorTest = { dice, successes: countTestSuccesses(dice, threshold) };
    sanityLost = Math.min(input.currentSanity, Math.max(0, input.horrorCheck.damage - horrorTest.successes));
  }
  // Defeat during the Will test ends the encounter before a Strength test.
  if (sanityLost === input.currentSanity) {
    return { horrorTest, sanityLost, healthLost: 0, monsterHealthLost: 0, investigatorDefeated: true, monsterDefeated: false };
  }

  let strengthTest: CombatTestResult | undefined;
  let healthLost = 0;
  let monsterHealthLost = 0;
  if (input.damageCheck) {
    const dice = roll(calculateDicePool({
      skill: "strength", baseSkill: input.strength, improvement: input.strengthImprovement,
      modifier: input.damageCheck.modifier, itemBonuses: input.strengthItemBonuses,
    }).dicePool);
    strengthTest = { dice, successes: countTestSuccesses(dice, threshold) };
    healthLost = Math.min(input.currentHealth, Math.max(0, input.damageCheck.damage - strengthTest.successes));
    if (strengthTest.successes > 0) monsterHealthLost = strengthTest.successes;
  }
  return {
    horrorTest, strengthTest, sanityLost, healthLost, monsterHealthLost,
    investigatorDefeated: healthLost === input.currentHealth,
    monsterDefeated: input.monsterDamage + monsterHealthLost >= input.monsterToughness,
  };
}
