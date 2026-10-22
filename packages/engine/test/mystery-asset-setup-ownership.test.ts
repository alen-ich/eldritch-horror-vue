import { describe, expect, it } from "vitest";
import { executeCommand, projectPublicState, projectStateForPlayer, type GameContent, type GameState } from "../src/index.js";
import { lobby, startingContent } from "./starting-spell-fixtures.js";
import { spellContext } from "./spell-fixtures.js";

function fixture(grant = false) {
  const state = lobby(), content = startingContent();
  if (!grant) state.players[0]!.investigatorId = "trish_scarborough";
  content.assets = ["a", "b", "c", "d", "e", "f"].map(id => ({ id, value: 1, engineEffects: [] }));
  content.mysteryIdsByAncientOne = { azathoth: ["one", "two", "three", "four"] };
  return { state, content };
}
function start(state: GameState, content: GameContent, shuffle: typeof spellContext.shuffle): GameState {
  const result = executeCommand(state, "host", { type: "START_GAME" }, content, { ...spellContext, shuffle });
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}
function selected<T>(items: readonly T[], family: "mysteries" | "assets"): boolean {
  return items[0] === (family === "mysteries" ? "one" : "a");
}

describe("Mystery/Asset setup array ownership", () => {
  it.each([false, true])("starts independent games from one content catalog with starting grant=%s", grant => {
    const { state, content } = fixture(grant), stateBefore = structuredClone(state), contentBefore = structuredClone(content);
    const shuffle = <T>(items: readonly T[]) => selected(items, "mysteries") ? items as T[] : [...items];
    const first = start(state, content, shuffle);
    const secondResult = executeCommand(structuredClone(stateBefore), "host", { type: "START_GAME" }, content, { ...spellContext, shuffle });
    expect(secondResult).toMatchObject({ ok: true });
    if (!secondResult.ok) throw new Error(secondResult.error.code);
    expect(first.activeMysteryId).toBe("one"); expect(secondResult.state.activeMysteryId).toBe("one");
    expect(first.privateState.deckOrderById.mysteries).toEqual(["two", "three", "four"]);
    first.privateState.deckOrderById.mysteries!.push("first-only");
    expect(secondResult.state.privateState.deckOrderById.mysteries).toEqual(["two", "three", "four"]);
    expect(content).toEqual(contentBefore); expect(state).toEqual(stateBefore);
  });

  for (const family of ["mysteries", "assets"] as const) {
    it.each([false, true])(`${family} does not consume or retain provider storage with starting grant=%s`, grant => {
      const { state, content } = fixture(grant), stateBefore = structuredClone(state), contentBefore = structuredClone(content);
      let retained: string[] = [];
      const next = start(state, content, <T>(items: readonly T[]) => {
        if (!selected(items, family)) return [...items];
        const result = [...items].reverse(); retained = result as string[]; return result;
      });
      expect(next.activeMysteryId).toBe(family === "mysteries" ? "four" : "one");
      expect(next.reserveAssetIds).toEqual(family === "assets" ? ["f", "e", "d", "c"] : ["a", "b", "c", "d"]);
      const order = next.privateState.deckOrderById[family]!;
      const expected = family === "mysteries" ? ["three", "two", "one"] : ["b", "a"];
      expect(order).toEqual(expected);
      const providerExpected = family === "mysteries" ? ["four", "three", "two", "one"] : ["f", "e", "d", "c", "b", "a"];
      expect(retained).toEqual(providerExpected);
      expect(order).not.toBe(retained);
      retained.push("provider-only"); expect(order).toEqual(expected);
      order.push("engine-only"); expect(retained).toEqual([...providerExpected, "provider-only"]);
      for (const snapshot of [projectPublicState(next), projectStateForPlayer(next, "host")]) {
        const payload = JSON.stringify(snapshot);
        expect(payload).not.toContain("deckOrderById");
        for (const id of expected) expect(payload).not.toContain(JSON.stringify(id));
      }
      expect(next.stateVersion).toBe(state.stateVersion + 1);
      expect(state).toEqual(stateBefore); expect(content).toEqual(contentBefore);
    });
    it.each(["frozen", "in-place"] as const)(`${family} accepts %s provider permutations without changing content`, mode => {
      const { state, content } = fixture(), before = structuredClone(content);
      const next = start(state, content, <T>(items: readonly T[]) => {
        if (!selected(items, family)) return [...items];
        return mode === "frozen" ? Object.freeze([...items].reverse()) as T[] : (items as T[]).reverse();
      });
      expect(next.privateState.deckOrderById[family]).toEqual(family === "mysteries" ? ["three", "two", "one"] : ["b", "a"]);
      expect(() => next.privateState.deckOrderById[family]!.push("engine-only")).not.toThrow();
      expect(content).toEqual(before);
    });
  }
});
