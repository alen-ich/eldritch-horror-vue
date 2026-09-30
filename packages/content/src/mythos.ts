import { z } from "zod";
import type { LocationId } from "@eldritch/protocol";

export const mythosColors = ["green", "yellow", "blue"] as const;
export type MythosColor = (typeof mythosColors)[number];
export type MythosCardKind = "event" | "ongoing" | "rumor";
export type MythosIcon =
  | { type: "advance_omen" | "resolve_reckoning" | "spawn_gates" | "monster_surge" | "spawn_clues" }
  | { type: "place_rumor_token"; spaceId: LocationId }
  | { type: "place_eldritch_tokens"; count: number };

export interface MythosCardData {
  id: `mythos_${MythosColor}_${number}`;
  color: MythosColor;
  title: string;
  kind: MythosCardKind;
  icons: readonly MythosIcon[];
  imageUrl: string;
  source: { sheet: string; row: number; column: number };
  verification: "verified_from_scan";
  effectModelStatus: "transcription_pending" | "typed";
  effect?: { type: "lead_gain_condition"; kind: "blessed" } | { type: "move_omen_counterclockwise_then_advance_doom_for_gates" } | { type: "lead_choose_omen_without_doom" } | { type: "each_investigator_choose_world_fights_back" } | { type: "lead_gain_ally_asset" } | { type: "each_investigator_trade_debt_for_condition" } | { type: "discard_matching_gates_and_advance_doom" } | { type: "doom_two_unless_lead_gains_dark_pact" } | { type: "spawn_monster_on_each_cultist_space" } | { type: "roll_each_investigator_for_bermuda_triangle" } | { type: "group_discard_gate_then_advance_doom_if_nonmatching" } | { type: "torn_asunder" } | { type: "each_investigator_choose_heat_wave" };
}

const blueTitles = [
  "Secrets of the Past", "Fractured Reality", "Growing Madness", "Lost Knowledge", "Mysterious Lights", "Dimensions Collide",
  "Spreading Sickness", "Web Between Worlds", "Stars Aligned", "Faded From Society", "Return of the Ancient Ones", "The Wind-Walker",
] as const;

const yellowTitles = [
  "Burden of Greed", "Haunting Nightmares", "Treacherous Magic",
  "Silver Twilight Aid", "Rally the People", "Everyone Has a Price", "The World Fights Back", "Omen of Good Fortune", "Eyes Everywhere",
  "Desperate Times", "The Storm", "All For Nothing", "Perplexing Stars", "Heat Wave Singes the Globe", "Arrests Made in Murder Case!",
  "Tide of Despair", "From Bad to Worse", "A Dark Power", "The World Shakes", "The Bermuda Triangle", "Ancient Guardians",
] as const;

const greenCards = [
  ["Buying Information", "event"], ["A Proposition", "event"], ["That Which Consumes", "event"], ["Support of the Church", "event"], ["Heart of Corruption", "event"], ["Tied to a Dark Purpose", "event"],
  ["Rising Terror", "event"], ["Torn Asunder", "event"], ["From Beyond", "event"], ["Strange Sightings", "ongoing"], ["Unexpected Betrayal", "event"], ["No Peace for the Fallen", "event"],
  ["Legitimate Banking", "event"], ["Dimensional Instability", "event"], ["Driven to Bankruptcy", "ongoing"], ["Blood Flows", "event"], ["Patrolling the Border", "ongoing"], ["Calling the Elder Things", "event"],
] as const satisfies readonly (readonly [string, Exclude<MythosCardKind, "rumor">])[];

const greenIcons: readonly MythosIcon[] = [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }];
const yellowIcons: readonly MythosIcon[] = [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }];
const blueIconDetails: readonly { spaceId?: LocationId; eldritch?: number }[] = [
  {}, { spaceId: "space_2", eldritch: 4 }, { spaceId: "space_8", eldritch: 4 }, { eldritch: 3 },
  { spaceId: "space_13" }, { spaceId: "space_11", eldritch: 8 }, { spaceId: "space_17" }, { eldritch: 3 },
  { spaceId: "space_7" }, { spaceId: "space_16", eldritch: 4 }, { spaceId: "space_19" }, { eldritch: 4 },
];

