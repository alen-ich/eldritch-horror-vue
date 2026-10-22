import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, projectStateForPlayer, resolveLocationEncounter, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  locationEncounters: [
    { id: "encounter_general_08", deck: "general", sections: { sea: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [{ kind: "clues", amount: 1 }] }, fail: { kind: "effects", effects: [] } } } },
    { id: "encounter_general_01", deck: "general", sections: { sea: { kind: "choice", options: [] } } },
    { id: "encounter_general_resource", deck: "general", sections: { sea: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [{ kind: "recover_sanity", amount: 2 }] }, fail: { kind: "effects", effects: [{ kind: "sanity", amount: -1 }] } } } },
    { id: "encounter_general_04", deck: "general", sections: { city: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [] }, fail: { kind: "effects", effects: [{ kind: "condition", condition: "leg_injury" }] } } } },
  ],
  conditions: [{ id: "condition_leg_injury_01", kind: "leg_injury", trait: "injury" }],
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  map: { adjacentLocationIds: { space_2: ["arkham", "london"] }, routes: [], locationTypes: { space_2: "sea", arkham: "city", london: "city" } },
  investigators: { akachi_onyele: { startingLocationId: "space_2", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", turnNumber: 1, ancientOneId: "cthulhu", doom: 12,
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, assetIds: [], clues: 0, skillImprovements: {} },
      { id: "guest", investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, assetIds: [], clues: 0, skillImprovements: {} },
    ],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    privateState: { deckOrderById: { "encounter:general": ["encounter_general_08", "encounter_general_01"] }, tokenPoolById: { clues: ["clue_arkham"], clue_discard: [], "held_clues:host": [], "held_clues:guest": [] } },
  };
}

