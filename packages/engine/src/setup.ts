export type MythosColor = "green" | "yellow" | "blue";

/** The first element remains the hidden top of the Gate stack. */
export function buildGateStack(gateIds: readonly string[], shuffle: <T>(items: readonly T[]) => T[]): string[] {
  if (!gateIds.length || new Set(gateIds).size !== gateIds.length || gateIds.some(id => !id)) {
    throw new Error("Gate stack requires unique, nonempty Gate IDs.");
  }
  return shuffle(gateIds);
}

export function buildMonsterPool(
  monsters: readonly { id: string; type: "normal" | "epic"; count: number }[],
  setAside: readonly { monsterId: string; quantity: number }[],
): { cup: string[]; setAsideById: Record<string, string[]> } {
  if (new Set(monsters.map(monster => monster.id)).size !== monsters.length || monsters.some(monster => !Number.isInteger(monster.count) || monster.count < 1)) {
    throw new Error("Monster catalog requires unique IDs and positive token counts.");
  }
  const counts = new Map(monsters.filter(monster => monster.type === "normal").map(monster => [monster.id, monster.count]));
  const setAsideById: Record<string, string[]> = {};
  for (const instruction of setAside) {
    const available = counts.get(instruction.monsterId);
    if (available === undefined || !Number.isInteger(instruction.quantity) || instruction.quantity < 1 || instruction.quantity > available) {
      throw new Error(`Cannot set aside ${instruction.quantity} copies of ${instruction.monsterId}.`);
    }
    counts.set(instruction.monsterId, available - instruction.quantity);
    setAsideById[instruction.monsterId] = [...(setAsideById[instruction.monsterId] ?? []), ...Array(instruction.quantity).fill(instruction.monsterId)];
  }
  return { cup: [...counts].flatMap(([id, count]) => Array<string>(count).fill(id)), setAsideById };
}
export interface AncientSetup {
  startingDoom: number;
  mythosDeck: readonly Readonly<Record<MythosColor, number>>[];
  greenOmenTokens: number;
  setAsideMonsters?: readonly { monsterId: string; quantity: number }[];
  reckoningEffectIds?: readonly string[];
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
