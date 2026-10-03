import { z } from "zod";
import { baseGameScannedTokenEncounters } from "./token-encounters.js";

const effect = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("close_encountered_gate") }).strict(),
  z.object({ kind: z.literal("spell"), amount: z.literal(1) }).strict(),
  z.object({ kind: z.literal("clues"), amount: z.number().int() }).strict(),
  z.object({ kind: z.literal("sanity"), amount: z.number().int().negative() }).strict(),
  z.object({ kind: z.literal("condition"), condition: z.literal("paranoia") }).strict(),
]);
type Effect = z.infer<typeof effect>;
type Instruction = { kind: "effects"; effects: Effect[] } | { kind: "sequence"; steps: Instruction[] } | { kind: "choice"; options: Instruction[] }
  | { kind: "optional"; cost: Effect[]; reward: Instruction; decline?: Instruction }
  | { kind: "test"; skill: "observation" | "lore" | "will"; modifier: number; pass: Instruction; fail: Instruction };
const instruction: z.ZodType<Instruction> = z.lazy(() => z.union([
  z.object({ kind: z.literal("effects"), effects: z.array(effect) }).strict(),
  z.object({ kind: z.literal("sequence"), steps: z.array(instruction) }).strict(),
  z.object({ kind: z.literal("choice"), options: z.array(instruction).min(1) }).strict(),
  z.object({ kind: z.literal("optional"), cost: z.array(effect).min(1), reward: instruction, decline: instruction.optional() }).strict(),
  z.object({ kind: z.literal("test"), skill: z.enum(["observation", "lore", "will"]), modifier: z.number().int(), pass: instruction, fail: instruction }).strict(),
]));
const e = (...effects: Effect[]): Instruction => ({ kind: "effects", effects });
const t = (skill: "observation" | "lore" | "will", pass: Instruction, fail = e(), modifier = 0): Instruction => ({ kind: "test", skill, modifier, pass, fail });
const close: Effect = { kind: "close_encountered_gate" };
const schema = z.object({
  id: z.string(), deck: z.literal("other_world"), number: z.number().int(), name: z.string(), sourceScan: z.string(), sourceCellIndex: z.number().int(),
  verification: z.literal("mechanics_verified_from_scan"), rulesStatus: z.literal("transcribed_pending_execution"),
  sections: z.object({ initial: instruction }).strict(),
}).strict();
export const baseGameOtherWorldEncounterRules = [
  {
    number: 1, name: "Great Hall of Celaeno",
    initial: t("observation", { kind: "sequence", steps: [e(close), t("lore", { kind: "choice", options: [e({ kind: "clues", amount: 1 }), e({ kind: "spell", amount: 1 })] }, e({ kind: "sanity", amount: -2 }))] },
      { kind: "choice", options: [e({ kind: "clues", amount: -1 }), e({ kind: "sanity", amount: -3 })] }, -1),
  },
  {
    number: 2, name: "The Future",
    initial: t("will", { kind: "sequence", steps: [e(close), t("observation", e({ kind: "clues", amount: 2 }))] },
      t("lore", e(), e({ kind: "sanity", amount: -6 })), -1),
  },
  {
    number: 3, name: "City of the Great Race",
    initial: t("lore", { kind: "sequence", steps: [e(close), t("will", e({ kind: "clues", amount: 1 }))] },
      { kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: e(), decline: e({ kind: "sanity", amount: -2 }, { kind: "condition", condition: "paranoia" }) }, -1),
  },
].map(({ number, name, initial }) => {
  const scan = baseGameScannedTokenEncounters.find(card => card.deck === "other_world" && card.number === number)!;
  return schema.parse({ id: scan.id, deck: "other_world", number, name, sourceScan: scan.sourceScan, sourceCellIndex: scan.sourceCellIndex,
    verification: "mechanics_verified_from_scan", rulesStatus: "transcribed_pending_execution", sections: { initial } });
});
export function validateOtherWorldEncounterContent(cards: readonly z.infer<typeof schema>[]): void {
  const parsed = z.array(schema).parse(cards);
  if (new Set(parsed.map(card => card.id)).size !== parsed.length) throw new Error("Duplicate Other World IDs.");
  for (const card of parsed) if (JSON.stringify(card) !== JSON.stringify(baseGameOtherWorldEncounterRules.find(candidate => candidate.id === card.id))) throw new Error("Invalid Other World scan mapping or mechanics.");
}
validateOtherWorldEncounterContent(baseGameOtherWorldEncounterRules);
