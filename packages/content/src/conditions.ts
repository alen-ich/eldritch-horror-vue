import { z } from "zod";

export const conditionKinds = ["debt", "amnesia", "dark_pact", "leg_injury", "internal_injury", "paranoia", "cursed", "hallucinations", "detained", "blessed", "back_injury"] as const;
export type ConditionKind = (typeof conditionKinds)[number];
export type ConditionTrait = "deal" | "injury" | "madness" | "restriction" | "bane" | "boon";

export interface ConditionCard {
  id: string;
  kind: ConditionKind;
  name: string;
  trait: ConditionTrait;
  copy: number;
  frontText: string;
  frontImageUrl: string;
  sourceFrontSheet: string;
  sourceBackSheet: string;
  sheetSlot: number;
  backVisibility: "server_only";
  backTextStatus: "not_transcribed";
  effectStatus: "not_executable";
}

const restInjury = "When you perform a Rest action, you may roll 1 die. On a 5 or 6, discard this card. Reckoning: Test Strength. If you fail, flip this card.";
const restMadness = "When you perform a Rest action, you may roll 1 die. On a 5 or 6, discard this card. Reckoning: Test Will. If you fail, flip this card.";
const definitions = [
  { kind: "debt", name: "Debt", trait: "deal", copies: 6, frontText: "Local Action: Test Influence. If you pass, discard this card. Reckoning: Flip this card." },
  { kind: "amnesia", name: "Amnesia", trait: "madness", copies: 3, frontText: restMadness },
  { kind: "dark_pact", name: "Dark Pact", trait: "deal", copies: 3, frontText: "Reckoning: Roll 1 die. On a 1, flip this card." },
  { kind: "leg_injury", name: "Leg Injury", trait: "injury", copies: 3, frontText: restInjury },
  { kind: "internal_injury", name: "Internal Injury", trait: "injury", copies: 3, frontText: restInjury },
  { kind: "paranoia", name: "Paranoia", trait: "madness", copies: 3, frontText: restMadness },
  { kind: "cursed", name: "Cursed", trait: "bane", copies: 3, frontText: "Only 6s count as successes. Gain another Cursed: flip this card instead. Gain Blessed: discard this card instead. Reckoning: Roll 1 die; on 4, 5, or 6, discard this card." },
  { kind: "hallucinations", name: "Hallucinations", trait: "madness", copies: 3, frontText: restMadness },
  { kind: "detained", name: "Detained", trait: "restriction", copies: 3, frontText: "You cannot move or perform actions other than the action on this card. Instead of resolving an encounter, flip this card. Local Action: Test Influence. If you pass, discard this card." },
  { kind: "blessed", name: "Blessed", trait: "boon", copies: 3, frontText: "4s, 5s, and 6s count as successes. Gain another Blessed: flip this card instead. Gain Cursed: discard this card instead. Reckoning: Roll 1 die; on 1 or 2, discard this card." },
  { kind: "back_injury", name: "Back Injury", trait: "injury", copies: 3, frontText: restInjury },
] as const satisfies readonly { kind: ConditionKind; name: string; trait: ConditionTrait; copies: number; frontText: string }[];

export const baseGameConditions: readonly ConditionCard[] = definitions.flatMap(definition =>
  Array.from({ length: definition.copies }, (_, index) => {
    const ordinal = definitions.slice(0, definitions.indexOf(definition)).reduce((sum, item) => sum + item.copies, 0) + index;
    const sheet = ordinal < 32 ? 1 : 2;
    const id = `condition_${definition.kind}_${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      kind: definition.kind,
      name: definition.name,
      trait: definition.trait,
      copy: index + 1,
      frontText: definition.frontText,
      frontImageUrl: `/cards/conditions/${id}.webp`,
      sourceFrontSheet: `source-assets/conditions/front-${sheet}.jpg`,
      sourceBackSheet: `source-assets/conditions/back-${sheet}.jpg`,
      sheetSlot: sheet === 1 ? ordinal : ordinal - 32,
      backVisibility: "server_only" as const,
      backTextStatus: "not_transcribed" as const,
      effectStatus: "not_executable" as const,
    };
  }),
);

const conditionSchema = z.object({
  id: z.string().regex(/^condition_[a-z_]+_\d{2}$/),
  kind: z.enum(conditionKinds),
  name: z.string().min(1),
  trait: z.enum(["deal", "injury", "madness", "restriction", "bane", "boon"]),
  copy: z.number().int().positive(),
  frontText: z.string().min(1),
  frontImageUrl: z.string().startsWith("/cards/conditions/"),
  sourceFrontSheet: z.string().startsWith("source-assets/conditions/front-"),
  sourceBackSheet: z.string().startsWith("source-assets/conditions/back-"),
  sheetSlot: z.number().int().nonnegative(),
  backVisibility: z.literal("server_only"),
  backTextStatus: z.literal("not_transcribed"),
  effectStatus: z.literal("not_executable"),
}).strict();

export function validateConditionContent(cards: readonly ConditionCard[]): void {
  conditionSchema.array().length(36).parse(cards);
  if (new Set(cards.map(card => card.id)).size !== cards.length) throw new Error("Duplicate Condition card IDs.");
  for (const [ordinal, card] of cards.entries()) {
    const expected = definitions.find(definition => definition.kind === card.kind);
    const expectedKind = definitions.flatMap(definition => Array(definition.copies).fill(definition.kind) as ConditionKind[])[ordinal];
    const sheet = ordinal < 32 ? 1 : 2;
    if (!expected || card.kind !== expectedKind || card.copy > expected.copies || card.name !== expected.name || card.trait !== expected.trait || card.frontText !== expected.frontText
      || card.id !== `condition_${card.kind}_${String(card.copy).padStart(2, "0")}`
      || card.frontImageUrl !== `/cards/conditions/${card.id}.webp`
      || card.sourceFrontSheet !== `source-assets/conditions/front-${sheet}.jpg`
      || card.sourceBackSheet !== `source-assets/conditions/back-${sheet}.jpg`
      || card.sheetSlot !== (sheet === 1 ? ordinal : ordinal - 32)) {
      throw new Error(`Invalid Condition card mapping: ${card.id}.`);
    }
  }
  for (const definition of definitions) {
    if (cards.filter(card => card.kind === definition.kind).length !== definition.copies) {
      throw new Error(`Incorrect Condition count: ${definition.kind}.`);
    }
  }
}

validateConditionContent(baseGameConditions);
