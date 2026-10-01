import { parseLocationEncounterInstruction, type LocationEncounterInstruction } from "./encounter-instructions.js";

/** Bind scan-authored 'this Clue' to the server-selected physical marker.
 * Unsupported nodes anywhere reject the whole section before drawing/rolling. */
export function bindResearchInstruction(value: unknown, markerId: string, depth = 0): LocationEncounterInstruction | undefined {
  if (depth > 32 || !value || typeof value !== "object" || !("kind" in value)) return undefined;
  if (value.kind === "effects" && "effects" in value && Array.isArray(value.effects)) {
    const effects = value.effects.map((effect: unknown) => {
      if (effect && typeof effect === "object" && "kind" in effect && effect.kind === "encountered_clue") {
        if (!("operation" in effect) || effect.operation !== "gain") return undefined;
        return { kind: "collect_encountered_clue", markerId };
      }
      return effect;
    });
    return effects.some(effect => !effect) ? undefined : parseLocationEncounterInstruction({ kind: "effects", effects });
  }
  if (value.kind === "sequence" && "steps" in value && Array.isArray(value.steps)) {
    const steps = value.steps.map(step => bindResearchInstruction(step, markerId, depth + 1));
    return steps.some(step => !step) ? undefined : { kind: "sequence", steps: steps as LocationEncounterInstruction[] };
  }
  if (value.kind === "test" && "pass" in value && "fail" in value) {
    const pass = bindResearchInstruction(value.pass, markerId, depth + 1);
    const fail = bindResearchInstruction(value.fail, markerId, depth + 1);
    return pass && fail ? parseLocationEncounterInstruction({ ...value, pass, fail }) : undefined;
  }
  // Optional named Artifact rewards and Mystery return are not supported yet.
  return undefined;
}
