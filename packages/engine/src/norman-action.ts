import type { GameCommand } from "@eldritch/protocol";
import type { CommandResult, EngineContext, GameContent, GameState } from "./index.js";
import { spendNormanClueSubstitution } from "./norman-clue-substitution.js";

/** Internal transition: caller owns phase/turn guards, action completion and version. */
export function resolveNormanAction(
  state: GameState, playerId: string,
  command: Extract<GameCommand, { type: "USE_INVESTIGATOR_ACTION" }>,
  content: GameContent, context: EngineContext,
): CommandResult {
  const reject = (message: string): CommandResult => ({ ok: false, error: { code: "MONSTER_CONTENT_MISSING", message } });
  const player = state.players.find(candidate => candidate.id === playerId);
  if (player?.investigatorId !== "norman_withers") return reject("Only Norman can perform this action.");
  const target = state.monsters?.find(monster => monster.id === command.monsterInstanceId);
  const definition = content.monsters?.find(monster => monster.id === target?.monsterId);
  const gates = (state.activeGateIds ?? []).map(id => content.gates?.find(gate => gate.id === id));
  if (!target || state.monsters!.filter(monster => monster.id === target.id).length !== 1
    || definition?.type !== "normal" || gates.some(gate => !gate)
    || !gates.some(gate => gate?.locationId === target.locationId)) return reject("Choose a non-Epic Monster on a space containing an active Gate.");

  const poolKey = target.setAside ? `set_aside:${target.monsterId}` : "monsters";
  const pool = state.privateState.tokenPoolById[poolKey];
  const physicalMonsters = [...(state.privateState.tokenPoolById.monsters ?? []),
    ...Object.entries(state.privateState.tokenPoolById).filter(([key]) => key.startsWith("set_aside:")).flatMap(([, ids]) => ids),
    ...(state.monsters ?? []).map(monster => monster.monsterId)];
  if (!Array.isArray(pool) || !Number.isInteger(definition.count) || definition.count! < 1
    || physicalMonsters.filter(id => id === target.monsterId).length !== definition.count) return reject("The physical Monster supply is inconsistent.");

  const cluesSpent = command.useSanity ? 1 : 2;
  const heldKey = `held_clues:${playerId}`;
  const held = state.privateState.tokenPoolById[heldKey];
  const physicalClues = Object.entries(state.privateState.tokenPoolById)
    .filter(([key]) => key === "clues" || key === "clue_discard" || key.startsWith("held_clues:") || key.startsWith("board_clue:") || key.startsWith("defeated_clues:"))
    .flatMap(([, ids]) => ids);
  if (!Array.isArray(state.privateState.tokenPoolById.clues) || !Array.isArray(held)
    || !Number.isInteger(player.clues) || player.clues < cluesSpent || held.length !== player.clues
    || new Set(physicalClues).size !== physicalClues.length
    || physicalClues.some(id => !content.clues?.some(clue => clue.id === id))) {
    return { ok: false, error: { code: "CLUE_CONTENT_MISSING", message: "The physical Clues for Norman's payment are unavailable or inconsistent." } };
  }

  const next = structuredClone(state);
  if (command.useSanity && !spendNormanClueSubstitution(next, playerId)) {
    return { ok: false, error: { code: "CONDITION_RESTRICTED", message: "Norman's once-per-round Sanity payment is unavailable." } };
  }
  const recipient = next.players.find(candidate => candidate.id === playerId)!;
  recipient.clues -= cluesSpent;
  const spent = next.privateState.tokenPoolById[heldKey]!.splice(0, cluesSpent);
  (next.privateState.tokenPoolById.clue_discard ??= []).push(...spent);
  const returned = [...pool, target.monsterId];
  const shuffled = target.setAside ? returned : context.shuffle([...returned]);
  if (shuffled.length !== returned.length || new Set([...returned, ...shuffled]).size !== new Set(returned).size
    || returned.some(id => returned.filter(copy => copy === id).length !== shuffled.filter(copy => copy === id).length)) {
    return reject("Invalid Monster cup shuffle.");
  }
  next.privateState.tokenPoolById[poolKey] = shuffled;
  next.monsters = next.monsters!.filter(monster => monster.id !== target.id);
  next.monsterLocationIds = [...new Set(next.monsters.map(monster => monster.locationId))];
  return { ok: true, state: next, events: [
    { type: "INVESTIGATOR_ACTION_PAID", playerId, cluesSpent, sanitySpent: command.useSanity ? 1 : 0 },
    { type: "MONSTER_DISCARDED", monsterInstanceId: target.id, monsterId: target.monsterId },
  ] };
}

export function withNormanActionRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "MONSTER_CONTENT_MISSING", message: "Norman's Monster return requires valid random input." } };
  }
}