describe("guarded location encounter", () => {
  function withInstruction(instruction: unknown): GameContent {
    return { ...content, locationEncounters: [{ id: "encounter_general_08", deck: "general", sections: { sea: instruction } }] };
  }

  function choose(before: GameState, selected: string[], rules: GameContent, dice: number[] = []) {
    return executeCommand(JSON.parse(JSON.stringify(before)) as GameState, "host", {
      type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: selected,
    }, rules, createDeterministicEngineContext({ dice, tokenIndexes: [0], ids: ["next-choice"] }));
  }

  it("persists optional costs and chosen improvements privately across successive decisions", () => {
    const rules = withInstruction({ kind: "optional", cost: [{ kind: "delay" }], reward: { kind: "effects", effects: [{ kind: "improve", skill: "chosen" }] } });
    const before = state();
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ ids: ["offer"] }));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.pendingDecision).toMatchObject({ kind: "encounter_choice", optionIds: ["accept", "skip"] });
    expect(projectStateForPlayer(started.state, "guest").pendingDecision).not.toHaveProperty("optionLabels");
    expect(projectStateForPlayer(started.state, "host")).not.toHaveProperty("pendingLocationEncounter");
    expect(executeCommand(started.state, "guest", { type: "RESOLVE_DECISION", decisionId: "offer", selectedOptionIds: ["accept"] }, rules))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const accepted = choose(started.state, ["accept"], rules);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(accepted.state).toMatchObject({ stateVersion: 4, activePlayerId: "host", pendingDecision: { optionIds: ["lore", "influence", "observation", "strength", "will"] } });
    expect(accepted.state.players[0]?.delayed).toBe(true);
    const finished = choose(accepted.state, ["lore"], rules);
    expect(finished).toMatchObject({ ok: true, state: { stateVersion: 5, activePlayerId: "guest", pendingLocationEncounter: undefined, pendingDecision: undefined } });
    if (finished.ok) expect(finished.state.players[0]?.skillImprovements.lore).toBe(1);
    expect(before.players[0]?.delayed).toBeUndefined();
    expect(choose(started.state, ["skip"], rules)).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    before.players[0]!.delayed = true;
    expect(resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({})))
      .toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
  });

  it("applies sequence prefixes once and rolls the improved skill before resuming a printed choice", () => {
    const rules = withInstruction({ kind: "sequence", steps: [
      { kind: "effects", effects: [{ kind: "improve", skill: "influence" }] },
      { kind: "test", skill: "influence", modifier: 0, pass: { kind: "choice", options: [
        { kind: "effects", effects: [{ kind: "recover_sanity", amount: 2 }] }, { kind: "effects", effects: [{ kind: "clues", amount: 1 }] },
      ] }, fail: { kind: "effects", effects: [] } },
    ] });
    const before = state();
    before.players[0]!.clues = 1;
    before.players[0]!.sanity = 5;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_london"];
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ dice: [1, 1, 1], ids: ["test", "reroll"] }));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.activeTest?.dicePool).toBe(3);
    const rerolled = choose(started.state, ["die-0"], rules, [5]);
    if (!rerolled.ok) throw new Error(rerolled.error.message);
    expect(rerolled.state.pendingDecision).toMatchObject({ optionIds: ["option-0", "option-1"] });
    const finished = choose(rerolled.state, ["option-0"], rules);
    if (!finished.ok) throw new Error(finished.error.message);
    expect(finished.state.players[0]).toMatchObject({ clues: 0, sanity: 7, skillImprovements: { influence: 1 } });
    expect(finished.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    expect(finished.state.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_01"]);
  });

  it("requires the entire optional cost and conserves paid physical Clues", () => {
    const rules = withInstruction({ kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: { kind: "effects", effects: [{ kind: "recover_health", amount: 2 }] } });
    const before = state();
    before.players[0]!.health = 2;
    expect(resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({})))
      .toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_london"];
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ ids: ["cost"] }));
    if (!started.ok) throw new Error(started.error.message);
    const paid = choose(started.state, ["accept"], rules);
    if (!paid.ok) throw new Error(paid.error.message);
    expect(paid.state.players[0]).toMatchObject({ clues: 0, health: 4 });
    expect(paid.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    expect(paid.state.privateState.tokenPoolById["held_clues:host"]).toEqual([]);
  });

  it("places a private physical Clue on the chosen legal space and rejects unknown targets", () => {
    const rules = withInstruction({ kind: "effects", effects: [{ kind: "spawn_clues", amount: 1, target: "chosen_space" }] });
    const started = resolveLocationEncounter(state(), "host", "general", rules, createDeterministicEngineContext({ ids: ["space-choice"] }));
    if (!started.ok) throw new Error(started.error.message);
    expect(choose(started.state, ["not-a-space"], rules)).toMatchObject({ ok: false });
    const placed = choose(started.state, ["london"], rules);
    if (!placed.ok) throw new Error(placed.error.message);
    expect(placed.state.boardClues).toMatchObject([{ locationId: "london" }]);
    expect(placed.state.privateState.tokenPoolById.clues).toEqual([]);
    expect(JSON.stringify(projectStateForPlayer(placed.state))).not.toContain("clue_arkham");
  });

  it("rejects any unmodeled nested outcome before rolling or applying sequence prefixes", () => {
    const rules = withInstruction({ kind: "sequence", steps: [
      { kind: "effects", effects: [{ kind: "clues", amount: 1 }] },
      { kind: "choice", options: [{ kind: "effects", effects: [{ kind: "artifact", amount: 1 }] }] },
    ] });
    const before = state();
    expect(resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(before).toEqual(state());
  });

  it("lets Lily choose a double improvement and caps the skill at two", () => {
    const before = state();
    before.players[0]!.investigatorId = "lily_chen";
    before.players[0]!.skillImprovements.lore = 1;
    const rules = withInstruction({ kind: "effects", effects: [{ kind: "improve", skill: "lore" }] });
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ ids: ["lily"] }));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.pendingDecision?.optionIds).toEqual(["once", "twice"]);
    const finished = choose(started.state, ["twice"], rules);
    if (!finished.ok) throw new Error(finished.error.message);
    expect(finished.state.players[0]?.skillImprovements.lore).toBe(2);
    expect(finished.state.pendingDecision).toBeUndefined();
  });

  it.each(["delay", "condition"])("lets Mark refuse a mandatory %s without cancelling later effects", kind => {
    const before = state();
    before.players[0]!.investigatorId = "mark_harrigan";
    const rules = withInstruction({ kind: "effects", effects: [kind === "delay" ? { kind } : { kind, condition: "detained" }, { kind: "improve", skill: "will" }] });
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ ids: ["mark"] }));
    if (!started.ok) throw new Error(started.error.message);
    const refused = choose(started.state, ["refuse"], rules);
    if (!refused.ok) throw new Error(refused.error.message);
    expect(refused.state.players[0]?.delayed).not.toBe(true);
    expect(refused.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(refused.state.players[0]?.skillImprovements.will).toBe(1);
  });

  it("Mark's optional Delay cost is accepted explicitly and cannot be refused after taking its reward", () => {
    const before = state();
    before.players[0]!.investigatorId = "mark_harrigan";
    const rules = withInstruction({ kind: "optional", cost: [{ kind: "delay" }], reward: { kind: "effects", effects: [{ kind: "improve", skill: "will" }] } });
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ ids: ["cost"] }));
    if (!started.ok) throw new Error(started.error.message);
    const accepted = choose(started.state, ["accept"], rules);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(accepted.state.players[0]).toMatchObject({ delayed: true, skillImprovements: { will: 1 } });
    expect(accepted.state.pendingDecision).toBeUndefined();
  });

  it("discards the selected Madness to its physical supply without exposing its reverse", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_paranoia_01", "condition_hallucinations_01"];
    const rules: GameContent = { ...withInstruction({ kind: "effects", effects: [{ kind: "discard", target: "madness" }] }), conditions: [
      { id: "condition_paranoia_01", kind: "paranoia", trait: "madness" },
      { id: "condition_hallucinations_01", kind: "hallucinations", trait: "madness" },
    ] };
    const started = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ ids: ["discard"] }));
    if (!started.ok) throw new Error(started.error.message);
    expect(projectStateForPlayer(started.state, "guest").pendingDecision).not.toHaveProperty("optionIds");
    const finished = choose(started.state, ["condition_paranoia_01"], rules);
    if (!finished.ok) throw new Error(finished.error.message);
    expect(finished.state.players[0]?.conditionIds).toEqual(["condition_hallucinations_01"]);
    expect(finished.state.privateState.tokenPoolById["condition:paranoia"]).toEqual(["condition_paranoia_01"]);
    expect(finished.events).toContainEqual({ type: "CONDITION_DISCARDED", playerId: "host", conditionId: "condition_paranoia" });
  });

  it("draws a Madness from the finite trait supply and prevents duplicate kinds", () => {
    const before = state();
    before.privateState.tokenPoolById["condition:paranoia"] = ["condition_paranoia_01"];
    const rules: GameContent = { ...withInstruction({ kind: "effects", effects: [{ kind: "condition", condition: "madness" }] }),
      conditions: [{ id: "condition_paranoia_01", kind: "paranoia", trait: "madness" }, { id: "condition_paranoia_02", kind: "paranoia", trait: "madness" }] };
    const result = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ tokenIndexes: [0] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_paranoia_01"]);
    expect(result.state.privateState.tokenPoolById["condition:paranoia"]).toEqual([]);
    before.players[0]!.conditionIds = ["condition_paranoia_02"];
    const duplicate = resolveLocationEncounter(before, "host", "general", rules, createDeterministicEngineContext({ tokenIndexes: [0] }));
    if (!duplicate.ok) throw new Error(duplicate.error.message);
    expect(duplicate.state.players[0]?.conditionIds).toEqual(["condition_paranoia_02"]);
    expect(duplicate.state.privateState.tokenPoolById["condition:paranoia"]).toEqual(["condition_paranoia_01"]);
    expect(duplicate.events).toContainEqual({ type: "CONDITION_GAIN_PREVENTED", playerId: "host", kind: "paranoia" });
  });
  it("resolves the verified no-choice test, awards a physical Clue, discards the card and advances the investigator", () => {
    const before = state();
    const result = executeCommand(before, "host", { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" }, content,
      createDeterministicEngineContext({ dice: [1, 5], tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: true, state: { stateVersion: 3, phase: "encounter", activePlayerId: "guest", lastLocationEncounterCardId: "encounter_general_08" } });
    if (!result.ok) return;
    expect(result.state.players[0]?.clues).toBe(1);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]);
    expect(result.state.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_01"]);
    expect(result.state.locationDiscardIdsByDeck?.general).toEqual(["encounter_general_08"]);
    expect(result.events[0]).toMatchObject({ type: "LOCATION_ENCOUNTER_RESOLVED", cardId: "encounter_general_08", dice: [1, 5], successes: 1 });
    expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_08", "encounter_general_01"]);
  });

  it("resolves the failed test without awarding a Clue and enters Mythos after the last investigator", () => {
    const before = state();
    before.activePlayerId = "guest";
    const result = resolveLocationEncounter(before, "guest", "general", content, createDeterministicEngineContext({ dice: [1, 2] }));
    expect(result).toMatchObject({ ok: true, state: { phase: "mythos", activePlayerId: "host" } });
    if (result.ok) expect(result.state.players[1]?.clues).toBe(0);
  });

  it("offers a reconnectable Clue reroll, enforces ownership, then completes the encounter", () => {
    const before = state();
    before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    before.privateState.tokenPoolById.clues = ["clue_london"];
    const started = executeCommand(before, "host", { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" }, content,
      createDeterministicEngineContext({ dice: [1, 1], ids: ["test-1", "choice-1"] }));
    expect(started).toMatchObject({ ok: true, state: { currentLocationEncounterCardId: "encounter_general_08", activeTest: { continuation: "location_encounter" }, pendingDecision: { playerId: "host" } } });
    if (!started.ok) return;
    expect(started.state.privateState.deckOrderById["encounter:general"]?.[0]).toBe("encounter_general_01");
    expect(started.state.pendingLocationEncounter?.cardRemovedFromDeck).toBe(true);
    const wrongOwner = executeCommand(started.state, "guest", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["die-0"] }, content, createDeterministicEngineContext({ dice: [5] }));
    expect(wrongOwner).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const finished = executeCommand(started.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["die-0"] }, content,
      createDeterministicEngineContext({ dice: [5], tokenIndexes: [0] }));
    expect(finished).toMatchObject({ ok: true, state: { stateVersion: 4, activePlayerId: "guest", currentLocationEncounterCardId: undefined, lastLocationEncounterCardId: "encounter_general_08" } });
    if (!finished.ok) return;
    expect(finished.state.players[0]?.clues).toBe(1);
    expect(finished.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_london"]);
    expect(finished.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(finished.state.activeTest).toBeUndefined();
  });

  it("allows keeping the first result without spending a Clue", () => {
    const before = state();
    before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    const started = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1], ids: ["test-1", "choice-1"] }));
    if (!started.ok) throw new Error("Expected an encounter decision");
    const finished = executeCommand(started.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: [] }, content, createDeterministicEngineContext({}));
    expect(finished).toMatchObject({ ok: true, state: { activePlayerId: "guest", lastLocationEncounterCardId: "encounter_general_08" } });
    if (finished.ok) expect(finished.state.players[0]?.clues).toBe(1);
  });

  it("applies recovery and loss, then pauses lethal damage for defeat before advancing", () => {
    const before = state();
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_resource"];
    before.players[0]!.sanity = 6;
    const passed = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [5, 1] }));
    expect(passed).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    if (passed.ok) {
      expect(passed.state.players[0]?.sanity).toBe(7);
      expect(passed.events).toContainEqual({ type: "INVESTIGATOR_RECOVERED", playerId: "host", healthRecovered: 0, sanityRecovered: 1 });
    }
    const failed = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1] }));
    expect(failed).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    if (failed.ok) expect(failed.state.players[0]?.sanity).toBe(5);
    before.players[0]!.sanity = 1;
    const defeated = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1] }));
    expect(defeated).toMatchObject({ ok: true, state: { stateVersion: 3, activePlayerId: "host", doom: 11,
      pendingDefeat: { playerId: "host", causes: ["sanity"], cityIds: ["arkham", "london"] }, lastLocationEncounterCardId: "encounter_general_resource" } });
    if (!defeated.ok) return;
    const resolved = executeCommand(JSON.parse(JSON.stringify(defeated.state)) as GameState, "host", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "sanity", leadPlayerId: "guest" }, content);
    expect(resolved).toMatchObject({ ok: true, state: { stateVersion: 4, activePlayerId: "guest", leadInvestigatorId: "guest", pendingDefeat: undefined } });
    expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_resource"]);
  });

  it("combines simultaneous depletion, cancels later effects, and refuses unsupported awakening atomically", () => {
    const before = state();
    before.players[0]!.health = before.players[0]!.sanity = 1;
    const lethalContent: GameContent = { ...content, locationEncounters: [{ id: "lethal", deck: "general", sections: { sea: { kind: "effects", effects: [
      { kind: "health", amount: -1 }, { kind: "sanity", amount: -1 }, { kind: "clues", amount: 1 },
    ] } } }] };
    before.privateState.deckOrderById["encounter:general"] = ["lethal"];
    const result = resolveLocationEncounter(before, "host", "general", lethalContent, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, state: { pendingDefeat: { causes: ["health", "sanity"] } } });
    if (result.ok) expect(result.state.players[0]?.clues).toBe(0);
    before.doom = 1;
    const snapshot = structuredClone(before);
    expect(resolveLocationEncounter(before, "host", "general", lethalContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
  });

  it("resolves General 4 city failure through the physical Condition supply", () => {
    const before = state();
    before.players[0]!.locationId = "arkham";
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_04"];
    before.privateState.tokenPoolById["condition:leg_injury"] = ["condition_leg_injury_01"];
    const result = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1], tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    if (!result.ok) return;
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_leg_injury_01"]);
    expect(result.events).toContainEqual({ type: "CONDITION_GAINED", playerId: "host", conditionId: "condition_leg_injury" });
    expect(before.privateState.tokenPoolById["condition:leg_injury"]).toEqual(["condition_leg_injury_01"]);
  });

  it("refuses unsupported text, possessions, wrong deck, and mandatory combat without consuming the card", () => {
    const before = state();
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_01"];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_08"];
    before.players[0]!.assetIds = ["untyped_asset"];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    before.players[0]!.assetIds = [];
    expect(resolveLocationEncounter(before, "host", "europe", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_DECK_ILLEGAL" } });
    before.monsters = [{ id: "m1", monsterId: "ghoul", locationId: "space_2", damage: 0 }];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_DECK_ILLEGAL" } });
    expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_08"]);
  });
});