function iconsFor(color: MythosColor, index: number): MythosIcon[] {
  if (color === "green") return [...greenIcons];
  if (color === "yellow") return [...yellowIcons];
  const detail = blueIconDetails[index];
  if (!detail) throw new Error(`Missing blue Mythos icon data at ${index}.`);
  return [
    { type: "spawn_clues" },
    ...(detail.spaceId ? [{ type: "place_rumor_token" as const, spaceId: detail.spaceId }] : []),
    ...(detail.eldritch ? [{ type: "place_eldritch_tokens" as const, count: detail.eldritch }] : []),
  ];
}

function cardId(color: MythosColor, index: number): MythosCardData["id"] {
  return `mythos_${color}_${String(index + 1).padStart(2, "0")}` as MythosCardData["id"];
}

function scanCard(
  color: MythosColor,
  index: number,
  title: string,
  kind: MythosCardKind,
  source: MythosCardData["source"],
): MythosCardData {
  const id = cardId(color, index);
  const effect = id === "mythos_green_04" ? { type: "lead_gain_condition" as const, kind: "blessed" as const }
    : id === "mythos_yellow_13" ? { type: "move_omen_counterclockwise_then_advance_doom_for_gates" as const }
      : id === "mythos_yellow_08" ? { type: "lead_choose_omen_without_doom" as const }
      : id === "mythos_yellow_07" ? { type: "each_investigator_choose_world_fights_back" as const }
      : id === "mythos_yellow_05" ? { type: "lead_gain_ally_asset" as const }
      : id === "mythos_yellow_06" ? { type: "each_investigator_trade_debt_for_condition" as const }
      : id === "mythos_green_14" ? { type: "discard_matching_gates_and_advance_doom" as const }
      : id === "mythos_yellow_10" ? { type: "doom_two_unless_lead_gains_dark_pact" as const }
      : id === "mythos_green_18" ? { type: "spawn_monster_on_each_cultist_space" as const }
      : id === "mythos_yellow_20" ? { type: "roll_each_investigator_for_bermuda_triangle" as const }
      : id === "mythos_green_03" ? { type: "group_discard_gate_then_advance_doom_if_nonmatching" as const }
      : id === "mythos_green_08" ? { type: "torn_asunder" as const }
      : id === "mythos_yellow_14" ? { type: "each_investigator_choose_heat_wave" as const }
      : undefined;
  return { id, color, title, kind, icons: iconsFor(color, index), imageUrl: `/cards/mythos/${id}.webp`, source, verification: "verified_from_scan", effectModelStatus: effect ? "typed" : "transcription_pending", ...(effect ? { effect } : {}) };
}

export const baseGameMythosCards: readonly MythosCardData[] = [
  ...blueTitles.map((title, index) => scanCard("blue", index, title, "rumor", {
    sheet: "photo_2026-09-28_01-13-39.jpg", row: Math.floor(index / 6) + 1, column: (index % 6) + 1,
  })),
  ...yellowTitles.map((title, index) => scanCard("yellow", index, title, "event", index < 3
    ? { sheet: "photo_2026-09-28_01-14-01.jpg", row: 1, column: index + 1 }
    : { sheet: "photo_2026-09-28_01-14-07.jpg", row: Math.floor((index - 3) / 6) + 1, column: ((index - 3) % 6) + 1 })),
  ...greenCards.map(([title, kind], index) => scanCard("green", index, title, kind, {
    sheet: "photo_2026-09-28_01-14-10.jpg", row: Math.floor(index / 6) + 1, column: (index % 6) + 1,
  })),
];

