import { describe, expect, it } from "vitest";
import { buildArtifactDeck, buildGateStack } from "../src/setup.js";
import { createDeterministicEngineContext, executeCommand } from "../src/index.js";
import { startingContent, lobby } from "./starting-spell-fixtures.js";

for (const { family, build, ids } of [
  { family: "Gate", build: buildGateStack, ids: ["gate_arkham", "gate_london"] },
  { family: "Artifact", build: buildArtifactDeck, ids: ["artifact_ttka_halot", "artifact_grotesque_statue"] },
]) {
  describe(`${family} setup shuffle boundary`, () => {
    it.each([[], [""], [undefined], [null], [42], Array(1)].map(invalid => ({ invalid })))("rejects malformed catalog $invalid", ({ invalid }) => {
      expect(() => build(invalid as string[], items => [...items])).toThrow();
    });
    it("rejects duplicate catalog IDs", () => {
      expect(() => build([ids[0]!, ids[0]!], items => [...items])).toThrow();
    });
    it.each(["sparse", "nonarray", "missing", "extra", "duplicate", "foreign"])("rejects %s provider output", kind => {
      const output: unknown = kind === "sparse" ? [ids[0], ,]
        : kind === "nonarray" ? { 0: ids[0], 1: ids[1], length: 2 }
        : kind === "missing" ? [ids[0]] : kind === "extra" ? [...ids, "foreign"]
        : kind === "duplicate" ? [ids[0], ids[0]] : [ids[0], "foreign"];
      const source = [...ids];
      expect(() => build(source, <T>() => output as T[])).toThrow();
      expect(source).toEqual(ids);
    });
    it("does not let provider input mutation redefine the expected inventory", () => {
      const source = [...ids];
      expect(() => build(source, <T>(items: readonly T[]) => {
        const mutable = items as T[]; mutable[0] = "foreign" as T; return mutable;
      })).toThrow();
      expect(source).toEqual(ids);
    });
    it("accepts in-place permutation without mutating the caller catalog", () => {
      const source = [...ids];
      const result = build(source, <T>(items: readonly T[]) => (items as T[]).reverse());
      expect(result).toEqual([ids[1], ids[0]]);
      expect(source).toEqual(ids);
    });
    it("owns output independently of a retained provider array in both directions", () => {
      let retained: string[] = [];
      const result = build(ids, <T>(items: readonly T[]) => {
        const output = [...items].reverse(); retained = output as string[]; return output;
      });
      expect(result).toEqual([ids[1], ids[0]]);
      expect(result).not.toBe(retained);
      retained.push("provider-only");
      expect(result).toEqual([ids[1], ids[0]]);
      result.push("engine-only");
      expect(retained).toEqual([ids[1], ids[0], "provider-only"]);
    });
    it("accepts frozen catalog and provider output without freezing engine storage", () => {
      const source = Object.freeze([...ids]);
      const result = build(source, <T>(items: readonly T[]) => Object.freeze([...items]) as T[]);
      expect(result).toEqual(ids);
      expect(() => result.push("engine-only")).not.toThrow();
      expect(source).toEqual(ids);
    });
  });
}

it("rejects malformed Artifact setup atomically and rolls back retained random input", () => {
  const state = lobby(), before = structuredClone(state), content = startingContent();
  content.artifacts = [{ id: "artifact_ttka_halot" }, { id: "artifact_grotesque_statue" }];
  const deterministic = createDeterministicEngineContext({ dice: [6] });
  const result = executeCommand(state, "host", { type: "START_GAME" }, content, {
    ...deterministic, shuffle: <T>(items: readonly T[]) => {
      if (typeof items[0] === "string" && items[0].startsWith("artifact_")) {
        deterministic.rollDie(); return [items[0], items[0]] as T[];
      }
      return [...items];
    },
  });
  expect(result).toMatchObject({ ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID" } });
  expect(state).toEqual(before);
  expect(deterministic.rollDie()).toBe(6);
});
