/** Front-side Blessed/Cursed rules. Card backs remain server-only and unresolved. */
export type BoonBane = "blessed" | "cursed";

export function publicConditionId(cardId: string): string {
  const match = /^condition_([a-z_]+)_\d{2}$/.exec(cardId);
  if (!match) throw new Error(`Invalid physical Condition ID: ${cardId}`);
  return `condition_${match[1]}`;
}

export function boonBaneKind(cardId: string): BoonBane | undefined {
  if (/^condition_blessed_\d{2}$/.test(cardId)) return "blessed";
  if (/^condition_cursed_\d{2}$/.test(cardId)) return "cursed";
  return undefined;
}

export function conditionSuccessThreshold(conditionIds: readonly string[]): number {
  const kinds = conditionIds.map(boonBaneKind);
  if (kinds.includes("cursed")) return 6;
  if (kinds.includes("blessed")) return 4;
  return 5;
}

export type BoonBaneGain =
  | { type: "discard_opposite"; cardId: string }
  | { type: "flip_existing"; cardId: string }
  | { type: "draw_new"; kind: BoonBane };

/** Resolve the front-side replacement before drawing a new physical card. */
export function resolveBoonBaneGain(conditionIds: readonly string[], kind: BoonBane): BoonBaneGain {
  const opposite = kind === "blessed" ? "cursed" : "blessed";
  const oppositeId = conditionIds.find(id => boonBaneKind(id) === opposite);
  if (oppositeId) return { type: "discard_opposite", cardId: oppositeId };
  const sameId = conditionIds.find(id => boonBaneKind(id) === kind);
  if (sameId) return { type: "flip_existing", cardId: sameId };
  return { type: "draw_new", kind };
}
