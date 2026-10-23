import { describe, expect, it } from "vitest";
import { baseGameExpeditionSetup } from "../../content/src/expeditions.js";
import { expeditionLocationIds } from "@eldritch/protocol";
import { createDeterministicEngineContext, discardExpeditionCard, drawExpeditionCard, executeCommand, projectPublicState, projectStateForPlayer, validateExpeditionState, type CommandResult, type GameContent, type GameState } from "../src/index.js";
import { startingContent, lobby } from "./starting-spell-fixtures.js";
import { spellContext } from "./spell-fixtures.js";

function accepted(result: CommandResult): GameState {
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}
function fixture() {
  const base = startingContent();
  const content: GameContent = { ...base, expeditionEncounters: baseGameExpeditionSetup,
    map: { ...base.map, locationTypes: { ...base.map.locationTypes, ...Object.fromEntries(expeditionLocationIds.map(id => [id, "wilderness" as const])) } },
  };
  const state = accepted(executeCommand(lobby(), "host", { type: "START_GAME" }, content, spellContext));
  const top = "encounter_expedition_the_heart_of_africa_01", next = "encounter_expedition_the_pyramids_01";
  state.privateState.deckOrderById["encounter:expedition"] = [top, next, ...state.privateState.deckOrderById["encounter:expedition"]!.filter(id => id !== top && id !== next)];
  state.phase = "encounter"; state.activeExpeditionLocationId = "the_heart_of_africa";
  state.players[0]!.locationId = "the_heart_of_africa";
  return { state, content };
}

