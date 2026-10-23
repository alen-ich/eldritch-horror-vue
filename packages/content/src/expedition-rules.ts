import { z } from "zod";
import { expeditionLocationIds, skillIds, type SkillId } from "@eldritch/protocol";
import { baseGameExpeditionSetup } from "./expeditions.js";
import { baseGameScannedTokenEncounters } from "./token-encounters.js";

const testSchema = z.object({ skill: z.enum(skillIds), modifier: z.number().int().min(-1).max(0) }).strict();
const sectionSchema = z.object({ mechanics: z.string().min(1), test: testSchema }).strict();
const initialSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("test"), skill: z.enum(skillIds), modifier: z.literal(0), mechanics: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("spawn_and_encounter_monster"), mechanics: z.string().min(1) }).strict(),
]);
const cardSchema = z.object({
  id: z.string().min(1), locationId: z.enum(expeditionLocationIds), number: z.number().int().min(1).max(3),
  sourceScan: z.string().startsWith("source-assets/expeditions/"), sourceCellIndex: z.number().int().min(0).max(2),
  verification: z.literal("mechanics_verified_from_scan"), effectStatus: z.literal("not_executable"),
  initial: initialSchema, pass: sectionSchema, fail: sectionSchema,
}).strict();
export type ExpeditionMechanicalEntry = z.infer<typeof cardSchema>;
type Transcription = Pick<ExpeditionMechanicalEntry, "initial" | "pass" | "fail">;

function initial(skill: SkillId): Transcription["initial"] {
  return { kind: "test", skill, modifier: 0, mechanics: `Test ${skill[0]!.toUpperCase()}${skill.slice(1)} (0).` };
}
function section(skill: SkillId, modifier: -1 | 0, mechanics: string): Transcription["pass"] {
  return { test: { skill, modifier }, mechanics };
}

