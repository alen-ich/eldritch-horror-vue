import { skillIds, type SkillId } from "@eldritch/protocol";

export type LocationEncounterEffect =
  | { kind: "ambush_horror"; damage: number }
  | { kind: "relocate_encountered_clue"; markerId: string; destination: "nearest_sea"; locationId?: string }
  | { kind: "doom_retreat"; amount: 1 }
  | { kind: "discard_item_assets"; amount: 1 | 2 }
  | { kind: "artifact"; id: "artifact_ttka_halot" }
  | { kind: "return_solved_mystery"; selection: "random"; shuffle: true }
  | { kind: "omen_move"; destination: "chosen"; advanceDoom: false; position?: number }
  | { kind: "omen_advance"; amount: 1 }
  | { kind: "omen_eldritch"; operation: "place" | "discard"; amount: 1; space: "green" | "chosen" }
  | { kind: "collect_encountered_clue"; markerId: string }
  | { kind: "clues" | "health" | "sanity" | "recover_health" | "recover_sanity"; amount: number }
  | { kind: "spawn_clues"; amount: number; target?: "chosen_space" }
  | { kind: "condition"; condition: string; accepted?: boolean }
  | { kind: "delay"; accepted?: boolean }
  | { kind: "discard"; target: "madness" | "blessed" }
  | { kind: "improve"; skill: SkillId | "chosen"; amount?: 1 | 2 };

export type LocationEncounterInstruction =
  | { kind: "ambush"; monsterId: "monster_deep_one" | "monster_star_spawn"; defeated: LocationEncounterInstruction; notDefeated: LocationEncounterInstruction }
  | { kind: "ambush_result"; monsterId: "monster_deep_one" | "monster_star_spawn"; damage: number; toughness: number; defeated: LocationEncounterInstruction; notDefeated: LocationEncounterInstruction }
  | { kind: "effects"; effects: LocationEncounterEffect[] }
  | { kind: "sequence"; steps: LocationEncounterInstruction[] }
  | { kind: "choice"; options: LocationEncounterInstruction[] }
  | { kind: "optional"; cost: LocationEncounterEffect[]; reward: LocationEncounterInstruction }
  | { kind: "test"; skill: SkillId; modifier: number; pass: LocationEncounterInstruction; fail: LocationEncounterInstruction };

const isSkill = (value: unknown): value is SkillId => skillIds.some(skill => skill === value);

/** Accept only modeled mechanical nodes. No free-form card text is interpreted. */
export function parseLocationEncounterInstruction(value: unknown, depth = 0): LocationEncounterInstruction | undefined {
  if (depth > 32 || !value || typeof value !== "object" || !("kind" in value)) return undefined;
  if (value.kind === "ambush" && "monsterId" in value && (value.monsterId === "monster_deep_one" || value.monsterId === "monster_star_spawn") && "defeated" in value && "notDefeated" in value) {
    const defeated = parseLocationEncounterInstruction(value.defeated, depth + 1);
    const notDefeated = parseLocationEncounterInstruction(value.notDefeated, depth + 1);
    return defeated && notDefeated ? { kind: "ambush", monsterId: value.monsterId, defeated, notDefeated } : undefined;
  }
  if (value.kind === "effects" && "effects" in value && Array.isArray(value.effects)) {
    const effects: LocationEncounterEffect[] = [];
    for (const raw of value.effects as unknown[]) {
      if (!raw || typeof raw !== "object" || !("kind" in raw)) return undefined;
      if (raw.kind === "relocate_encountered_clue" && "markerId" in raw && typeof raw.markerId === "string" && "destination" in raw && raw.destination === "nearest_sea") { effects.push({ kind: raw.kind, markerId: raw.markerId, destination: raw.destination }); continue; }
      if (raw.kind === "doom_retreat" && "amount" in raw && raw.amount === 1) { effects.push({ kind: raw.kind, amount: 1 }); continue; }
      if (raw.kind === "discard_item_assets" && "amount" in raw && (raw.amount === 1 || raw.amount === 2)) { effects.push({ kind: raw.kind, amount: raw.amount }); continue; }
      if (raw.kind === "artifact") {
        if (!("id" in raw) || raw.id !== "artifact_ttka_halot") return undefined;
        effects.push({ kind: "artifact", id: raw.id });
        continue;
      }
      if (raw.kind === "return_solved_mystery" && "selection" in raw && raw.selection === "random" && "shuffle" in raw && raw.shuffle === true) effects.push({ kind: "return_solved_mystery", selection: "random", shuffle: true });
      else if (raw.kind === "omen_move" && "destination" in raw && raw.destination === "chosen" && "advanceDoom" in raw && raw.advanceDoom === false) effects.push({ kind: "omen_move", destination: "chosen", advanceDoom: false });
      else if (raw.kind === "omen_advance" && "amount" in raw && raw.amount === 1) effects.push({ kind: "omen_advance", amount: 1 });
      else if (raw.kind === "omen_eldritch" && "operation" in raw && "space" in raw && "amount" in raw && raw.amount === 1
        && (raw.operation === "place" && raw.space === "green" || raw.operation === "discard" && raw.space === "chosen")) effects.push({ kind: "omen_eldritch", operation: raw.operation, space: raw.space, amount: 1 });
      else if (raw.kind === "collect_encountered_clue" && "markerId" in raw && typeof raw.markerId === "string" && raw.markerId) effects.push({ kind: "collect_encountered_clue", markerId: raw.markerId });
      else if (raw.kind === "delay") effects.push({ kind: "delay" });
      else if (raw.kind === "discard" && "target" in raw && (raw.target === "madness" || raw.target === "blessed")) effects.push({ kind: "discard", target: raw.target });
      else if (raw.kind === "condition" && "condition" in raw && typeof raw.condition === "string" && raw.condition) effects.push({ kind: "condition", condition: raw.condition });
      else if (raw.kind === "improve" && "skill" in raw && (raw.skill === "chosen" || isSkill(raw.skill))) effects.push({ kind: "improve", skill: raw.skill });
      else if ("amount" in raw && typeof raw.amount === "number" && Number.isInteger(raw.amount)) {
        if (raw.kind === "clues" || (raw.kind === "health" || raw.kind === "sanity") && raw.amount <= 0
          || (raw.kind === "recover_health" || raw.kind === "recover_sanity") && raw.amount >= 0) {
          effects.push({ kind: raw.kind, amount: raw.amount });
        } else if (raw.kind === "spawn_clues" && raw.amount >= 0 && (!("target" in raw) || raw.target === "chosen_space")) {
          effects.push({ kind: "spawn_clues", amount: raw.amount, ...("target" in raw ? { target: "chosen_space" as const } : {}) });
        } else return undefined;
      } else return undefined;
    }
    return { kind: "effects", effects };
  }
  if ((value.kind === "sequence" && "steps" in value && Array.isArray(value.steps))
    || (value.kind === "choice" && "options" in value && Array.isArray(value.options))) {
    const nodes: unknown[] = value.kind === "sequence" ? (value as { steps: unknown[] }).steps : (value as { options: unknown[] }).options;
    if (value.kind === "choice" && !nodes.length) return undefined;
    const parsed = nodes.map(node => parseLocationEncounterInstruction(node, depth + 1));
    if (parsed.some(node => !node)) return undefined;
    return value.kind === "sequence" ? { kind: "sequence", steps: parsed as LocationEncounterInstruction[] } : { kind: "choice", options: parsed as LocationEncounterInstruction[] };
  }
  if (value.kind === "test" && "skill" in value && isSkill(value.skill) && "modifier" in value && typeof value.modifier === "number" && Number.isInteger(value.modifier) && "pass" in value && "fail" in value) {
    const pass = parseLocationEncounterInstruction(value.pass, depth + 1);
    const fail = parseLocationEncounterInstruction(value.fail, depth + 1);
    if (pass && fail) return { kind: "test", skill: value.skill, modifier: value.modifier, pass, fail };
  }
  if (value.kind === "optional" && "cost" in value && "reward" in value) {
    const cost = parseLocationEncounterInstruction({ kind: "effects", effects: value.cost }, depth + 1);
    const reward = parseLocationEncounterInstruction(value.reward, depth + 1);
    if (cost?.kind === "effects" && reward && cost.effects.every(effect => effect.kind === "delay" || effect.kind === "condition"
      || (effect.kind === "clues" || effect.kind === "health" || effect.kind === "sanity") && effect.amount <= 0)) {
      return { kind: "optional", cost: cost.effects, reward };
    }
  }
  return undefined;
}

