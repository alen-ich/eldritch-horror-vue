import type { EncounterSection, LocationEncounterDeck } from "./location-encounters.js";

// Transcription of the printed mechanical instructions, not an executable rules engine.
// In particular, these records must not be used to draw or resolve encounters until
// conditions, spells, artifacts, targeting, and investigator choices are implemented.
export type EncounterSkill = "lore" | "influence" | "observation" | "strength" | "will";
export type EncounterCondition = "amnesia" | "back_injury" | "blessed" | "cursed" | "debt" | "detained" | "hallucinations" | "internal_injury" | "leg_injury" | "madness" | "paranoia";
export type EncounterTrait = "ally" | "incantation" | "item" | "ritual" | "service" | "tome" | "weapon";

export type EncounterEffect =
  | { kind: "clues" | "health" | "sanity" | "recover_health" | "recover_sanity" | "spawn_clues"; amount: number; target?: "chosen_space" }
  | { kind: "delay" }
  | { kind: "improve"; skill: EncounterSkill | "chosen" }
  | { kind: "condition"; condition: EncounterCondition }
  | { kind: "asset"; trait: EncounterTrait; source: "deck" | "reserve" }
  | { kind: "spell" | "artifact"; trait?: EncounterTrait; amount: number }
  | { kind: "discard"; target: "item" | "madness" | "blessed" }
  | { kind: "move"; amount: number }
  | { kind: "monster_damage"; amount: number; target: "chosen_space_all" | "chosen_monster" }
  | { kind: "monster_discard"; target: "chosen_monster" }
  | { kind: "monster_move"; target: "chosen_monster"; destination: "investigator_space" | "chosen_space"; nonEpic?: boolean }
  | { kind: "monster_encounter"; target: "moved_monster" };

export type EncounterInstruction =
  | { kind: "effects"; effects: readonly EncounterEffect[] }
  | { kind: "sequence"; steps: readonly EncounterInstruction[] }
  | { kind: "choice"; options: readonly EncounterInstruction[] }
  | { kind: "optional"; cost: readonly EncounterEffect[]; reward: EncounterInstruction }
  | { kind: "test"; skill: EncounterSkill; modifier: number; pass: EncounterInstruction; fail: EncounterInstruction };

export interface LocationEncounterRuleCard {
  id: string;
  deck: LocationEncounterDeck;
  number: number;
  sections: Readonly<Partial<Record<EncounterSection, EncounterInstruction>>>;
}

const e = (...effects: EncounterEffect[]): EncounterInstruction => ({ kind: "effects", effects });
const q = (...options: EncounterInstruction[]): EncounterInstruction => ({ kind: "choice", options });
const s = (...steps: EncounterInstruction[]): EncounterInstruction => ({ kind: "sequence", steps });
const o = (cost: EncounterEffect[], reward: EncounterInstruction): EncounterInstruction => ({ kind: "optional", cost, reward });
const t = (skill: EncounterSkill, pass: EncounterInstruction, fail: EncounterInstruction = e(), modifier = 0): EncounterInstruction => ({ kind: "test", skill, modifier, pass, fail });
const n = (kind: "clues" | "health" | "sanity" | "recover_health" | "recover_sanity" | "spawn_clues", amount = 1): EncounterEffect => ({ kind, amount });
const clue = (amount = 1) => n("clues", amount);
const hp = (amount = -1) => n("health", amount);
const san = (amount = -1) => n("sanity", amount);
const rh = (amount = 1) => n("recover_health", amount);
const rs = (amount = 1) => n("recover_sanity", amount);
const spawn = (amount = 1, target?: "chosen_space"): EncounterEffect => ({ kind: "spawn_clues", amount, ...(target ? { target } : {}) });
const improve = (skill: EncounterSkill | "chosen"): EncounterEffect => ({ kind: "improve", skill });
const condition = (value: EncounterCondition): EncounterEffect => ({ kind: "condition", condition: value });
const asset = (trait: EncounterTrait, source: "deck" | "reserve" = "deck"): EncounterEffect => ({ kind: "asset", trait, source });
const spell = (trait?: EncounterTrait, amount = 1): EncounterEffect => ({ kind: "spell", amount, ...(trait ? { trait } : {}) });
const artifact = (trait?: EncounterTrait): EncounterEffect => ({ kind: "artifact", amount: 1, ...(trait ? { trait } : {}) });
const discard = (target: "item" | "madness" | "blessed"): EncounterEffect => ({ kind: "discard", target });
const delay: EncounterEffect = { kind: "delay" };
const move: EncounterEffect = { kind: "move", amount: 1 };
const damage = (amount: number, target: "chosen_space_all" | "chosen_monster" = "chosen_monster"): EncounterEffect => ({ kind: "monster_damage", amount, target });