/** Descriptive source verification only. Never passed to the encounter interpreter. */
const transcriptions: Readonly<Record<string, Transcription>> = {
  the_heart_of_africa_01: {
    initial: initial("strength"),
    pass: section("lore", 0, "Retreat Doom by 1. Test Lore (0). On failure, gain an Amnesia Condition."),
    fail: section("observation", -1, "Lose 1 Health and gain a Back Injury Condition. Test Observation (-1). On success, retreat Doom by 1."),
  },
  the_heart_of_africa_02: {
    initial: initial("observation"),
    pass: section("lore", 0, "Test Lore (0). On success, gain 1 Artifact. On failure, gain a Hallucinations Condition."),
    fail: section("strength", -1, "Test Strength (-1). On success, gain 2 Clues. On failure, gain a Detained Condition."),
  },
  the_heart_of_africa_03: {
    initial: initial("strength"),
    pass: section("observation", -1, "Gain 1 Artifact. Test Observation (-1). On failure, lose 1 Sanity."),
    fail: section("influence", 0, "Gain a Leg Injury Condition. Test Influence (0). On success, gain 1 Artifact. On failure, lose 2 Health."),
  },
  the_himalayas_01: {
    initial: { kind: "spawn_and_encounter_monster", mechanics: "Spawn a Monster on your space and immediately encounter it. If you defeat it, resolve the pass effect. If you do not defeat it, resolve the fail effect." },
    pass: section("lore", 0, "Retreat Doom by 1. Test Lore (0). On failure, lose 2 Sanity."),
    fail: section("observation", 0, "Test Observation (0). On success, discard that Monster and retreat Doom by 1. On failure, lose 1 Sanity."),
  },
  the_himalayas_02: {
    initial: initial("observation"),
    pass: section("will", 0, "Test Will (0). On success, gain 1 Artifact. On failure, gain a Paranoia Condition."),
    fail: section("strength", -1, "Test Strength (-1). On success, gain 2 Clues. On failure, gain an Internal Injury Condition."),
  },
  the_himalayas_03: {
    initial: initial("strength"),
    pass: section("lore", -1, "Gain 1 Artifact. Test Lore (-1). On failure, lose 2 Sanity."),
    fail: section("influence", 0, "Test Influence (0). On success, gain 1 Artifact. On failure, gain a Paranoia Condition."),
  },
  the_amazon_01: {
    initial: initial("strength"),
    pass: section("lore", 0, "Retreat Doom by 1. Test Lore (0). On failure, gain an Amnesia Condition."),
    fail: section("observation", -1, "Lose 1 Health and gain an Internal Injury Condition. Test Observation (-1). On success, retreat Doom by 1."),
  },
  the_amazon_02: {
    initial: initial("observation"),
    pass: section("lore", 0, "Test Lore (0). On success, gain 1 Artifact. On failure, lose 2 Sanity."),
    fail: section("strength", -1, "Test Strength (-1). On success, gain 2 Clues. On failure, gain a Back Injury Condition."),
  },
  the_amazon_03: {
    initial: initial("strength"),
    pass: section("observation", -1, "Gain 1 Artifact. Test Observation (-1). On success, gain 1 Clue. On failure, lose 1 Sanity."),
    fail: section("influence", 0, "Gain a Leg Injury Condition. Test Influence (0). On success, gain 1 Artifact. On failure, lose 2 Health."),
  },
  tunguska_01: {
    initial: initial("strength"),
    pass: section("lore", 0, "Test Lore (0). On success, retreat Doom by 1. On failure, gain an Amnesia Condition."),
    fail: section("observation", -1, "Lose 1 Health and gain a Leg Injury Condition. Test Observation (-1). On success, retreat Doom by 1."),
  },
  tunguska_02: {
    initial: initial("observation"),
    pass: section("will", 0, "Test Will (0). On success, gain 1 Artifact. On failure, gain a Paranoia Condition."),
    fail: section("strength", -1, "Test Strength (-1). On success, gain 2 Clues. On failure, gain a Back Injury Condition."),
  },
  tunguska_03: {
    initial: initial("strength"),
    pass: section("observation", -1, "Gain 1 Artifact. Test Observation (-1). On success, gain 1 Clue. On failure, lose 1 Sanity."),
    fail: section("influence", 0, "Gain an Internal Injury Condition. Test Influence (0). On success, gain 1 Artifact. On failure, lose 2 Health."),
  },
  antarctica_01: {
    initial: initial("strength"),
    pass: section("will", 0, "Retreat Doom by 1. Test Will (0). On failure, gain an Amnesia Condition."),
    fail: section("observation", -1, "Lose 1 Health and gain a Back Injury Condition. Test Observation (-1). On success, retreat Doom by 1."),
  },
  antarctica_02: {
    initial: initial("observation"),
    pass: section("will", 0, "Test Will (0). On success, gain 1 Artifact. On failure, gain a Hallucinations Condition."),
    fail: section("strength", -1, "Test Strength (-1). On success, gain 2 Clues. On failure, gain a Leg Injury Condition."),
  },
  antarctica_03: {
    initial: initial("strength"),
    pass: section("observation", -1, "Gain 1 Artifact. Test Observation (-1). On failure, lose 1 Sanity."),
    fail: section("influence", 0, "Gain a Leg Injury Condition. Test Influence (0). On success, gain 1 Artifact. On failure, lose 2 Health."),
  },
  the_pyramids_01: {
    initial: initial("strength"),
    pass: section("lore", 0, "Retreat Doom by 1. Test Lore (0). On failure, gain an Amnesia Condition."),
    fail: section("observation", -1, "Lose 1 Health and gain an Internal Injury Condition. Test Observation (-1). On success, retreat Doom by 1."),
  },
  the_pyramids_02: {
    initial: initial("observation"),
    pass: section("lore", 0, "Test Lore (0). On success, gain 1 Artifact. On failure, lose 2 Sanity."),
    fail: section("strength", -1, "Test Strength (-1). On success, gain 2 Clues. On failure, lose 1 Health and gain an Internal Injury Condition."),
  },
  the_pyramids_03: {
    initial: initial("strength"),
    pass: section("observation", -1, "Gain 1 Artifact. Test Observation (-1). On failure, lose 1 Health."),
    fail: section("influence", 0, "Gain a Leg Injury Condition. Test Influence (0). On success, gain 1 Artifact. On failure, lose 2 Health."),
  },
};

export const baseGameExpeditionRules: readonly ExpeditionMechanicalEntry[] = baseGameExpeditionSetup.map(setup => {
  const scan = baseGameScannedTokenEncounters.find(card => card.id === setup.id)!;
  const transcription = transcriptions[setup.id.slice("encounter_expedition_".length)];
  if (!transcription) throw new Error(`Missing Expedition transcription: ${setup.id}`);
  return cardSchema.parse({ ...setup, number: scan.number, sourceScan: scan.sourceScan, sourceCellIndex: scan.sourceCellIndex,
    verification: "mechanics_verified_from_scan", effectStatus: "not_executable", ...transcription });
});

export function validateExpeditionRules(cards: readonly ExpeditionMechanicalEntry[]): void {
  const parsed = z.array(cardSchema).length(18).parse(cards);
  if (new Set(parsed.map(card => card.id)).size !== 18) throw new Error("Expedition mechanics require unique physical IDs.");
  for (const card of parsed) {
    const expected = baseGameExpeditionRules.find(entry => entry.id === card.id);
    if (!expected || JSON.stringify(card) !== JSON.stringify(cardSchema.parse(expected))) {
      throw new Error(`Invalid verified Expedition mechanics or source mapping: ${card.id}`);
    }
  }
}

validateExpeditionRules(baseGameExpeditionRules);
