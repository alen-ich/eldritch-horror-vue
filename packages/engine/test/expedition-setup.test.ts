import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, projectPublicState, validateExpeditionSetupCatalog, validateExpeditionState, type CommandResult, type GameContent, type GameState } from "../src/index.js";
import { startingContent, lobby } from "./starting-spell-fixtures.js";
import { spellContext } from "./spell-fixtures.js";

const sites = ["the_heart_of_africa", "the_himalayas", "the_amazon", "tunguska", "antarctica", "the_pyramids"] as const;
function content(): GameContent {
  const base = startingContent();
  return { ...base, map: { ...base.map, locationTypes: { ...base.map.locationTypes, ...Object.fromEntries(sites.map(site => [site, "wilderness" as const])) } },
    expeditionEncounters: sites.flatMap(locationId => [1, 2, 3].map(n => ({ id: `encounter_expedition_${locationId}_0${n}`, locationId }))),
  };
}
function accepted(result: CommandResult): GameState {
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}
function started(reverse = false): GameState {
  return accepted(executeCommand(lobby(), "host", { type: "START_GAME" }, content(), {
    ...spellContext, shuffle: items => reverse ? [...items].reverse() : [...items],
  }));
}

describe("Active Expedition setup", () => {
  for (const reverse of [false, true]) {
    it(`creates one conserved hidden deck without drawing its ${reverse ? "last" : "first"} card`, () => {
      const source = lobby(), before = structuredClone(source);
      const state = accepted(executeCommand(source, "host", { type: "START_GAME" }, content(), {
        ...spellContext, shuffle: items => reverse ? [...items].reverse() : [...items],
      }));
      const deck = state.privateState.deckOrderById["encounter:expedition"]!;
      expect(deck).toHaveLength(18);
      expect(new Set(deck).size).toBe(18);
      expect(deck[0]).toBe(reverse ? "encounter_expedition_the_pyramids_03" : "encounter_expedition_the_heart_of_africa_01");
      expect(state.activeExpeditionLocationId).toBe(reverse ? "the_pyramids" : "the_heart_of_africa");
      expect(state.stateVersion).toBe(source.stateVersion + 1);
      expect(source).toEqual(before);
      expect(projectPublicState(state).activeExpeditionLocationId).toBe(state.activeExpeditionLocationId);
      expect(JSON.stringify(projectPublicState(state))).not.toMatch(/encounter_expedition_|deckOrderById/);
      expect(validateExpeditionState(JSON.parse(JSON.stringify(state)), content())).toBeUndefined();
    });
  }

  for (const corrupt of ["missing", "duplicate", "foreign", "wrong site", "map"] as const) {
    it(`rejects ${corrupt} setup metadata before randomness or mutation`, () => {
      const catalog = content(), cards = catalog.expeditionEncounters!.map(card => ({ ...card }));
      if (corrupt === "missing") cards.pop();
      if (corrupt === "duplicate") cards[0] = { ...cards[1]! };
      if (corrupt === "foreign") cards[0]!.id = "foreign";
      if (corrupt === "wrong site") cards[0]!.locationId = "antarctica";
      if (corrupt === "map") delete catalog.map.locationTypes.the_pyramids;
      catalog.expeditionEncounters = cards;
      const source = lobby(), before = structuredClone(source);
      let shuffles = 0;
      const result = executeCommand(source, "host", { type: "START_GAME" }, catalog, {
        ...spellContext, shuffle: items => { shuffles++; return [...items]; },
      });
      expect(result).toMatchObject({ ok: false, error: { code: "EXPEDITION_CONTENT_MISSING" } });
      expect(shuffles).toBe(0);
      expect(source).toEqual(before);
    });
  }

  it("rolls back depleted deterministic setup input and keeps canonical state unchanged", () => {
    const context = createDeterministicEngineContext({ shuffleIndexes: [0] });
    const source = lobby(), before = structuredClone(source);
    expect(executeCommand(source, "host", { type: "START_GAME" }, content(), context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(source).toEqual(before);
    expect(context.shuffle([1, 2])).toEqual([2, 1]);
  });

  it("rejects an unknown physical ID even when its location is also missing", () => {
    const catalog = content();
    const cards = catalog.expeditionEncounters!.map(card => ({ ...card }));
    cards[0]!.id = "unknown";
    Reflect.deleteProperty(cards[0]!, "locationId");
    expect(validateExpeditionSetupCatalog(cards, catalog.map)).toBeTypeOf("string");
  });

  for (const corruption of ["duplicate", "missing card", "foreign", "marker", "missing deck"] as const) {
    it(`rejects restored ${corruption} without repairing the snapshot`, () => {
      const state = started();
      const deck = state.privateState.deckOrderById["encounter:expedition"]!;
      if (corruption === "duplicate") deck[0] = deck[1]!;
      if (corruption === "missing card") deck.pop();
      if (corruption === "foreign") deck[0] = "foreign";
      if (corruption === "marker") state.activeExpeditionLocationId = "antarctica";
      if (corruption === "missing deck") delete state.privateState.deckOrderById["encounter:expedition"];
      const before = structuredClone(state);
      expect(validateExpeditionState(state, content())).toBeTypeOf("string");
      expect(state).toEqual(before);
    });
  }

  it("preserves legacy snapshots without inventing a deck or marker", () => {
    const state = lobby(); state.phase = "action";
    expect(validateExpeditionState(state, content())).toBeUndefined();
    expect(state.activeExpeditionLocationId).toBeUndefined();
    expect(state.privateState.deckOrderById["encounter:expedition"]).toBeUndefined();
  });

  it("rejects unauthorized and repeated starts without replacing the deck", () => {
    expect(executeCommand(lobby(), "guest", { type: "START_GAME" }, content(), spellContext)).toMatchObject({ ok: false, error: { code: "NOT_HOST" } });
    const state = started(), before = structuredClone(state);
    expect(executeCommand(state, "host", { type: "START_GAME" }, content(), spellContext)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    expect(state).toEqual(before);
  });
});