// Each row is one physical card, in printed section order. A negative health,
// sanity, or clue delta represents a loss or cost, not a recovery effect.
const general: readonly [EncounterInstruction, EncounterInstruction, EncounterInstruction][] = [
  [t("observation", q(e(asset("item", "reserve")), e(asset("item"))), e(condition("detained"))), e(asset("item"), san()), t("observation", e(artifact()), e(delay))],
  [t("influence", e(spawn()), e(condition("debt"))), t("will", q(e(clue()), e(improve("lore"))), e(condition("cursed"))), e(move, san())],
  [t("strength", q(e(asset("item", "reserve")), e(asset("item"))), e(hp(), discard("item"))), t("lore", q(e(clue()), e(spell()))), t("lore", e(condition("blessed"), rh(), rs()), e(), -1)],
  [t("influence", e(), e(condition("leg_injury"))), t("observation", e(move), e(hp(), condition("leg_injury"))), t("observation", e(clue(), asset("ally")), e(condition("paranoia")))],
  [t("influence", e(asset("weapon")), e(condition("detained"))), o([clue(-1)], e(artifact())), o([delay], e(artifact()))],
  [t("lore", e(artifact("tome")), e(), -1), t("observation", e(artifact("tome"))), t("lore", q(e(clue()), e(improve("will"))), e(condition("cursed")))],
  [t("influence", e(asset("ally")), e(condition("debt"))), t("observation", e(move), e(delay, condition("madness"))), e(san(), condition("back_injury"))],
  [s(e(rs(2)), t("observation", e(), e(discard("item")))), t("lore", q(e(clue()), e(improve("influence"))), e(condition("cursed"))), t("influence", e(clue()))],
  [t("strength", e(asset("ally")), e(hp())), t("strength", e(improve("will")), e(hp(), condition("leg_injury"))), t("influence", e(spawn()))],
  [t("will", e(spawn()), e(san(-2))), t("strength", e(), e(condition("hallucinations"))), t("strength", e(), e(delay))],
  [t("will", e(rs(2)), e(condition("paranoia"))), o([delay], q(e(rs(3)), e(discard("madness")))), t("lore", e(spell()), e(condition("cursed")))],
  [t("influence", q(e(asset("service", "reserve")), e(asset("service")))), t("will", e(artifact()), e(san(-2)), -1), t("strength", e(), e(discard("item")))],
];

const america: readonly [EncounterInstruction, EncounterInstruction, EncounterInstruction][] = [
  [s(e(spell("incantation")), t("lore", e(), e(condition("hallucinations")))), o([clue(-1)], e(improve("observation"))), t("lore", e(condition("blessed")), e(san(-2)))],
  [s(e(spell("incantation")), t("will", e(), e(condition("paranoia")), 1)), t("will", e(improve("chosen")), e(condition("leg_injury")), -1), t("lore", e(spell("ritual")), e(san()))],
  [t("lore", e(spell()), e(), 1), t("influence", e(improve("observation")), e(condition("debt"))), t("lore", e(spell()), e(condition("debt")), 1)],
  [o([clue(-1)], e(spell("incantation"))), t("will", e(condition("blessed")), e(condition("detained"))), o([clue(-1)], e(spell("ritual")))],
  [t("observation", e(spell("incantation")), e(hp())), o([delay], e(improve("chosen"))), s(e(spell("ritual")), t("will", e(), e(condition("detained"))))],
  [t("lore", e(spell("incantation")), e(condition("amnesia"))), s(e(improve("observation")), t("lore", e(), e(hp(), san()))), s(e(spell("ritual")), t("lore", e(), e(condition("paranoia"))))],
  [o([delay], e(spell(undefined, 2))), s(e(improve("observation")), t("will", e(), e(san(-2)), -1)), o([delay], e(spell(undefined, 2)))],
  [t("lore", e(condition("blessed")), e(condition("paranoia"))), t("will", e(improve("observation")), e(condition("madness"))), t("influence", e(spell("ritual")))],
];

