/** Clockwise printed order, starting at the green setup space. */
export const omenTrack = ["comet", "constellation", "eclipse", "constellation"] as const;
export type OmenSymbol = (typeof omenTrack)[number];

export interface OmenAdvanceResult {
  position: number;
  symbol: OmenSymbol;
  enteredSymbols: OmenSymbol[];
  doomAdvanceFromGates: number;
}

/** Pure core rule: resolve each entered Omen space separately, including repeated symbols. */
export function advanceOmenTrack(currentPosition: number, steps: number, activeGateSymbols: readonly OmenSymbol[]): OmenAdvanceResult {
  if (!Number.isInteger(currentPosition) || currentPosition < 0 || currentPosition >= omenTrack.length) {
    throw new Error("Omen position must be a space on the four-space track.");
  }
  if (!Number.isInteger(steps) || steps < 0) throw new Error("Omen advance must be a nonnegative integer.");
  const enteredSymbols: OmenSymbol[] = [];
  let position = currentPosition;
  let doomAdvanceFromGates = 0;
  for (let index = 0; index < steps; index += 1) {
    position = (position + 1) % omenTrack.length;
    const symbol = omenTrack[position]!;
    enteredSymbols.push(symbol);
    doomAdvanceFromGates += activeGateSymbols.filter(gateSymbol => gateSymbol === symbol).length;
  }
  return { position, symbol: omenTrack[position]!, enteredSymbols, doomAdvanceFromGates };
}
