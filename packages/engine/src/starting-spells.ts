import type { CommandResult, EngineContext, GameContent, GameState } from "./index.js";
import { gainSpell } from "./spells.js";

/** Only explicitly supported starting grants are executable; display equipment is not parsed. */
export function validateStartingSpells(content: GameContent): string | undefined {
  for (const [investigatorId, setup] of Object.entries(content.investigators)) {
    const ids = setup.startingSpellIds;
    if (ids === undefined) continue;
    if (!Array.isArray(ids) || ids.length > 1
      || ids.some(id => id !== "spell_feed_the_mind")
      || ids.length > 0 && (investigatorId !== "norman_withers"
        || !content.spells?.some(card => card.kind === "feed_the_mind"))) {
      return "Starting Spell configuration is missing or unsupported.";
    }
  }
  return undefined;
}

/** Version-neutral; the enclosing command publishes the single version increment. */
export function grantStartingSpells(state: GameState, playerId: string, content: GameContent, context: EngineContext): CommandResult {
  const invalid = validateStartingSpells(content);
  if (invalid) return { ok: false, error: { code: "SPELL_CONTENT_MISSING", message: invalid } };
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return { ok: false, error: { code: "PLAYER_NOT_FOUND", message: "Unknown starting Spell recipient." } };
  if (!player.investigatorId || !content.investigators[player.investigatorId]?.startingSpellIds?.length) {
    return { ok: true, state, events: [] };
  }
  return gainSpell(state, playerId, { type: "kind", kind: "feed_the_mind" }, content, context);
}

/** Roll back retained deterministic queues; stateless server crypto has no queue to restore. */
export function withStartingSpellRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID", message: "Starting Spell random input is unavailable or invalid." } };
  }
}
