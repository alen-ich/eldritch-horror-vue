import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveLocationEncounter, resolveResearchEncounter, type GameContent, type GameState } from "../src/index.js";

const empty = { kind: "effects", effects: [] };
const content: GameContent = {
  assets: baseGameAssets, researchEncounters: baseGameResearchEncounterRules,
  locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: {
    city: { kind: "test", skill: "observation", modifier: 0, pass: empty, fail: empty },
    sea: { kind: "test", skill: "observation", modifier: 0, pass: empty, fail: empty },
  } }],
  map: { locationTypes: { arkham: "city", london: "city", space_2: "sea", the_amazon: "wilderness" }, adjacentLocationIds: {}, routes: [] },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 3, observation: 2, influence: 2, will: 4, strength: 2 } } },
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(held: string[] = [], locationId: "arkham" | "space_2" = "arkham"): GameState {
  const before = createLobby(["host", "guest"]);
  before.phase = "encounter"; before.activePlayerId = before.leadInvestigatorId = "host"; before.ancientOneId = "cthulhu"; before.doom = 12;
  before.players[0] = { ...before.players[0]!, investigatorId: "akachi_onyele", locationId, health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, clues: 1, assetIds: held };
  before.players[1] = { ...before.players[1]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7 };
  before.boardClues = [{ id: "chosen", locationId }];
  before.privateState.deckOrderById = { "encounter:general": ["encounter_general_01"], "encounter:research_cthulhu": ["encounter_research_cthulhu_01"] };
  before.privateState.tokenPoolById = { "board_clue:chosen": ["clue_arkham"], "held_clues:host": ["clue_london"], clues: [], clue_discard: [] };
  return before;
}
const context = () => createDeterministicEngineContext({ dice: Array(10).fill(1), ids: ["test", "reroll"], tokenIndexes: [0] });

