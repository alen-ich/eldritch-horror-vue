import { baseGameSpells, type SpellKind } from "@eldritch/content";

export interface SuccessRange { min: number; max: number | null }
const instructionTags = ["resource_loss", "resource_gain", "condition_gain", "discard", "flip", "prevention_replacement", "monster_damage_replacement", "monster_damage", "skill_improvement", "test_bonus", "reroll", "additional_action", "asset_gain", "no_additional_effect", "unsupported_mechanic"] as const;
export type SpellBackInstructionTag = typeof instructionTags[number];
export interface SpellBackInstruction { text: string; tags: readonly SpellBackInstructionTag[] }
export interface SpellBackRecord {
  physicalId: string; kind: SpellKind; copy: 1 | 2; printedNumber: 1 | 2; sheetSlot: number;
  sourceBackSheet: "source-assets/spells/back.jpg"; privateAssetPath: string; verifiedOn: string;
  text: string;
  branches: readonly { when: SuccessRange; instructions: readonly SpellBackInstruction[] }[];
  afterBranches: readonly SpellBackInstruction[];
}

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid private Spell reverse catalog.");
}
function objectWithKeys(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  requireValid(value !== null && typeof value === "object" && !Array.isArray(value));
  const actual = Reflect.ownKeys(value);
  requireValid(actual.length === keys.length && actual.every(key => typeof key === "string" && keys.includes(key)));
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function instructions(value: unknown, allowEmpty = false): void {
  requireValid(Array.isArray(value) && (allowEmpty || value.length > 0));
  for (const instruction of value) {
    objectWithKeys(instruction, ["text", "tags"]);
    requireValid(nonempty(instruction.text) && Array.isArray(instruction.tags) && instruction.tags.length > 0);
    requireValid(new Set(instruction.tags).size === instruction.tags.length);
    requireValid(instruction.tags.every(tag => instructionTags.includes(tag)));
  }
}

/** Validates data only. Does not resolve any effect or mutate the input. */
export function validatePrivateSpellBacks(records: unknown): asserts records is readonly SpellBackRecord[] {
  requireValid(Array.isArray(records) && records.length === baseGameSpells.length);
  const seen = new Set<string>();
  for (const record of records) {
    objectWithKeys(record, ["physicalId", "kind", "copy", "printedNumber", "sheetSlot", "sourceBackSheet", "privateAssetPath", "verifiedOn", "text", "branches", "afterBranches"]);
    const front = baseGameSpells.find(card => card.id === record.physicalId);
    requireValid(front && !seen.has(front.id)); seen.add(front.id);
    requireValid(record.kind === front.kind && record.copy === front.copy && record.sheetSlot === front.sheetSlot);
    requireValid(record.printedNumber === 1 || record.printedNumber === 2);
    requireValid(record.sourceBackSheet === front.sourceBackSheet && record.privateAssetPath === `apps/server/private-card-assets/spells/${front.id}.webp`);
    requireValid(nonempty(record.verifiedOn) && /^\d{4}-\d{2}-\d{2}$/.test(record.verifiedOn));
    const date = new Date(`${record.verifiedOn}T00:00:00Z`);
    requireValid(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === record.verifiedOn);
    requireValid(nonempty(record.text) && Array.isArray(record.branches) && record.branches.length > 0);
    let nextMin: number | null = 0;
    for (const branch of record.branches) {
      objectWithKeys(branch, ["when", "instructions"]);
      objectWithKeys(branch.when, ["min", "max"]);
      const { min, max } = branch.when;
      requireValid(nextMin !== null && Number.isSafeInteger(min) && min === nextMin);
      requireValid(max === null || typeof max === "number" && Number.isSafeInteger(max) && max >= (min as number) && max < Number.MAX_SAFE_INTEGER);
      nextMin = max === null ? null : (max as number) + 1;
      instructions(branch.instructions);
    }
    requireValid(nextMin === null);
    instructions(record.afterBranches, true);
  }
}