export function encounterInstructionLabel(instruction: LocationEncounterInstruction): string {
  if (instruction.kind === "ambush" || instruction.kind === "ambush_result") return `Resolve a ${instruction.monsterId === "monster_star_spawn" ? "Star Spawn" : "Deep One"} ambush`;
  if (instruction.kind === "test") return `Test ${instruction.skill}${instruction.modifier ? ` (${instruction.modifier > 0 ? "+" : ""}${instruction.modifier})` : ""}`;
  if (instruction.kind === "sequence") return instruction.steps.map(encounterInstructionLabel).join("; then ");
  if (instruction.kind !== "effects") return "Resolve the printed encounter choice";
  return instruction.effects.map(effect => {
    if (effect.kind === "ambush_horror") return "Resolve ambush Horror loss";
    if (effect.kind === "relocate_encountered_clue") return "Move this Clue to the nearest Sea space";
    if (effect.kind === "doom_retreat") return "Retreat Doom by 1";
    if (effect.kind === "discard_item_assets") return `Discard ${effect.amount} Item Assets`;
    if (effect.kind === "artifact") return "Gain T'tka Halot";
    if (effect.kind === "return_solved_mystery") return "Shuffle a random solved Mystery back into its deck";
    if (effect.kind === "omen_move") return "Move Omen without advancing Doom";
    if (effect.kind === "omen_advance") return "Advance Omen by 1";
    if (effect.kind === "omen_eldritch") return `${effect.operation === "place" ? "Place" : "Discard"} 1 Omen Eldritch token`;
    if (effect.kind === "collect_encountered_clue") return "Gain this Clue";
    if (effect.kind === "condition") return `Gain ${effect.condition.replaceAll("_", " ")}`;
    if (effect.kind === "delay") return "Become Delayed";
    if (effect.kind === "discard") return `Discard a ${effect.target} Condition`;
    if (effect.kind === "improve") return `Improve ${effect.skill === "chosen" ? "a skill" : effect.skill}`;
    if (effect.kind === "spawn_clues") return `Spawn ${effect.amount} Clue${effect.amount === 1 ? "" : "s"}`;
    const label = effect.kind.replaceAll("_", " ");
    return `${effect.amount < 0 ? "Spend" : effect.kind.startsWith("recover") ? "" : "Gain"} ${Math.abs(effect.amount)} ${label}`.trim();
  }).join(", ") || "No effect";
}