describe("scoped non-combat encounter Assets", () => {
  const influenceContent: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: {
    city: { kind: "test", skill: "influence", modifier: 0, pass: empty, fail: empty },
  } }] };
  function assistantTest(clues = 0) {
    const before = state(["asset_personal_assistant", "asset_urban_guide"]);
    before.players[0]!.clues = clues;
    if (!clues) before.privateState.tokenPoolById["held_clues:host"] = [];
    const result = resolveLocationEncounter(before, "host", "general", influenceContent, context());
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }
  function reroll(before: GameState, option: string | undefined, die = 6) {
    const result = executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: option ? [option] : [] }, influenceContent, createDeterministicEngineContext({ dice: [die], ids: ["next-reroll"] }));
    if (!result.ok) throw new Error(result.error.message);
    return result;
  }
  it("offers a free Influence reroll without Clues and combines both Ally bonuses", () => {
    const before = assistantTest();
    expect(before.activeTest?.dicePool).toBe(4); // Influence 2 + Assistant 1 + Urban Guide 1
    expect(before.pendingDecision?.optionIds).toEqual(Array.from({ length: 4 }, (_, index) => `asset-reroll:asset_personal_assistant:${index}`));
    const snapshot = structuredClone(before);
    const result = reroll(before, "asset-reroll:asset_personal_assistant:3");
    expect(result.events.some(event => event.type === "CLUE_SPENT_FOR_REROLL")).toBe(false);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "TEST_DIE_REROLLED", dieIndex: 3, result: 6, successes: 1 }));
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activeTest).toBeUndefined();
    expect(result.state.players[0]?.clues).toBe(0); expect(before).toEqual(snapshot);
  });
  it.each([true, false])("restores source usage and permits Clue and Asset rerolls in either order (Asset first=%s)", assetFirst => {
    const before = assistantTest(1);
    const first = reroll(before, assetFirst ? "asset-reroll:asset_personal_assistant:0" : "die-0", 1).state;
    const restored: GameState = JSON.parse(JSON.stringify(first));
    expect(restored.players[0]?.clues).toBe(assetFirst ? 1 : 0);
    expect(restored.activeTest?.usedRerollAssetIds ?? []).toEqual(assetFirst ? ["asset_personal_assistant"] : []);
    expect(restored.pendingDecision?.optionIds.every(id => id.startsWith(assetFirst ? "die-" : "asset-reroll:"))).toBe(true);
    const rejected = executeCommand(restored, "guest", { type: "RESOLVE_DECISION", decisionId: restored.pendingDecision!.id, selectedOptionIds: [] }, influenceContent, context());
    expect(rejected).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    if (assetFirst) {
      expect(executeCommand(restored, "host", { type: "RESOLVE_DECISION", decisionId: restored.pendingDecision!.id, selectedOptionIds: ["asset-reroll:asset_personal_assistant:0"] }, influenceContent, context()).ok).toBe(false);
    }
    const result = reroll(restored, assetFirst ? "die-0" : "asset-reroll:asset_personal_assistant:0");
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingDecision).toBeUndefined();
  });
  it("can decline the free reroll and resets its usage for a new test", () => {
    const before = assistantTest();
    const ended = reroll(before, undefined).state;
    expect(ended.pendingDecision).toBeUndefined();
    ended.activePlayerId = "host";
    const again = resolveLocationEncounter(ended, "host", "general", influenceContent, context());
    if (!again.ok) throw new Error(again.error.message);
    expect(again.state.pendingDecision?.optionIds).toContain("asset-reroll:asset_personal_assistant:0");
  });
  it("does not grant Personal Assistant bonuses or free rerolls to Observation tests", () => {
    const before = state(["asset_personal_assistant"]); before.players[0]!.clues = 0;
    const result = resolveLocationEncounter(before, "host", "general", content, context());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
  });
  it("recounts a free Acquire Assets reroll using Fine Clothes without spending a Clue", () => {
    const before = state(["asset_personal_assistant", "asset_fine_clothes"]);
    before.phase = "action"; before.actionsRemaining = 2; before.players[0]!.clues = 0;
    before.privateState.tokenPoolById["held_clues:host"] = [];
    const started = executeCommand(before, "host", { type: "ACQUIRE_ASSETS" }, influenceContent, context());
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.activeTest?.dicePool).toBe(3);
    const finished = reroll(started.state, "asset-reroll:asset_personal_assistant:0");
    expect(finished.state.pendingDecision).toMatchObject({ kind: "select_acquired_cards", selectionBudget: 2 });
    expect(finished.state.activeTest).toBeUndefined(); expect(finished.state.players[0]?.clues).toBe(0);
  });
  it.each(baseGameAssets.filter(asset => asset.nonCombatEncounterSupport === "irrelevant"))("allows $name without applying its combat/Spell/Action effects", asset => {
    for (const research of [false, true]) {
      const before = state([asset.id]); const snapshot = structuredClone(before);
      const result = research ? resolveResearchEncounter(before, "host", "chosen", content, context()) : resolveLocationEncounter(before, "host", "general", content, context());
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.activeTest?.dicePool).toBe(2);
      expect(result.state.players[0]?.assetIds).toEqual([asset.id]); expect(before).toEqual(snapshot);
    }
  });
  it.each([false, true])("applies Urban Guide's City aura to owner and colleague (Research=%s)", research => {
    for (const holder of [0, 1]) {
      const before = state(); before.players[holder]!.assetIds = ["asset_urban_guide"];
      before.players[0]!.skillImprovements.observation = 1;
      const result = research ? resolveResearchEncounter(before, "host", "chosen", content, context()) : resolveLocationEncounter(before, "host", "general", content, context());
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.activeTest?.dicePool).toBe(4); // base 2 + improvement 1 + Ally aura 1
    }
  });
  it("does not apply a remote, defeated or eliminated holder's aura, or an aura on Sea spaces", () => {
    for (const variation of ["remote", "defeated", "eliminated", "sea"] as const) {
      const before = state(variation === "sea" ? ["asset_urban_guide"] : [], variation === "sea" ? "space_2" : "arkham");
      if (variation !== "sea") {
        before.players[1]!.assetIds = ["asset_urban_guide"];
        if (variation === "remote") before.players[1]!.locationId = "london";
        else before.players[1]![variation] = true;
      }
      const result = resolveLocationEncounter(before, "host", "general", content, context());
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.activeTest?.dicePool).toBe(2);
    }
  });
  it("applies the aura before the minimum-one-die rule and does not boost unrelated skills", () => {
    const ordinary: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "test", skill: "lore", modifier: 0, pass: empty, fail: empty } } }] };
    const tested = resolveLocationEncounter(state(["asset_urban_guide", "asset_arcane_manuscripts"]), "host", "general", ordinary, context());
    if (!tested.ok) throw new Error(tested.error.message);
    expect(tested.state.activeTest?.dicePool).toBe(4); // base Lore 3 + aura 1; Manuscripts is Spell-only
    const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "test", skill: "lore", modifier: -5, pass: empty, fail: empty } } }] };
    const result = resolveLocationEncounter(state(["asset_urban_guide", "asset_arcane_manuscripts"]), "host", "general", rules, context());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.activeTest?.dicePool).toBe(1); // 3 - 5 + 1, not minimum 1 + aura
  });
  it("restores bonus dice through an owner-only physical Clue reroll and cycles once", () => {
    const offered = resolveResearchEncounter(state(["asset_urban_guide"]), "host", "chosen", content, context());
    if (!offered.ok) throw new Error(offered.error.message);
    const restored: GameState = JSON.parse(JSON.stringify(offered.state));
    const command = { type: "RESOLVE_DECISION" as const, decisionId: restored.pendingDecision!.id, selectedOptionIds: ["die-2"] };
    expect(executeCommand(restored, "guest", command, content, context())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = executeCommand(restored, "host", command, content, createDeterministicEngineContext({ dice: [6] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.clues).toBe(1); // spent held Clue, then collected exact marker
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
  });
  it.each(["asset_bandages", "asset_unknown"])("retains atomic guards for %s", id => {
    for (const research of [false, true]) {
      const before = state([id]); const snapshot = structuredClone(before);
      const result = research ? resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({})) : resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({}));
      expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(before).toEqual(snapshot);
    }
  });
  it("preflights Item discard in a failure branch, but permits the Ally when no Items can be discarded", () => {
    const before = state(["asset_45_automatic"]); before.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_03"];
    const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(before).toEqual(snapshot);
    before.players[0]!.assetIds = ["asset_urban_guide"]; before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = [];
    const result = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.assetIds).toEqual(["asset_urban_guide"]); expect(result.state.boardClues).toHaveLength(1);
  });
  it("preflights nested ambush branches for carried Assets and colleague combat auras", () => {
    for (const held of [true, false]) {
      const before = state(held ? ["asset_45_automatic"] : []);
      if (!held) before.players[1]!.assetIds = ["asset_urban_guide"];
      before.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_04"];
      const snapshot = structuredClone(before);
      expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(before).toEqual(snapshot);
    }
  });
});
