import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveLocationEncounter, resolveResearchEncounter, resolveConditionReckoning, projectPublicState, type GameContent, type GameState } from "../src/index.js";

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
  const muscleId = "asset_hired_muscle";
  function muscleContent(skill: "strength" | "lore" | "influence" | "observation" | "will" = "strength", modifier = 0): GameContent {
    return { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: {
      city: { kind: "test", skill, modifier, pass: empty, fail: empty },
    } }] };
  }
  function muscleStart(before = state([muscleId]), rules = muscleContent()): GameState {
    before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = [];
    const result = resolveLocationEncounter(before, "host", "general", rules, context());
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }
  function muscleChoose(before: GameState, option?: string, rules = muscleContent()) {
    return executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: option ? [option] : [] }, rules, createDeterministicEngineContext({ dice: [6], ids: ["muscle-choice"] }));
  }
  it("adds Hired Muscle's non-Item Strength bonus alongside improvement, modifier and a colleague's City aura", () => {
    const before = state([muscleId]); before.players[0]!.skillImprovements.strength = 2;
    before.players[1]!.assetIds = ["asset_urban_guide"];
    const offered = muscleStart(before, muscleContent("strength", -1));
    expect(offered.activeTest?.dicePool).toBe(5);
    expect(offered.pendingDecision?.optionLabels?.[`asset-reroll:${muscleId}:0`]).toBe("Hired Muscle: reroll die 1 (no Clue)");
    expect(offered.pendingDecision?.optionIds).toHaveLength(5);
  });
  it.each(["lore", "influence", "observation", "will"] as const)("does not grant a bonus or reroll to %s, or a same-City colleague", skill => {
    const offered = muscleStart(state([muscleId]), muscleContent(skill));
    expect(offered.pendingDecision).toBeUndefined();
    const colleague = state([]); colleague.players[1]!.assetIds = [muscleId];
    expect(muscleStart(colleague).pendingDecision).toBeUndefined();
  });
  it("keeps the minimum one die, does not spend Clues, and allows the source again on a new test", () => {
    const rules = muscleContent("strength", -9); const offered = muscleStart(state([muscleId]), rules);
    expect(offered.activeTest?.dicePool).toBe(1);
    const snapshot = structuredClone(offered); const result = muscleChoose(offered, `asset-reroll:${muscleId}:0`, rules);
    if (!result.ok) throw new Error(result.error.message);
    expect(offered).toEqual(snapshot); expect(result.state.usedAssetRerollIds).toEqual([]);
    expect(result.events.some(event => event.type === "CLUE_SPENT_FOR_REROLL")).toBe(false);
    result.state.activePlayerId = "host";
    expect(muscleStart(result.state, rules).pendingDecision?.optionIds).toContain(`asset-reroll:${muscleId}:0`);
  });
  it("declining keeps the bonus and resumes the encounter without losing the Ally", () => {
    const offered = muscleStart(); const result = muscleChoose(offered);
    if (!result.ok) throw new Error(result.error.message);
    expect(offered.activeTest?.dicePool).toBe(3); expect(result.state.players[0]?.assetIds).toEqual([muscleId]);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingDecision).toBeUndefined();
  });
  it("uses the same Strength bonus and reroll in the generic Condition Reckoning test", () => {
    const before = state([muscleId]); before.phase = "mythos";
    before.players[0]!.conditionIds = ["condition_leg_injury_01"];
    before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = [];
    const rules: GameContent = { ...content, conditions: [{ id: "condition_leg_injury_01", kind: "leg_injury", backEffect: { type: "discard" } }] };
    const offered = resolveConditionReckoning(before, "host", "condition_leg_injury_01", rules, context());
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.activeTest?.dicePool).toBe(3);
    expect(offered.state.activeTest?.continuation).toBe("condition_reckoning");
    const result = muscleChoose(offered.state, `asset-reroll:${muscleId}:0`, rules);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_leg_injury_01"]);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.phase).toBe("mythos");
  });
  it.each([true, false])("keeps Hired Muscle and Foot usage independent after serialization (Muscle first=%s)", muscleFirst => {
    const offered = muscleStart(state([muscleId, "asset_lucky_rabbits_foot"]));
    const first = muscleFirst ? muscleId : "asset_lucky_rabbits_foot";
    const second = muscleFirst ? "asset_lucky_rabbits_foot" : muscleId;
    const result = muscleChoose(offered, `asset-reroll:${first}:0`);
    if (!result.ok) throw new Error(result.error.message);
    const restored: GameState = JSON.parse(JSON.stringify(result.state));
    expect(restored.pendingDecision?.optionIds).toContain(`asset-reroll:${second}:0`);
    expect(restored.pendingDecision?.optionIds).not.toContain(`asset-reroll:${first}:1`);
    const finished = muscleChoose(restored, `asset-reroll:${second}:0`);
    if (!finished.ok) throw new Error(finished.error.message);
    expect(finished.state.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
  });
  it("rejects foreign owners, consumed sources and a vanished holding atomically", () => {
    const offered = muscleStart(state([muscleId, "asset_lucky_rabbits_foot"]));
    const command = { type: "RESOLVE_DECISION" as const, decisionId: offered.pendingDecision!.id, selectedOptionIds: [`asset-reroll:${muscleId}:0`] };
    expect(executeCommand(offered, "guest", command, muscleContent(), context())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    for (const change of ["used", "lost"] as const) {
      const changed = structuredClone(offered);
      if (change === "used") changed.activeTest!.usedRerollAssetIds = [muscleId];
      else changed.players[0]!.assetIds = ["asset_lucky_rabbits_foot"];
      const snapshot = structuredClone(changed);
      expect(executeCommand(changed, "host", command, muscleContent(), context())).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
      expect(changed).toEqual(snapshot);
    }
  });
  it("keeps the Ally out of Item discards and still guards nested ambushes before mutation", () => {
    const before = state([muscleId]); before.players[0]!.clues = 0;
    before.privateState.tokenPoolById["held_clues:host"] = [];
    before.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_03"];
    const result = resolveResearchEncounter(before, "host", "chosen", content, context());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.assetIds).toEqual([muscleId]); expect(result.state.pendingDecision).toBeUndefined();
    before.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_04"];
    const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", content, context())).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
  });
  function footContent(skill: "lore" | "influence" | "observation" | "strength" | "will", modifier = 0): GameContent {
    return { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: {
      city: { kind: "test", skill, modifier, pass: empty, fail: empty },
    } }] };
  }
  function footState() {
    const before = state(["asset_lucky_rabbits_foot"]);
    before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = [];
    return before;
  }
  function beginFoot(before: GameState, rules = footContent("observation")) {
    const result = resolveLocationEncounter(before, "host", "general", rules, context());
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }
  function chooseFoot(before: GameState, option: string | undefined, rules = footContent("observation"), die = 6) {
    const result = executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: option ? [option] : [] }, rules, createDeterministicEngineContext({ dice: [die], ids: ["next-foot-choice"] }));
    if (!result.ok) throw new Error(result.error.message);
    return result;
  }
  it.each(["lore", "influence", "observation", "strength", "will"] as const)("offers Lucky Rabbit's Foot for a %s test without adding dice", skill => {
    const rules = footContent(skill); const before = beginFoot(footState(), rules);
    expect(before.activeTest?.dicePool).toBe(content.investigators.akachi_onyele!.skills[skill]);
    expect(before.pendingDecision?.optionLabels?.["asset-reroll:asset_lucky_rabbits_foot:0"]).toBe("Lucky Rabbit's Foot: reroll die 1 (no Clue)");
    const snapshot = structuredClone(before); const result = chooseFoot(before, "asset-reroll:asset_lucky_rabbits_foot:0", rules);
    expect(result.state.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.players[0]?.assetIds).toEqual(["asset_lucky_rabbits_foot"]);
    expect(result.events.some(event => event.type === "CLUE_SPENT_FOR_REROLL")).toBe(false); expect(before).toEqual(snapshot);
    expect(result.state.activeTest).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
  });
  it("cannot reuse the physical card in another test in the same round", () => {
    const result = chooseFoot(beginFoot(footState()), "asset-reroll:asset_lucky_rabbits_foot:0");
    const restored: GameState = JSON.parse(JSON.stringify(result.state)); restored.activePlayerId = "host";
    const second = beginFoot(restored, footContent("will"));
    expect(second.pendingDecision).toBeUndefined(); expect(second.activeTest).toBeUndefined();
    expect(second.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
  });
  it("declining a reroll does not consume the once-per-round effect", () => {
    const declined = chooseFoot(beginFoot(footState()), undefined).state; declined.activePlayerId = "host";
    expect(declined.usedAssetRerollIds).toEqual([]);
    expect(beginFoot(declined).pendingDecision?.optionIds).toContain("asset-reroll:asset_lucky_rabbits_foot:0");
  });
  it.each([true, false])("keeps Personal Assistant and Foot source limits independent after restoration (Foot first=%s)", footFirst => {
    const rules = footContent("influence"); const before = footState(); before.players[0]!.assetIds.push("asset_personal_assistant"); before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_london"];
    const started = beginFoot(before, rules);
    expect(started.activeTest?.dicePool).toBe(3);
    const firstId = footFirst ? "asset_lucky_rabbits_foot" : "asset_personal_assistant";
    const secondId = footFirst ? "asset_personal_assistant" : "asset_lucky_rabbits_foot";
    const used = chooseFoot(started, `asset-reroll:${firstId}:0`, rules, 1).state;
    const restored: GameState = JSON.parse(JSON.stringify(used));
    expect(restored.pendingDecision?.optionIds).toContain(`asset-reroll:${secondId}:0`);
    expect(restored.pendingDecision?.optionIds).not.toContain(`asset-reroll:${firstId}:1`);
    const command = { type: "RESOLVE_DECISION" as const, decisionId: restored.pendingDecision!.id, selectedOptionIds: [`asset-reroll:${secondId}:0`] };
    expect(executeCommand(restored, "guest", command, rules, context())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const both = chooseFoot(restored, `asset-reroll:${secondId}:0`, rules, 1).state;
    expect(both.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
    expect(both.players[0]?.clues).toBe(1); expect(both.pendingDecision?.optionIds).toEqual(["die-0", "die-1", "die-2"]);
    const finished = chooseFoot(both, "die-0", rules).state;
    expect(finished.players[0]?.clues).toBe(0); expect(finished.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    finished.activePlayerId = "host";
    const later = beginFoot(finished, rules);
    expect(later.pendingDecision?.optionIds).toContain("asset-reroll:asset_personal_assistant:0");
    expect(later.pendingDecision?.optionIds).not.toContain("asset-reroll:asset_lucky_rabbits_foot:0");
  });
  it("resets round usage only through the authorized next-round handoff", () => {
    const used = chooseFoot(beginFoot(footState()), "asset-reroll:asset_lucky_rabbits_foot:0").state;
    used.phase = "mythos"; used.replacementWindow = true; used.currentMythosCardId = undefined;
    expect(executeCommand(used, "guest", { type: "BEGIN_NEXT_ROUND" }, content)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    const next = executeCommand(used, "host", { type: "BEGIN_NEXT_ROUND" }, content);
    if (!next.ok) throw new Error(next.error.message);
    expect(next.state.usedAssetRerollIds).toEqual([]); expect(used.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
    next.state.phase = "encounter";
    expect(beginFoot(next.state).pendingDecision?.optionIds).toContain("asset-reroll:asset_lucky_rabbits_foot:0");
  });
  it("retains usage across physical ownership changes and copies it safely into the public projection", () => {
    const used = chooseFoot(beginFoot(footState()), "asset-reroll:asset_lucky_rabbits_foot:0").state;
    const projection = projectPublicState(used); projection.usedAssetRerollIds!.push("forged");
    expect(used.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
    used.players[0]!.assetIds = []; used.players[1]!.assetIds = ["asset_lucky_rabbits_foot"]; used.activePlayerId = "guest";
    const tested = resolveLocationEncounter(used, "guest", "general", footContent("observation"), context());
    if (!tested.ok) throw new Error(tested.error.message);
    expect(tested.state.pendingDecision).toBeUndefined();
  });
  it("revalidates round usage and holding before accepting an offered source", () => {
    const offered = beginFoot(footState());
    for (const changed of ["used", "lost"] as const) {
      const before = structuredClone(offered);
      if (changed === "used") before.usedAssetRerollIds = ["asset_lucky_rabbits_foot"];
      else before.players[0]!.assetIds = [];
      const snapshot = structuredClone(before);
      expect(executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: ["asset-reroll:asset_lucky_rabbits_foot:0"] }, footContent("observation"), context())).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } }); expect(before).toEqual(snapshot);
    }
  });
  it("preserves the one-die minimum and counts a Cursed reroll at its existing threshold", () => {
    const rules = footContent("observation", -5); const before = footState(); before.players[0]!.conditionIds = ["condition_cursed_01"];
    const offered = beginFoot(before, rules); expect(offered.activeTest?.dicePool).toBe(1);
    const result = chooseFoot(offered, "asset-reroll:asset_lucky_rabbits_foot:0", rules, 5);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "TEST_DIE_REROLLED", result: 5, successes: 0 }));
  });
  it("uses the Foot during Research, retaining its identity while collecting the exact Clue", () => {
    const before = footState();
    const started = resolveResearchEncounter(before, "host", "chosen", content, context());
    if (!started.ok) throw new Error(started.error.message);
    const result = chooseFoot(started.state, "asset-reroll:asset_lucky_rabbits_foot:0");
    expect(result.state.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
    expect(result.state.players[0]?.clues).toBe(1); expect(result.state.players[0]?.assetIds).toEqual(["asset_lucky_rabbits_foot"]);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]); expect(result.state.boardClues).toEqual([]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
  });
  it("does not treat the Trinket-only Foot as an Item, and preserves spent round usage", () => {
    const before = footState(); before.usedAssetRerollIds = ["asset_lucky_rabbits_foot"];
    before.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_03"];
    const started = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: [1], ids: ["discard-foot"] }));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.pendingDecision).toBeUndefined();
    expect(started.state.players[0]?.assetIds).toEqual(["asset_lucky_rabbits_foot"]); expect(started.state.assetDiscardIds).toEqual([]);
    expect(started.state.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
  });
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
  it("preflights duplicate Item identities in a failure branch, but permits the Ally when no Items can be discarded", () => {
    const before = state(["asset_45_automatic"]); before.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_03"];
    before.assetDiscardIds = ["asset_45_automatic"];
    const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(before).toEqual(snapshot);
    before.players[0]!.assetIds = ["asset_urban_guide"]; before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = [];
    const result = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.assetIds).toEqual(["asset_urban_guide"]); expect(result.state.boardClues).toHaveLength(1);
  });
  const discardContent: GameContent = { ...content, map: { ...content.map,
    locationTypes: { ...content.map.locationTypes, space_3: "sea" }, adjacentLocationIds: { the_amazon: ["space_2", "space_3"] },
  } };
  function discardState(amount: 1 | 2, items: string[]) {
    const before = state([...items, "asset_personal_assistant"]);
    before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = [];
    before.privateState.deckOrderById.assets = ["asset_fine_clothes"];
    before.reserveAssetIds = ["asset_holy_cross"];
    before.assetDiscardIds = ["asset_king_james_bible"];
    before.privateState.deckOrderById["encounter:research_cthulhu"] = [`encounter_research_cthulhu_0${amount === 1 ? 3 : 6}`, "encounter_research_cthulhu_02"];
    if (amount === 2) { before.players[0]!.locationId = "the_amazon"; before.boardClues![0]!.locationId = "the_amazon"; }
    return before;
  }
  function startDiscard(before: GameState) {
    const result = resolveResearchEncounter(before, "host", "chosen", discardContent, createDeterministicEngineContext({ dice: [1, 1], ids: ["discard-choice"] }));
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }
  function chooseDiscard(before: GameState, id: string) {
    return executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [id] }, discardContent, createDeterministicEngineContext({ ids: [`after-${id}`] }));
  }
  it("chooses one held Item, preserves Allies and unrelated piles, and cycles once", () => {
    const before = discardState(1, ["asset_45_automatic", "asset_38_revolver"]);
    const snapshot = structuredClone(before); const offered = startDiscard(before);
    expect(offered.pendingDecision).toMatchObject({ kind: "encounter_choice", minSelections: 1, maxSelections: 1, optionIds: ["asset_45_automatic", "asset_38_revolver"] });
    expect(before).toEqual(snapshot);
    const result = chooseDiscard(offered, "asset_38_revolver");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.assetIds).toEqual(["asset_45_automatic", "asset_personal_assistant"]);
    expect(result.state.assetDiscardIds).toEqual(["asset_king_james_bible", "asset_38_revolver"]);
    expect(result.state.reserveAssetIds).toEqual(before.reserveAssetIds); expect(result.state.privateState.deckOrderById.assets).toEqual(before.privateState.deckOrderById.assets);
    expect(result.state.privateState.tokenPoolById).toEqual(before.privateState.tokenPoolById); expect(result.state.boardClues).toEqual(before.boardClues);
    expect(result.state.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual(["encounter_research_cthulhu_02", "encounter_research_cthulhu_03"]);
    expect(result.events).toContainEqual({ type: "ASSET_DISCARDED", playerId: "host", assetId: "asset_38_revolver", reason: "encounter" });
    expect(result.state.activePlayerId).toBe("guest");
  });
  it("keeps all Items on a successful test and awards the printed physical Clues", () => {
    const before = discardState(1, ["asset_45_automatic"]);
    before.privateState.tokenPoolById.clues = ["clue_london"];
    const result = resolveResearchEncounter(before, "host", "chosen", discardContent, createDeterministicEngineContext({ dice: [6], tokenIndexes: [0] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.assetIds).toEqual(before.players[0]?.assetIds);
    expect(result.state.assetDiscardIds).toEqual(before.assetDiscardIds);
    expect(result.state.players[0]?.clues).toBe(2); expect(result.state.boardClues).toEqual([]);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham", "clue_london"]);
    expect(result.events.some(event => event.type === "ASSET_DISCARDED")).toBe(false);
  });
  it("restores successive two-Item choices before nearest-Sea relocation", () => {
    const before = discardState(2, ["asset_45_automatic", "asset_38_revolver", "asset_arcane_manuscripts"]);
    const offered = startDiscard(before); const first = chooseDiscard(offered, "asset_45_automatic");
    if (!first.ok) throw new Error(first.error.message);
    const restored: GameState = JSON.parse(JSON.stringify(first.state));
    expect(restored.pendingDecision?.optionIds).toEqual(["asset_38_revolver", "asset_arcane_manuscripts"]);
    expect(restored.boardClues).toEqual(before.boardClues);
    expect(restored.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual(before.privateState.deckOrderById["encounter:research_cthulhu"]);
    expect(executeCommand(restored, "guest", { type: "RESOLVE_DECISION", decisionId: restored.pendingDecision!.id, selectedOptionIds: ["asset_38_revolver"] }, discardContent, context())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    expect(chooseDiscard(restored, "asset_45_automatic").ok).toBe(false);
    const second = chooseDiscard(restored, "asset_arcane_manuscripts"); if (!second.ok) throw new Error(second.error.message);
    expect(second.state.assetDiscardIds).toEqual(["asset_king_james_bible", "asset_45_automatic", "asset_arcane_manuscripts"]);
    expect(second.state.pendingDecision?.optionIds).toEqual(["space_2", "space_3"]);
    const finish = chooseDiscard(JSON.parse(JSON.stringify(second.state)), "space_3"); if (!finish.ok) throw new Error(finish.error.message);
    expect(finish.state.boardClues).toEqual([{ id: "chosen", locationId: "space_3" }]);
    expect(finish.state.players[0]?.assetIds).toEqual(["asset_38_revolver", "asset_personal_assistant"]);
    expect(finish.state.privateState.tokenPoolById).toEqual(before.privateState.tokenPoolById);
    expect(finish.state.pendingLocationEncounter).toBeUndefined(); expect(finish.state.activePlayerId).toBe("guest");
  });
  it.each([0, 1])("discards only available Items when two are required (held=%s)", held => {
    const before = discardState(2, held ? ["asset_45_automatic"] : []);
    let next = startDiscard(before);
    if (held) { const result = chooseDiscard(next, "asset_45_automatic"); if (!result.ok) throw new Error(result.error.message); next = result.state; }
    expect(next.pendingDecision?.optionIds).toEqual(["space_2", "space_3"]);
    expect(next.players[0]?.assetIds).toEqual(["asset_personal_assistant"]);
    expect(next.assetDiscardIds).toEqual(["asset_king_james_bible", ...(held ? ["asset_45_automatic"] : [])]);
  });
  it("rejects refusal, Allies, remote cards, vanished holdings and duplicate sources atomically", () => {
    const offered = startDiscard(discardState(1, ["asset_45_automatic"]));
    for (const id of ["asset_personal_assistant", "asset_holy_cross", "asset_unknown"]) expect(chooseDiscard(offered, id).ok).toBe(false);
    expect(executeCommand(offered, "host", { type: "RESOLVE_DECISION", decisionId: offered.pendingDecision!.id, selectedOptionIds: [] }, discardContent, context()).ok).toBe(false);
    for (const variation of ["vanished", "duplicated"] as const) {
      const changed = structuredClone(offered);
      if (variation === "vanished") changed.players[0]!.assetIds = ["asset_personal_assistant"];
      else changed.privateState.deckOrderById.assets!.push("asset_45_automatic");
      const snapshot = structuredClone(changed);
      expect(chooseDiscard(changed, "asset_45_automatic")).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } }); expect(changed).toEqual(snapshot);
    }
  });
  it.each(["deck", "reserve", "discard", "other_player", "defeated", "same_player"])("preflights duplicate physical Items in %s", pile => {
    const before = discardState(1, ["asset_45_automatic"]);
    if (pile === "deck") before.privateState.deckOrderById.assets!.push("asset_45_automatic");
    else if (pile === "reserve") before.reserveAssetIds.push("asset_45_automatic");
    else if (pile === "discard") before.assetDiscardIds.push("asset_45_automatic");
    else if (pile === "other_player") before.players[1]!.assetIds = ["asset_45_automatic"];
    else if (pile === "same_player") before.players[0]!.assetIds.push("asset_45_automatic");
    else before.defeatedInvestigators = [{ investigatorId: "trish_scarborough", locationId: "arkham", cause: "health", assetIds: ["asset_45_automatic"], clues: 0, travelTickets: [] }];
    const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", discardContent, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(before).toEqual(snapshot);
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
