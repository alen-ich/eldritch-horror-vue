import { describe, expect, it } from "vitest";
import { buildMythosDeck, type AncientSetup, type MythosColor } from "../src/setup.js";
import { createDeterministicEngineContext, executeCommand } from "../src/index.js";
import { lobby, startingContent } from "./starting-spell-fixtures.js";

const cards = (["green", "yellow", "blue"] as const).flatMap(color => [1, 2, 3].map(n => ({ id: `${color[0]}${n}`, color })));
const stages = [{ green: 1, yellow: 1, blue: 1 }, { green: 1, yellow: 1, blue: 1 }, { green: 1, yellow: 1, blue: 1 }];
const identityOrder = ["g1", "y1", "b1", "g2", "y2", "b2", "g3", "y3", "b3"];

describe("staged Mythos shuffle integrity", () => {
  for (const site of [1, 2, 3, 4, 5, 6]) {
    it.each(["missing", "extra", "duplicate", "foreign", "sparse", "nonarray", "mutated input"])(`rejects %s output at shuffle ${site}`, kind => {
      const source = structuredClone(cards), setup = structuredClone(stages);
      let call = 0;
      expect(() => buildMythosDeck(source, setup, <T>(items: readonly T[]) => {
        if (++call !== site) return [...items];
        const output = [...items];
        if (kind === "missing") output.pop();
        if (kind === "extra") output.push("foreign" as T);
        if (kind === "duplicate") output[1] = output[0]!;
        if (kind === "foreign") output[0] = "foreign" as T;
        if (kind === "sparse") delete output[1];
        if (kind === "nonarray") return { length: items.length } as unknown as T[];
        if (kind === "mutated input") { (items as T[])[0] = "foreign" as T; return items as T[]; }
        return output;
      })).toThrow();
      expect(source).toEqual(cards); expect(setup).toEqual(stages);
    });
  }
  it.each(["sparse catalog", "missing ID", "empty ID", "foreign color", "sparse stages", "null stage", "array stage"])("rejects %s before random input", kind => {
    const source = structuredClone(cards), setup = structuredClone(stages);
    if (kind === "sparse catalog") delete source[1];
    if (kind === "missing ID") Object.assign(source[0]!, { id: undefined });
    if (kind === "empty ID") source[0]!.id = "";
    if (kind === "foreign color") Object.assign(source[0]!, { color: "purple" });
    if (kind === "sparse stages") delete setup[1];
    if (kind === "null stage") Object.assign(setup, { 1: null });
    if (kind === "array stage") Object.assign(setup, { 1: Object.assign([], stages[1]) });
    let calls = 0;
    expect(() => buildMythosDeck(source, setup, <T>(items: readonly T[]) => { calls++; return [...items]; })).toThrow();
    expect(calls).toBe(0);
  });
  it("isolates color pools from a provider reusing one buffer across all calls", () => {
    const retained: unknown[] = [];
    const source = structuredClone(cards), setup = structuredClone(stages);
    const result = buildMythosDeck(source, setup, <T>(items: readonly T[]) => {
      retained.splice(0, retained.length, ...items); return retained as T[];
    });
    expect(result).toEqual(identityOrder);
    retained.push("provider-only");
    expect(result).toEqual(identityOrder);
    result.push("engine-only"); expect(retained).not.toContain("engine-only");
    expect(source).toEqual(cards); expect(setup).toEqual(stages);
  });
  it("allows in-place reverse while preserving stages and excluding unselected cards", () => {
    const source = structuredClone(cards), setup = [{ green: 1, yellow: 0, blue: 1 }, { green: 0, yellow: 1, blue: 0 }, { green: 1, yellow: 0, blue: 0 }];
    const before = structuredClone(setup);
    expect(buildMythosDeck(source, setup, <T>(items: readonly T[]) => (items as T[]).reverse())).toEqual(["b3", "g3", "y3", "g2"]);
    expect(source).toEqual(cards); expect(setup).toEqual(before);
  });
  it("preserves empty stages and color pools including an intentionally empty deck", () => {
    const zero = { green: 0, yellow: 0, blue: 0 };
    expect(buildMythosDeck([], [zero, zero, zero], items => [...items])).toEqual([]);
    expect(buildMythosDeck([{ id: "g1", color: "green" }], [zero, { ...zero, green: 1 }, zero], items => [...items])).toEqual(["g1"]);
  });
  it("rejects corrupt Mythos setup through START_GAME without advancing canonical state or RNG", () => {
    const state = lobby(), before = structuredClone(state), content = startingContent();
    const ancient: AncientSetup = { startingDoom: 15, mythosDeck: stages, greenOmenTokens: 0 };
    content.ancientOnes = { azathoth: ancient };
    content.mythosCards = cards.map(card => ({ ...card, color: card.color as MythosColor }));
    const deterministic = createDeterministicEngineContext({ dice: [6] });
    const result = executeCommand(state, "host", { type: "START_GAME" }, content, {
      ...deterministic, shuffle: <T>(items: readonly T[]) => {
        if (items[0] === "g1") { deterministic.rollDie(); return []; }
        return [...items];
      },
    });
    expect(result).toMatchObject({ ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID" } });
    expect(state).toEqual(before); expect(deterministic.rollDie()).toBe(6);
  });
});
