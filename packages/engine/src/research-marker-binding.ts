import type { GameContent, GameState } from "./index.js";

/** Walk runtime checkpoints as well as every unchosen instruction branch. */
function markerReferences(nodes: unknown, depth = 0): unknown[] | undefined {
  if (depth > 64 || !Array.isArray(nodes)) return undefined;
  const ids: unknown[] = [];
  for (const node of Array.from(nodes)) {
    if (!node || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    for (const key of ["effects", "cost"]) {
      if (record[key] === undefined) continue;
      if (!Array.isArray(record[key])) return undefined;
      for (const effect of Array.from(record[key])) {
        if (!effect || typeof effect !== "object") return undefined;
        if (effect.kind === "collect_encountered_clue" || effect.kind === "relocate_encountered_clue") ids.push(effect.markerId);
      }
    }
    for (const key of ["steps", "options", "pass", "fail", "reward", "decline", "defeated", "notDefeated"]) {
      const child = record[key];
      if (child === undefined) continue;
      const references = markerReferences(key === "steps" || key === "options" ? child : [child], depth + 1);
      if (!references) return undefined;
      ids.push(...references);
    }
  }
  return ids;
}

/** Legacy snapshots without provenance keep their existing validation contract. */
export function validateResearchMarkerBinding(state: GameState, content: GameContent): string | undefined {
  const pending = state.pendingLocationEncounter, binding = pending?.researchMarkerBinding;
  if (binding === undefined) return undefined;
  const invalid = "Research marker binding is inconsistent.";
  if (!pending?.deck.startsWith("research_") || !binding || typeof binding !== "object"
    || typeof binding.markerId !== "string" || !binding.markerId.length
    || typeof binding.clueId !== "string" || !content.clues?.some(clue => clue.id === binding.clueId)) return invalid;
  const references = markerReferences(pending.queue);
  if (!references || references.some(id => id !== binding.markerId)) return invalid;
  const markers = state.boardClues?.filter(marker => marker.id === binding.markerId) ?? [];
  if (!markers.length) return references.length ? invalid : undefined;
  const physical = state.privateState.tokenPoolById[`board_clue:${binding.markerId}`];
  return markers.length === 1 && Array.isArray(physical) && physical.length === 1 && physical[0] === binding.clueId ? undefined : invalid;
}