const mythosCardSchema = z.object({
  id: z.string().regex(/^mythos_(green|yellow|blue)_\d{2}$/),
  color: z.enum(mythosColors),
  title: z.string().min(1),
  kind: z.enum(["event", "ongoing", "rumor"]),
  icons: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.enum(["advance_omen", "resolve_reckoning", "spawn_gates", "monster_surge", "spawn_clues"]) }).strict(),
    z.object({ type: z.literal("place_rumor_token"), spaceId: z.string().regex(/^space_(?:[1-9]|1\d|2[01])$/) }).strict(),
    z.object({ type: z.literal("place_eldritch_tokens"), count: z.number().int().positive() }).strict(),
  ])).min(1),
  imageUrl: z.string().regex(/^\/cards\/mythos\/mythos_(green|yellow|blue)_\d{2}\.webp$/),
  source: z.object({ sheet: z.string().regex(/^photo_.+\.jpg$/), row: z.number().int().positive(), column: z.number().int().positive() }).strict(),
  verification: z.literal("verified_from_scan"),
  effectModelStatus: z.enum(["transcription_pending", "typed"]),
  effect: z.discriminatedUnion("type", [
    z.object({ type: z.literal("lead_gain_condition"), kind: z.literal("blessed") }).strict(),
    z.object({ type: z.literal("move_omen_counterclockwise_then_advance_doom_for_gates") }).strict(),
    z.object({ type: z.literal("lead_choose_omen_without_doom") }).strict(),
    z.object({ type: z.literal("each_investigator_choose_world_fights_back") }).strict(),
    z.object({ type: z.literal("lead_gain_ally_asset") }).strict(),
    z.object({ type: z.literal("each_investigator_trade_debt_for_condition") }).strict(),
    z.object({ type: z.literal("discard_matching_gates_and_advance_doom") }).strict(),
    z.object({ type: z.literal("doom_two_unless_lead_gains_dark_pact") }).strict(),
    z.object({ type: z.literal("spawn_monster_on_each_cultist_space") }).strict(),
    z.object({ type: z.literal("roll_each_investigator_for_bermuda_triangle") }).strict(),
    z.object({ type: z.literal("group_discard_gate_then_advance_doom_if_nonmatching") }).strict(),
    z.object({ type: z.literal("torn_asunder") }).strict(),
    z.object({ type: z.literal("each_investigator_choose_heat_wave") }).strict(),
  ]).optional(),
}).strict();

export function validateMythosContent(cards: readonly MythosCardData[]): void {
  const parsed = z.array(mythosCardSchema).parse(cards);
  if (parsed.length !== 51) throw new Error("Base-game Mythos deck must contain exactly 51 cards.");
  if (new Set(parsed.map(({ id }) => id)).size !== parsed.length) throw new Error("Mythos content contains duplicate IDs.");
  if (new Set(parsed.map(({ title }) => title)).size !== parsed.length) throw new Error("Mythos content contains duplicate titles.");
  const expectedCounts: Record<MythosColor, number> = { green: 18, yellow: 21, blue: 12 };
  for (const color of mythosColors) {
    if (parsed.filter((card) => card.color === color).length !== expectedCounts[color]) {
      throw new Error(`Base-game Mythos deck has an invalid ${color} card count.`);
    }
  }
  for (const card of parsed) {
    if ((card.effectModelStatus === "typed") !== Boolean(card.effect)) throw new Error(`Mythos effect status mismatch for ${card.id}.`);
    if (card.id === "mythos_green_04" && card.effect?.type !== "lead_gain_condition") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_13" && card.effect?.type !== "move_omen_counterclockwise_then_advance_doom_for_gates") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_08" && card.effect?.type !== "lead_choose_omen_without_doom") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_07" && card.effect?.type !== "each_investigator_choose_world_fights_back") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_05" && card.effect?.type !== "lead_gain_ally_asset") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_06" && card.effect?.type !== "each_investigator_trade_debt_for_condition") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_green_14" && card.effect?.type !== "discard_matching_gates_and_advance_doom") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_10" && card.effect?.type !== "doom_two_unless_lead_gains_dark_pact") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_green_18" && card.effect?.type !== "spawn_monster_on_each_cultist_space") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_20" && card.effect?.type !== "roll_each_investigator_for_bermuda_triangle") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_green_03" && card.effect?.type !== "group_discard_gate_then_advance_doom_if_nonmatching") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_green_08" && card.effect?.type !== "torn_asunder") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (card.id === "mythos_yellow_14" && card.effect?.type !== "each_investigator_choose_heat_wave") throw new Error(`Invalid Mythos effect for ${card.id}.`);
    if (!(["mythos_green_03", "mythos_green_04", "mythos_green_08", "mythos_green_14", "mythos_green_18", "mythos_yellow_05", "mythos_yellow_06", "mythos_yellow_07", "mythos_yellow_08", "mythos_yellow_10", "mythos_yellow_13", "mythos_yellow_14", "mythos_yellow_20"].includes(card.id)) && card.effect) throw new Error(`Unexpected Mythos effect transcription for ${card.id}.`);
    const colorIndex = Number.parseInt(card.id.slice(`mythos_${card.color}_`.length), 10) - 1;
    if (JSON.stringify(card.icons) !== JSON.stringify(iconsFor(card.color, colorIndex))) {
      throw new Error(`Invalid icon sequence for ${card.id}.`);
    }
  }
  if (parsed.some((card) => card.color === "blue" && card.kind !== "rumor")) throw new Error("Every blue base-game Mythos card must be a Rumor.");
}

validateMythosContent(baseGameMythosCards);
