import { z } from "zod";
import { baseGameScannedTokenEncounters } from "./token-encounters.js";

// Printed mechanical transcriptions only. No runtime interpretation of prose.
const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("encountered_clue"), operation: z.enum(["gain", "discard", "relocate"]), destination: z.string().min(1).optional() }).strict().refine(effect => effect.operation === "relocate" ? !!effect.destination : effect.destination === undefined),
  z.object({ kind: z.enum(["clues", "spawn_clues"]), amount: z.number().int().positive() }).strict(),
  z.object({ kind: z.enum(["health", "sanity"]), amount: z.number().int().negative() }).strict(),
  z.object({ kind: z.literal("condition"), condition: z.enum(["amnesia", "internal_injury", "back_injury", "dark_pact", "cursed", "hallucinations", "detained", "paranoia", "leg_injury"]) }).strict(),
  z.object({ kind: z.literal("delay") }).strict(),
  z.object({ kind: z.literal("doom_retreat"), amount: z.literal(1) }).strict(),
  z.object({ kind: z.literal("discard_item_assets"), amount: z.union([z.literal(1), z.literal(2)]) }).strict(),
  z.object({ kind: z.literal("spell"), id: z.literal("spell_mists_of_releh") }).strict(),
  z.object({ kind: z.literal("omen_move"), destination: z.literal("chosen"), advanceDoom: z.literal(false) }).strict(),
  z.object({ kind: z.literal("omen_advance"), amount: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("omen_eldritch"), operation: z.enum(["place", "discard"]), amount: z.literal(1), space: z.enum(["green", "chosen"]) }).strict(),
  z.object({ kind: z.literal("return_solved_mystery"), selection: z.literal("random"), shuffle: z.literal(true) }).strict(),
  z.object({ kind: z.literal("artifact"), id: z.enum(["artifact_ttka_halot", "artifact_grotesque_statue", "artifact_ruby_of_rlyeh"]) }).strict(),
]);
export type ResearchEffect = z.infer<typeof effectSchema>;
export type ResearchInstruction =
  | { kind: "effects"; effects: ResearchEffect[] }
  | { kind: "sequence"; steps: ResearchInstruction[] }
  | { kind: "optional"; cost: ResearchEffect[]; reward: ResearchInstruction; decline?: ResearchInstruction }
  | { kind: "ambush"; monsterId: "monster_cultist" | "monster_deep_one" | "monster_star_spawn"; defeated: ResearchInstruction; notDefeated: ResearchInstruction }
  | { kind: "test"; skill: "lore" | "influence" | "observation" | "strength" | "will"; modifier: number; pass: ResearchInstruction; fail: ResearchInstruction };

// Recursive schema validates trusted source data, not network commands.
const instructionSchema: z.ZodType<ResearchInstruction> = z.lazy(() => z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("effects"), effects: z.array(effectSchema) }).strict(),
  z.object({ kind: z.literal("sequence"), steps: z.array(instructionSchema).min(1) }).strict(),
  z.object({ kind: z.literal("optional"), cost: z.array(effectSchema).min(1), reward: instructionSchema, decline: instructionSchema.optional() }).strict(),
  z.object({ kind: z.literal("ambush"), monsterId: z.enum(["monster_cultist", "monster_deep_one", "monster_star_spawn"]), defeated: instructionSchema, notDefeated: instructionSchema }).strict(),
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

const nearest: ResearchEffect = { kind: "encountered_clue", operation: "relocate", destination: "nearest_sea" };
const retreat: ResearchEffect = { kind: "doom_retreat", amount: 1 };
const c = (condition: "cursed" | "hallucinations" | "detained" | "paranoia" | "leg_injury" | "amnesia"): ResearchEffect => ({ kind: "condition", condition });
const ambush = (monsterId: "monster_cultist" | "monster_deep_one" | "monster_star_spawn", defeated = e(), notDefeated = e()): ResearchInstruction => ({ kind: "ambush", monsterId, defeated, notDefeated });
// Printed card order: City, Wilderness, Sea. Ambushes remain explicitly guarded.
const cthulhu: [ResearchInstruction, ResearchInstruction, ResearchInstruction][] = [
  [t("observation", e(gain), e(nearest)), ambush("monster_cultist", e(gain), e(c("cursed"))), { kind: "optional", cost: [{ kind: "condition", condition: "dark_pact" }], reward: e(gain, { kind: "spell", id: "spell_mists_of_releh" }), decline: s(e({ kind: "encountered_clue", operation: "discard" }), ambush("monster_star_spawn")) }],
  [t("influence", e(gain, extra), e({ kind: "sanity", amount: -1 })), t("observation", e(gain, extra), e({ kind: "sanity", amount: -1 }), -1), t("will", e(gain, extra), e(c("hallucinations")))],
  [t("observation", e(gain, extra), e({ kind: "discard_item_assets", amount: 1 }), -1), t("will", e(gain), e(c("hallucinations"))), t("observation", e({ kind: "artifact", id: "artifact_grotesque_statue" }), s(e({ kind: "sanity", amount: -3 }), ambush("monster_deep_one")), -1)],
  [t("lore", e(gain), ambush("monster_deep_one")), t("observation", e(gain), e(nearest)), t("observation", e(gain), e(c("detained")))],
  [t("observation", e(gain, extra), e({ kind: "sanity", amount: -1 })), t("lore", e(gain, retreat), e(nearest), -1), t("observation", e(gain), ambush("monster_star_spawn", e(retreat)))],
  [t("observation", e(gain, { kind: "spell", id: "spell_mists_of_releh" }), e(c("paranoia"))), t("observation", e(gain), e({ kind: "discard_item_assets", amount: 2 }, nearest)), t("influence", e(gain, retreat), e(c("hallucinations")), -1)],
  [ambush("monster_cultist", e(gain), e(c("amnesia"), nearest)), t("observation", e(gain, extra), e({ kind: "sanity", amount: -2 }, { kind: "delay" })), ambush("monster_deep_one", e(gain, extra), e(c("leg_injury")))],
  [t("strength", e(gain), e({ kind: "health", amount: -1 }, c("detained"))), t("strength", e(gain), e({ kind: "delay" }, nearest)), s(e(gain, { kind: "sanity", amount: -1 }), ambush("monster_deep_one", e({ kind: "artifact", id: "artifact_ruby_of_rlyeh" })))],
];

const cardSchema = z.object({
  id: z.string().min(1), deck: z.enum(["research_azathoth", "research_cthulhu"]), number: z.number().int().min(1).max(8),
  verification: z.literal("mechanics_verified_from_scan"), effectStatus: z.literal("transcribed_pending_execution"),
  sections: z.object({ city: instructionSchema, wilderness: instructionSchema, sea: instructionSchema }).strict(),
}).strict();
export type ResearchEncounterRuleCard = z.infer<typeof cardSchema>;
export const baseGameResearchEncounterRules: readonly ResearchEncounterRuleCard[] = ([ ["research_azathoth", azathoth], ["research_cthulhu", cthulhu] ] as const).flatMap(([deck, cards]) => cards.map(([city, wilderness, sea], index) => cardSchema.parse({
  id: `encounter_${deck}_${String(index + 1).padStart(2, "0")}`, deck, number: index + 1,
  verification: "mechanics_verified_from_scan", effectStatus: "transcribed_pending_execution", sections: { city, wilderness, sea },
})));

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