describe("physical Expedition draw/discard", () => {
  it.each(["public", "owner"])("isolates %s discard snapshots in both directions", viewer => {
    const { state, content } = fixture();
    const canonical = accepted(discardExpeditionCard(accepted(drawExpeditionCard(state, "host", content, spellContext)), "host", content, spellContext));
    const before = structuredClone(canonical);
    const projected = viewer === "public" ? projectPublicState(canonical) : projectStateForPlayer(canonical, "host");
    expect(projected.expeditionDiscardIds).toEqual(canonical.expeditionDiscardIds);
    projected.expeditionDiscardIds!.push("projected-only");
    expect(canonical).toEqual(before);
    canonical.expeditionDiscardIds!.push("canonical-only");
    expect(projected.expeditionDiscardIds).not.toContain("canonical-only");
    expect(JSON.stringify(projected)).not.toMatch(/deckOrderById|expeditionDraw/);
  });
  it("projects absent legacy discards as an independent empty list without changing the source", () => {
    const { state } = fixture(); delete state.expeditionDiscardIds;
    const before = structuredClone(state), projected = projectPublicState(state);
    expect(projected.expeditionDiscardIds).toEqual([]);
    projected.expeditionDiscardIds!.push("projected-only");
    expect(state).toEqual(before);
  });
  it("removes and reveals exactly the actual top and immediately relocates the marker", () => {
    const { state, content } = fixture(), before = structuredClone(state);
    const next = accepted(drawExpeditionCard(state, "host", content, spellContext));
    expect(next.privateState.deckOrderById["encounter:expedition"]).toHaveLength(17);
    expect(next.privateState.expeditionDraw).toEqual({ cardId: "encounter_expedition_the_heart_of_africa_01", playerId: "host", locationId: "the_heart_of_africa" });
    expect(next.currentLocationEncounterCardId).toBe("encounter_expedition_the_heart_of_africa_01");
    expect(next.activeExpeditionLocationId).toBe("the_pyramids");
    expect(next.stateVersion).toBe(state.stateVersion + 1);
    expect(validateExpeditionState(next, content)).toBeUndefined();
    const payload = JSON.stringify(projectPublicState(next));
    expect(payload).toContain("encounter_expedition_the_heart_of_africa_01");
    expect(payload).not.toMatch(/expeditionDraw|deckOrderById/);
    for (const id of next.privateState.deckOrderById["encounter:expedition"]!) expect(payload).not.toContain(id);
    expect(state).toEqual(before);
  });

  it("discards the bound card faceup, preserves undrawn order and never cycles it to the bottom", () => {
    const { state, content } = fixture();
    const drawn = accepted(drawExpeditionCard(state, "host", content, spellContext));
    const next = accepted(discardExpeditionCard(drawn, "host", content, spellContext));
    expect(next.expeditionDiscardIds).toEqual(["encounter_expedition_the_heart_of_africa_01"]);
    expect(next.privateState.deckOrderById["encounter:expedition"]).toEqual(drawn.privateState.deckOrderById["encounter:expedition"]);
    expect(next.privateState.expeditionDraw).toBeUndefined();
    expect(next.currentLocationEncounterCardId).toBeUndefined();
    expect(next.lastLocationEncounterCardId).toBe("encounter_expedition_the_heart_of_africa_01");
    expect(next.activeExpeditionLocationId).toBe("the_pyramids");
    expect(next.stateVersion).toBe(drawn.stateVersion + 1);
    expect(validateExpeditionState(JSON.parse(JSON.stringify(next)), content)).toBeUndefined();
    expect(discardExpeditionCard(next, "host", content, spellContext).ok).toBe(false);
  });

  for (const kind of ["owner", "phase", "space", "pending", "monster", "detained", "repeat"] as const) {
    it(`rejects ${kind} draw atomically`, () => {
      const fixtureData = fixture(), content = fixtureData.content;
      let state = fixtureData.state;
      if (kind === "phase") state.phase = "action";
      if (kind === "space") state.players[0]!.locationId = "arkham";
      if (kind === "pending") state.pendingDefeat = { playerId: "host", cityIds: ["arkham"], causes: ["health"] };
      if (kind === "monster") state.monsters = [{ id: "monster", monsterId: "monster_cultist", locationId: "the_heart_of_africa", damage: 0 }];
      if (kind === "detained") {
        content.conditions = [{ id: "condition_detained_01", kind: "detained" }];
        state.players[0]!.conditionIds = ["condition_detained_01"];
      }
      if (kind === "repeat") state = accepted(drawExpeditionCard(state, "host", content, spellContext));
      const before = structuredClone(state);
      expect(drawExpeditionCard(state, kind === "owner" ? "guest" : "host", content, spellContext).ok).toBe(false);
      expect(state).toEqual(before);
    });
  }

  for (const corrupt of ["overlap", "foreign", "marker", "reveal", "binding"] as const) {
    it(`rejects restored ${corrupt} without repairing any zone`, () => {
      const { state, content } = fixture();
      const drawn = accepted(drawExpeditionCard(state, "host", content, spellContext));
      if (corrupt === "overlap") drawn.expeditionDiscardIds = [drawn.privateState.deckOrderById["encounter:expedition"]![0]!];
      if (corrupt === "foreign") drawn.privateState.deckOrderById["encounter:expedition"]![0] = "unknown";
      if (corrupt === "marker") drawn.activeExpeditionLocationId = "antarctica";
      if (corrupt === "reveal") drawn.currentLocationEncounterCardId = "other";
      if (corrupt === "binding") drawn.privateState.expeditionDraw!.locationId = "antarctica";
      const before = structuredClone(drawn);
      expect(validateExpeditionState(drawn, content)).toBeTypeOf("string");
      expect(discardExpeditionCard(drawn, "host", content, spellContext).ok).toBe(false);
      expect(drawn).toEqual(before);
    });
  }

  it("recycles the 17 prior discards as soon as the last undrawn card is removed", () => {
    const data = fixture(), content = data.content;
    let state = data.state;
    for (let n = 0; n < 17; n++) {
      state.players[0]!.locationId = state.activeExpeditionLocationId;
      state = accepted(discardExpeditionCard(accepted(drawExpeditionCard(state, "host", content, spellContext)), "host", content, spellContext));
    }
    expect(state.expeditionDiscardIds).toHaveLength(17);
    expect(state.privateState.deckOrderById["encounter:expedition"]).toHaveLength(1);
    state.players[0]!.locationId = state.activeExpeditionLocationId;
    const inFlight = state.privateState.deckOrderById["encounter:expedition"]![0]!;
    const expected = [...state.expeditionDiscardIds!].reverse();
    const next = accepted(drawExpeditionCard(state, "host", content, { ...spellContext, shuffle: items => [...items].reverse() }));
    expect(next.privateState.deckOrderById["encounter:expedition"]).toEqual(expected);
    expect(next.privateState.deckOrderById["encounter:expedition"]).not.toContain(inFlight);
    expect(next.expeditionDiscardIds).toEqual([]);
    expect(next.privateState.expeditionDraw?.cardId).toBe(inFlight);
    expect(validateExpeditionState(next, content)).toBeUndefined();

    const failedContext = createDeterministicEngineContext({ shuffleIndexes: [0] });
    const before = structuredClone(state);
    expect(drawExpeditionCard(state, "host", content, failedContext)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before);
    expect(failedContext.shuffle([1, 2])).toEqual([2, 1]);
  });

  it("permits physical cleanup after defeat/end but only for its bound owner", () => {
    const { state, content } = fixture();
    const drawn = accepted(drawExpeditionCard(state, "host", content, spellContext));
    drawn.players[0]!.defeated = true; drawn.gameResult = "lost";
    expect(discardExpeditionCard(drawn, "guest", content, spellContext).ok).toBe(false);
    const next = accepted(discardExpeditionCard(drawn, "host", content, spellContext));
    expect(next.expeditionDiscardIds).toHaveLength(1);
    expect(next.gameResult).toBe("lost");
  });

  it("accepts legacy full decks without inventing a reshuffle or public discard history", () => {
    const { state, content } = fixture();
    delete state.expeditionDiscardIds;
    const before = structuredClone(state);
    expect(validateExpeditionState(state, content)).toBeUndefined();
    expect(state).toEqual(before);
  });

  it("does not treat an unbound revealed Expedition front as an absent legacy inventory", () => {
    const { state, content } = fixture();
    delete state.privateState.deckOrderById["encounter:expedition"];
    delete state.activeExpeditionLocationId;
    state.currentLocationEncounterCardId = "encounter_expedition_the_amazon_01";
    expect(validateExpeditionState(state, content)).toBeTypeOf("string");
  });
});
