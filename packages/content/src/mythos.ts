import { z } from "zod";

export const mythosColors = ["green", "yellow", "blue"] as const;
export type MythosColor = (typeof mythosColors)[number];
export type MythosCardKind = "event" | "ongoing" | "rumor";

export interface MythosCardData {
  id: `mythos_${MythosColor}_${number}`;
  color: MythosColor;
  title: string;
  kind: MythosCardKind;
  imageUrl: string;
  source: { sheet: string; row: number; column: number };
  verification: "verified_from_scan";
  effectModelStatus: "transcription_pending";
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
  return { id, color, title, kind, imageUrl: `/cards/mythos/${id}.webp`, source, verification: "verified_from_scan", effectModelStatus: "transcription_pending" };
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
  imageUrl: z.string().regex(/^\/cards\/mythos\/mythos_(green|yellow|blue)_\d{2}\.webp$/),
  source: z.object({ sheet: z.string().regex(/^photo_.+\.jpg$/), row: z.number().int().positive(), column: z.number().int().positive() }).strict(),
  verification: z.literal("verified_from_scan"),
  effectModelStatus: z.literal("transcription_pending"),
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
  if (parsed.some((card) => card.color === "blue" && card.kind !== "rumor")) throw new Error("Every blue base-game Mythos card must be a Rumor.");
}

validateMythosContent(baseGameMythosCards);
