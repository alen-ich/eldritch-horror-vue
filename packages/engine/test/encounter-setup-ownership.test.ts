import { describe, expect, it } from "vitest";
import { executeCommand, projectPublicState, projectStateForPlayer, type GameContent, type GameState } from "../src/index.js";
import { lobby, startingContent } from "./starting-spell-fixtures.js";
import { spellContext } from "./spell-fixtures.js";

const ancientIds = ["azathoth", "cthulhu", "shub_niggurath", "yog_sothoth"] as const;
const sites = ["the_heart_of_africa", "the_himalayas", "the_amazon", "tunguska", "antarctica", "the_pyramids"] as const;
function fixture(family: "research" | "expedition", ancient: typeof ancientIds[number], grant: boolean) {
  const state = lobby(), base = startingContent();
  state.ancientOneId = ancient;
  if (!grant) state.players[0]!.investigatorId = "trish_scarborough";
  const content: GameContent = { ...base,
    mysteryIdsByAncientOne: Object.fromEntries(ancientIds.map(id => [id, [...base.mysteryIdsByAncientOne.azathoth!]])),
  };
  if (family === "research") content.researchEncounterSetup = ancientIds.flatMap(id => [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ id: `encounter_research_${id}_0${n}`, deck: `research_${id}` as const })));
  else {
    content.expeditionEncounters = sites.flatMap(locationId => [1, 2, 3].map(n => ({ id: `encounter_expedition_${locationId}_0${n}`, locationId })));
    content.map = { ...base.map, locationTypes: { ...base.map.locationTypes, ...Object.fromEntries(sites.map(site => [site, "wilderness" as const])) } };
  }
  return { state, content, key: family === "research" ? `encounter:research_${ancient}` : "encounter:expedition" };
}
function start(state: GameState, content: GameContent, shuffle: typeof spellContext.shuffle): GameState {
  const result = executeCommand(state, "host", { type: "START_GAME" }, content, { ...spellContext, shuffle });
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}

describe("physical encounter setup ownership through START_GAME", () => {
  for (const family of ["research", "expedition"] as const) {
    for (const ancient of family === "research" ? ancientIds : ["azathoth"] as const) {
      it.each([false, true])(`${family}/${ancient} isolates retained output with starting grant=%s`, grant => {
        const { state, content, key } = fixture(family, ancient, grant);
        const stateBefore = structuredClone(state), contentBefore = structuredClone(content);
        let retained: string[] = [];
        const next = start(state, content, <T>(items: readonly T[]) => {
          const result = [...items].reverse();
          if (typeof items[0] === "string" && items[0].startsWith(`encounter_${family}_`)) retained = result as string[];
          return result;
        });
        const order = next.privateState.deckOrderById[key]!;
        const top = family === "research" ? `encounter_research_${ancient}_08` : "encounter_expedition_the_pyramids_03";
        expect(order[0]).toBe(top);
        expect(order).toHaveLength(family === "research" ? 8 : 18);
        if (family === "expedition") expect(next.activeExpeditionLocationId).toBe("the_pyramids");
        expect(next.stateVersion).toBe(state.stateVersion + 1);
        for (const snapshot of [projectPublicState(next), projectStateForPlayer(next, "host")]) {
          expect(JSON.stringify(snapshot)).not.toMatch(/deckOrderById/);
          for (const id of order) expect(JSON.stringify(snapshot)).not.toContain(id);
        }
        const expected = [...order];
        expect(order).not.toBe(retained);
        retained[0] = "provider-only";
        expect(order).toEqual(expected);
        order.push("engine-only");
        expect(retained).not.toContain("engine-only");
        expect(state).toEqual(stateBefore); expect(content).toEqual(contentBefore);
      });
    }
    it.each(["frozen", "in-place"] as const)(`${family} supports %s provider permutations`, mode => {
      const { state, content, key } = fixture(family, "azathoth", false);
      const contentBefore = structuredClone(content);
      const next = start(state, content, <T>(items: readonly T[]) => {
        if (typeof items[0] !== "string" || !items[0].startsWith(`encounter_${family}_`)) return [...items];
        return mode === "frozen" ? Object.freeze([...items].reverse()) as T[] : (items as T[]).reverse();
      });
      const order = next.privateState.deckOrderById[key]!;
      expect(order[0]).toBe(family === "research" ? "encounter_research_azathoth_08" : "encounter_expedition_the_pyramids_03");
      expect(() => order.push("engine-only")).not.toThrow();
      expect(content).toEqual(contentBefore);
    });
  }
});
