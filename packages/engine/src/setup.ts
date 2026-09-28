export type MythosColor = "green" | "yellow" | "blue";
export interface AncientSetup {
  startingDoom: number;
  mythosDeck: readonly Readonly<Record<MythosColor, number>>[];
  greenOmenTokens: number;
}

/** The first array element is the top of the deck: stage I, then II, then III. */
export function buildMythosDeck(
  cards: readonly { id: string; color: MythosColor }[],
  stages: AncientSetup["mythosDeck"],
  shuffle: <T>(items: readonly T[]) => T[],
): string[] {
  if (stages.length !== 3 || new Set(cards.map(card => card.id)).size !== cards.length) throw new Error("Invalid Mythos setup catalog.");
  const colors = ["green", "yellow", "blue"] as const;
  for (const color of colors) {
    const counts = stages.map(stage => stage[color]);
    if (counts.some(count => !Number.isInteger(count) || count < 0)
      || counts.reduce((sum, count) => sum + count, 0) > cards.filter(card => card.color === color).length) {
      throw new Error(`Insufficient or invalid ${color} Mythos cards.`);
    }
  }
  const pools = Object.fromEntries(colors.map(color => [color, shuffle(cards.filter(card => card.color === color).map(card => card.id))])) as Record<MythosColor, string[]>;
  return stages.flatMap(stage => shuffle(colors.flatMap(color => pools[color].splice(0, stage[color]))));
}
