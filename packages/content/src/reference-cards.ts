import { z } from "zod";

export const supportedPlayerCounts = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type SupportedPlayerCount = (typeof supportedPlayerCounts)[number];

export interface ReferenceCardSetupData {
  playerCount: SupportedPlayerCount;
  spawnGates: number;
  spawnClues: number;
  monsterSurge: number;
  imageUrl: string;
  verification: "verified_from_scan";
}

const referenceCardDefinitions = [
  { playerCount: 1, spawnGates: 1, spawnClues: 1, monsterSurge: 1 },
  { playerCount: 2, spawnGates: 1, spawnClues: 1, monsterSurge: 1 },
  { playerCount: 3, spawnGates: 1, spawnClues: 2, monsterSurge: 2 },
  { playerCount: 4, spawnGates: 1, spawnClues: 2, monsterSurge: 2 },
  { playerCount: 5, spawnGates: 2, spawnClues: 3, monsterSurge: 2 },
  { playerCount: 6, spawnGates: 2, spawnClues: 3, monsterSurge: 2 },
  { playerCount: 7, spawnGates: 2, spawnClues: 4, monsterSurge: 3 },
  { playerCount: 8, spawnGates: 2, spawnClues: 4, monsterSurge: 3 },
 ] as const satisfies readonly Omit<ReferenceCardSetupData, "imageUrl" | "verification">[];

export const baseGameReferenceCards: readonly ReferenceCardSetupData[] = referenceCardDefinitions.map((card) => ({
  ...card,
  imageUrl: `/cards/reference/players-${card.playerCount}.webp`,
  verification: "verified_from_scan" as const,
}));

const referenceCardSchema = z.object({
  playerCount: z.union(supportedPlayerCounts.map((count) => z.literal(count))),
  spawnGates: z.number().int().positive(),
  spawnClues: z.number().int().positive(),
  monsterSurge: z.number().int().positive(),
  imageUrl: z.string().regex(/^\/cards\/reference\/players-[1-8]\.webp$/),
  verification: z.literal("verified_from_scan"),
}).strict();

export function validateReferenceCardContent(cards: readonly ReferenceCardSetupData[]): void {
  const parsed = z.array(referenceCardSchema).length(supportedPlayerCounts.length).parse(cards);
  const playerCounts = new Set(parsed.map(({ playerCount }) => playerCount));
  if (playerCounts.size !== parsed.length) throw new Error("Reference card content contains duplicate player counts.");
  if (supportedPlayerCounts.some((count) => !playerCounts.has(count))) throw new Error("Reference card content does not cover every supported player count.");
}

export function referenceCardForPlayerCount(playerCount: number): ReferenceCardSetupData {
  const card = baseGameReferenceCards.find((candidate) => candidate.playerCount === playerCount);
  if (!card) throw new Error(`Unsupported player count: ${playerCount}.`);
  return card;
}

validateReferenceCardContent(baseGameReferenceCards);
