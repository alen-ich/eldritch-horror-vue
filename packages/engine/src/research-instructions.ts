import { parseLocationEncounterInstruction, type LocationEncounterInstruction } from "./encounter-instructions.js";

/** Bind scan-authored 'this Clue' to the server-selected physical marker.
 * Unsupported nodes anywhere reject the whole section before drawing/rolling. */
export function bindResearchInstruction(value: unknown, markerId: string, depth = 0): LocationEncounterInstruction | undefined {
  if (depth > 32 || !value || typeof value !== "object" || !("kind" in value)) return undefined;
  if (value.kind === "effects" && "effects" in value && Array.isArray(value.effects)) {
    const effects = value.effects.map((effect: unknown) => {
      if (effect && typeof effect === "object" && "kind" in effect && effect.kind === "encountered_clue") {
        if ("operation" in effect && effect.operation === "relocate" && "destination" in effect && effect.destination === "nearest_sea") return { kind: "relocate_encountered_clue", markerId, destination: "nearest_sea" };
        if (!("operation" in effect) || effect.operation !== "gain") return undefined;
        return { kind: "collect_encountered_clue", markerId };
      }
      if (effect && typeof effect === "object" && "kind" in effect
        && (effect.kind === "collect_encountered_clue" || effect.kind === "relocate_encountered_clue")) return undefined;
      return effect;
    });
    return effects.some(effect => !effect) ? undefined : parseLocationEncounterInstruction({ kind: "effects", effects });
  }
  if (value.kind === "sequence" && "steps" in value && Array.isArray(value.steps)) {
    const steps = Array.from(value.steps, step => bindResearchInstruction(step, markerId, depth + 1));
    return steps.some(step => !step) ? undefined : { kind: "sequence", steps: steps as LocationEncounterInstruction[] };
  }
  if (value.kind === "test" && "pass" in value && "fail" in value) {
    const pass = bindResearchInstruction(value.pass, markerId, depth + 1);
    const fail = bindResearchInstruction(value.fail, markerId, depth + 1);
    return pass && fail ? parseLocationEncounterInstruction({ ...value, pass, fail }) : undefined;
  }
  if (value.kind === "ambush" && "monsterId" in value && (value.monsterId === "monster_deep_one" || value.monsterId === "monster_star_spawn" || value.monsterId === "monster_cultist") && "defeated" in value && "notDefeated" in value) {
    const defeated = bindResearchInstruction(value.defeated, markerId, depth + 1);
    const notDefeated = bindResearchInstruction(value.notDefeated, markerId, depth + 1);
    return defeated && notDefeated ? { kind: "ambush", monsterId: value.monsterId, defeated, notDefeated } : undefined;
  }
  if (value.kind === "optional" && "cost" in value && "reward" in value) {
    if ("decline" in value) return undefined; // Never drop an unimplemented refusal consequence.
    const reward = bindResearchInstruction(value.reward, markerId, depth + 1);
    return reward ? parseLocationEncounterInstruction({ ...value, reward }) : undefined;
  }
  return undefined;
}
