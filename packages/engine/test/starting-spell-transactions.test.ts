import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, type EngineContext, type GameCommand, type GameState } from "../src/index.js";
import { spellState, spellContext } from "./spell-fixtures.js";
import { startingContent, lobby } from "./starting-spell-fixtures.js";

function replacement(): GameState {
  const state = spellState(); state.players[0]!.defeated = true; state.replacementWindow = true;
  return state;
}
const replace: GameCommand = { type: "REPLACE_INVESTIGATOR", investigatorId: "norman_withers" };

describe("starting Spell transactions", () => {
  for (const command of [{ type: "START_GAME" } as const, replace]) {
    for (const mode of ["throw", "invalid"] as const) {
      it(`rolls back all deterministic queues on last ${command.type} shuffle ${mode}`, () => {
        const state = command.type === "START_GAME" ? lobby() : replacement();
        const before = structuredClone(state), content = startingContent();
        const inputs = { dice: [4, ...Array<number>(20).fill(2)], ids: ["first", ...Array<string>(20).fill("second")], tokenIndexes: [1, ...Array<number>(20).fill(0)], shuffleIndexes: [1, ...Array<number>(99).fill(0)] };
        const ctx = createDeterministicEngineContext(inputs);
        const control = createDeterministicEngineContext(inputs);
        const shuffle = ctx.shuffle;
        ctx.shuffle = items => {
          ctx.rollDie(); ctx.createId(); ctx.drawToken(["a", "b"]);
          const result = shuffle(items);
          if (items.length === 19) {
            if (mode === "throw") throw new Error("last shuffle unavailable");
            return [];
          }
          return result;
        };
        // START_GAME first shuffles mysteries, assets and the 20-card supply:
        // use ample queue entries, with distinguishable first entries.
        const result = executeCommand(state, "host", command, content, ctx);
        expect(result).toMatchObject({ ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID" } });
        expect(state).toEqual(before);
        expect(ctx.rollDie()).toBe(control.rollDie());
        expect(ctx.createId()).toBe(control.createId());
        expect(ctx.drawToken(["a", "b"])).toEqual(control.drawToken(["a", "b"]));
        expect(shuffle([1, 2, 3])).toEqual(control.shuffle([1, 2, 3]));
      });
    }
  }

  it("rejects content before consuming setup inputs and keeps the lobby", () => {
    const state = lobby(), before = structuredClone(state);
    const content = { ...startingContent(), spells: undefined };
    let calls = 0;
    const ctx: EngineContext = { ...spellContext, shuffle: items => { calls++; return [...items]; } };
    expect(executeCommand(state, "host", { type: "START_GAME" }, content, ctx)).toMatchObject({ ok: false, error: { code: "SPELL_CONTENT_MISSING" } });
    expect(calls).toBe(0); expect(state).toEqual(before);
  });

  it("does not reset existing ledgers and commits successful named-search consumption", () => {
    const state = replacement();
    state.privateState.spellCasting = { usedPhysicalIds: ["spell_feed_the_mind_01"] };
    const ctx = createDeterministicEngineContext({ shuffleIndexes: Array(18).fill(0).concat([1]) });
    const result = executeCommand(state, "host", replace, startingContent(), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.privateState.spellCasting).toEqual(state.privateState.spellCasting);
    expect(ctx.shuffle([1, 2])).toEqual([1, 2]);
  });

  it("rejects corrupt inventory, missing randomness, illegal owners/timing and ended games atomically", () => {
    const corrupt = replacement(); corrupt.privateState.spells!.deck.pop();
    const ended = replacement(); ended.gameResult = { type: "loss", reason: "doom" };
    for (const [state, owner, command, ctx] of [
      [lobby(), "guest", { type: "START_GAME" }, spellContext],
      [lobby(), "unknown", { type: "START_GAME" }, spellContext],
      [spellState(), "host", replace, spellContext],
      [corrupt, "host", replace, spellContext],
      [ended, "host", replace, spellContext],
      [replacement(), "host", replace, undefined],
    ] as [GameState, string, GameCommand, EngineContext | undefined][]) {
      const before = structuredClone(state);
      expect(executeCommand(state, owner, command, startingContent(), ctx).ok).toBe(false);
      expect(state).toEqual(before);
    }
  });
});
