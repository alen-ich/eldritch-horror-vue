import { z } from "zod";
import { baseGameScannedTokenEncounters } from "./token-encounters.js";

// Printed mechanical transcriptions only. No runtime interpretation of prose.
const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("encountered_clue"), operation: z.enum(["gain", "discard", "relocate"]), destination: z.string().min(1).optional() }).strict().refine(effect => effect.operation === "relocate" ? !!effect.destination : effect.destination === undefined),
  z.object({ kind: z.enum(["clues", "spawn_clues"]), amount: z.number().int().positive() }).strict(),
  z.object({ kind: z.enum(["health", "sanity"]), amount: z.number().int().negative() }).strict(),
  z.object({ kind: z.literal("condition"), condition: z.enum(["amnesia", "internal_injury", "back_injury", "dark_pact"]) }).strict(),
  z.object({ kind: z.literal("delay") }).strict(),
  z.object({ kind: z.literal("omen_move"), destination: z.literal("chosen"), advanceDoom: z.literal(false) }).strict(),
  z.object({ kind: z.literal("omen_advance"), amount: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("omen_eldritch"), operation: z.enum(["place", "discard"]), amount: z.literal(1), space: z.enum(["green", "chosen"]) }).strict(),
  z.object({ kind: z.literal("return_solved_mystery"), selection: z.literal("random"), shuffle: z.literal(true) }).strict(),
  z.object({ kind: z.literal("artifact"), id: z.literal("artifact_ttka_halot") }).strict(),
]);
export type ResearchEffect = z.infer<typeof effectSchema>;
export type ResearchInstruction =
  | { kind: "effects"; effects: ResearchEffect[] }
  | { kind: "sequence"; steps: ResearchInstruction[] }
  | { kind: "optional"; cost: ResearchEffect[]; reward: ResearchInstruction }
  | { kind: "test"; skill: "lore" | "influence" | "observation" | "strength" | "will"; modifier: number; pass: ResearchInstruction; fail: ResearchInstruction };

// Recursive schema validates trusted source data, not network commands.
const instructionSchema: z.ZodType<ResearchInstruction> = z.lazy(() => z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("effects"), effects: z.array(effectSchema) }).strict(),
  z.object({ kind: z.literal("sequence"), steps: z.array(instructionSchema).min(1) }).strict(),
  z.object({ kind: z.literal("optional"), cost: z.array(effectSchema).min(1), reward: instructionSchema }).strict(),
  z.object({ kind: z.literal("test"), skill: z.enum(["lore", "influence", "observation", "strength", "will"]), modifier: z.number().int(), pass: instructionSchema, fail: instructionSchema }).strict(),
]));

const e = (...effects: ResearchEffect[]): ResearchInstruction => ({ kind: "effects", effects });
const s = (...steps: ResearchInstruction[]): ResearchInstruction => ({ kind: "sequence", steps });
const t = (skill: "lore" | "influence" | "observation" | "strength" | "will", pass: ResearchInstruction, fail = e(), modifier = 0): ResearchInstruction => ({ kind: "test", skill, modifier, pass, fail });
const gain: ResearchEffect = { kind: "encountered_clue", operation: "gain" };
const extra: ResearchEffect = { kind: "clues", amount: 1 };
const move: ResearchEffect = { kind: "omen_move", destination: "chosen", advanceDoom: false };
const place: ResearchEffect = { kind: "omen_eldritch", operation: "place", amount: 1, space: "green" };
const remove: ResearchEffect = { kind: "omen_eldritch", operation: "discard", amount: 1, space: "chosen" };
const advance: ResearchEffect = { kind: "omen_advance", amount: 1 };
const condition = (condition: "amnesia" | "internal_injury" | "back_injury"): ResearchEffect => ({ kind: "condition", condition });

const azathoth: [ResearchInstruction, ResearchInstruction, ResearchInstruction][] = [
  [t("observation", e(gain, extra), e(), -1), t("observation", e(gain, move), e({ kind: "health", amount: -1 }), -1), t("lore", e(gain, extra), e({ kind: "delay" }))],
  [t("lore", e(gain), e(place)), t("observation", e(gain, extra), e(condition("amnesia"))), s(e(gain), t("strength", e(), e({ kind: "health", amount: -2 })))],
  [t("observation", e(gain), e({ kind: "sanity", amount: -1 })), s(e(gain), t("will", e(remove), e({ kind: "sanity", amount: -6 }))), t("observation", e(gain, move))],
  [t("strength", e(gain), e(condition("internal_injury"))), t("observation", e(gain, { kind: "spawn_clues", amount: 1 })), e(gain, place)],
  [t("observation", e(gain, extra), e({ kind: "return_solved_mystery", selection: "random", shuffle: true })), s(e(gain), t("lore", e(remove), e(), -1)), { kind: "optional", cost: [{ kind: "condition", condition: "dark_pact" }], reward: e(gain, { kind: "artifact", id: "artifact_ttka_halot" }) }],
  [t("influence", e(gain), e(advance)), t("observation", e(gain), e(advance)), t("observation", e(gain, extra), e(advance))],
  [t("will", e(gain), e(condition("amnesia"))), t("influence", e(gain), e({ kind: "sanity", amount: -1 })), t("will", e(gain, extra), e(condition("internal_injury")))],
  [t("observation", e(gain, extra), e({ kind: "delay" }), -1), s(e({ kind: "health", amount: -1 }), t("observation", e(gain, extra), e(condition("back_injury")))), s(e(gain), t("observation", e(move)))],
];

const cardSchema = z.object({
  id: z.string().min(1), deck: z.literal("research_azathoth"), number: z.number().int().min(1).max(8),
  verification: z.literal("mechanics_verified_from_scan"), effectStatus: z.literal("transcribed_pending_execution"),
  sections: z.object({ city: instructionSchema, wilderness: instructionSchema, sea: instructionSchema }).strict(),
}).strict();
export type ResearchEncounterRuleCard = z.infer<typeof cardSchema>;
export const baseGameResearchEncounterRules: readonly ResearchEncounterRuleCard[] = azathoth.map(([city, wilderness, sea], index) => cardSchema.parse({
  id: `encounter_research_azathoth_${String(index + 1).padStart(2, "0")}`, deck: "research_azathoth", number: index + 1,
  verification: "mechanics_verified_from_scan", effectStatus: "transcribed_pending_execution", sections: { city, wilderness, sea },
}));

export function validateResearchEncounterRules(cards: readonly unknown[]): void {
  const parsed = z.array(cardSchema).parse(cards);
  if (new Set(parsed.map(card => card.id)).size !== parsed.length) throw new Error("Duplicate Research rules.");
  for (const card of parsed) {
    const scan = baseGameScannedTokenEncounters.find(scan => scan.id === card.id);
    const canonical = baseGameResearchEncounterRules.find(rule => rule.id === card.id);
    if (!scan || scan.deck !== card.deck || scan.number !== card.number || !canonical || JSON.stringify(card) !== JSON.stringify(canonical)) throw new Error(`Research rules do not match the verified scan: ${card.id}`);
  }
}
validateResearchEncounterRules(baseGameResearchEncounterRules);