const europe: readonly [EncounterInstruction, EncounterInstruction, EncounterInstruction][] = [
  [t("observation", e(condition("blessed")), e(delay)), t("influence", e(improve("will"))), t("influence", e(improve("chosen")), e(condition("debt")), -1)],
  [t("observation", e(spawn(2)), e(condition("hallucinations"))), s(e(improve("will")), t("influence", e(), e(hp(), san()))), o([delay], e(improve("chosen")))],
  [t("observation", e(clue()), e(), -1), t("influence", e(condition("blessed")), e(san(), discard("blessed")), -1), t("lore", e(improve("influence")))],
  [o([condition("debt")], e(clue(2))), o([delay], e(condition("blessed"))), t("will", e(improve("influence")), e(condition("madness")))],
  [s(e(spawn(1, "chosen_space")), t("strength", e(), e(condition("detained")))), t("will", e(improve("will")), e(san())), o([clue(-1)], e(improve("influence")))],
  [t("observation", e(spawn(1, "chosen_space")), e(san())), t("influence", e(condition("blessed")), e(condition("detained"))), s(e(improve("influence")), t("will", e(), e(hp(-2))))],
  [s(e(spawn(2)), t("observation", e(), e(condition("internal_injury")))), o([], s(e(improve("chosen")), t("will", e(), e(condition("cursed"))))), s(e(improve("influence")), t("will", e(), e(san(-2))))],
  [o([delay], e(spawn(2))), s(e(improve("will")), t("will", e(), e(condition("paranoia")), -1)), t("observation", e(condition("blessed")), e(condition("back_injury")))],
];

const asiaAustralia: readonly [EncounterInstruction, EncounterInstruction, EncounterInstruction][] = [
  [t("observation", e(improve("lore")), e(san())), t("influence", e(damage(2, "chosen_space_all")), e(condition("back_injury"))), t("will", e(improve("strength")), e(san()))],
  [t("influence", e(improve("chosen")), e(hp())), o([delay], e(damage(3))), s(e(improve("strength")), t("strength", e(), e(hp(-2)), -1))],
  [s(e(improve("lore")), t("will", e(), e(condition("hallucinations")))), e({ kind: "monster_move", target: "chosen_monster", destination: "investigator_space", nonEpic: true }, { kind: "monster_encounter", target: "moved_monster" }), s(e(improve("strength")), t("influence", e(), e(condition("detained"))))],
  [t("influence", e(improve("lore"))), t("influence", e(damage(2)), e(condition("detained"))), t("will", e(improve("strength")), e(san()))],
  [o([clue(-1)], e(improve("lore"))), t("influence", e(damage(3)), e(condition("detained")), -1), o([clue(-1)], e(improve("strength")))],
  [s(e(improve("lore")), t("observation", e(), e(delay))), t("will", e(condition("blessed")), e(condition("hallucinations"))), t("influence", e(asset("weapon")), e(condition("debt")), -1)],
  [o([delay], e(improve("chosen"))), o([clue(-1)], e({ kind: "monster_discard", target: "chosen_monster" })), t("influence", e(condition("blessed")), e(condition("detained")))],
  [t("strength", e(condition("blessed")), e(condition("detained"))), t("influence", e({ kind: "monster_move", target: "chosen_monster", destination: "chosen_space" })), o([delay], e(asset("weapon")))],
];

const rows: Readonly<Record<LocationEncounterDeck, readonly [EncounterInstruction, EncounterInstruction, EncounterInstruction][]>> = {
  general,
  america,
  europe,
  asia_australia: asiaAustralia,
};

const labels: Readonly<Record<LocationEncounterDeck, readonly [EncounterSection, EncounterSection, EncounterSection]>> = {
  general: ["city", "wilderness", "sea"],
  america: ["arkham", "san_francisco", "buenos_aires"],
  europe: ["london", "rome", "istanbul"],
  asia_australia: ["shanghai", "tokyo", "sydney"],
};

export const baseGameLocationEncounterRules: readonly LocationEncounterRuleCard[] = (Object.keys(rows) as LocationEncounterDeck[]).flatMap(deck =>
  rows[deck].map((instructions, index) => ({
    id: `encounter_${deck}_${String(index + 1).padStart(2, "0")}`,
    deck,
    number: index + 1,
    sections: Object.fromEntries(labels[deck].map((label, sectionIndex) => [label, instructions[sectionIndex]!])) as LocationEncounterRuleCard["sections"],
  })),
);

export function locationEncounterRule(id: string, section: EncounterSection): EncounterInstruction | undefined {
  return baseGameLocationEncounterRules.find(card => card.id === id)?.sections[section];
}
