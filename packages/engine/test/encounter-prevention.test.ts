import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { createLobby, executeCommand, resolveLocationEncounter, projectStateForPlayer, createDeterministicEngineContext, type GameContent, type GameState } from "../src/index.js";
import { parseLocationEncounterInstruction } from "../src/encounter-instructions.js";

const content: GameContent = {
  assets: baseGameAssets, map: { locationTypes: { arkham: "city", london: "city" }, adjacentLocationIds: {}, routes: [] },
  investigators: { akachi_onyele: { startingLocationId: "arkham", startingAssetIds: [], startingClues: 0, health: 5, sanity: 7, skills: { lore: 3, strength: 2, influence: 2, observation: 2, will: 4 } } },
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
const context = () => createDeterministicEngineContext({ ids: ["prevention", "later"], dice: [1] });
function fixture(healthLoss = 3, sanityLoss = 0, holder = "host", assetId = "asset_bandages") {
  const state = createLobby(["host", "guest"]); state.phase = "encounter";
  state.activePlayerId = state.leadInvestigatorId = "host"; state.ancientOneId = "cthulhu"; state.doom = 12;
  for (const player of state.players) Object.assign(player, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 0, maxHealth: 5, maxSanity: 7 });
  state.players.find(player => player.id === holder)!.assetIds = [assetId];
  state.privateState.deckOrderById["encounter:general"] = ["encounter_general_01", "encounter_general_02"];
  const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: {
    kind: "effects", effects: [{ kind: "health", amount: -healthLoss }, { kind: "sanity", amount: -sanityLoss }, { kind: "improve", skill: "lore" }],
  } } }] };
  return { state, rules };
}
function start(state: GameState, rules: GameContent) {
  const result = resolveLocationEncounter(state, "host", "general", rules, context());
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function choose(state: GameState, rules: GameContent, selected = "asset_bandages", owner = state.pendingDecision!.playerId) {
  return executeCommand(state, owner, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: [selected] }, rules, context());
}
describe("ordinary encounter Bandages prevention", () => {
  it.each([1, 2, 3])("prevents up to two of %s Health loss without healing or changing Sanity loss", loss => {
    const { state, rules } = fixture(loss, 2); const before = start(state, rules);
    expect(before.players[0]?.health).toBe(5); expect(before.players[0]?.sanity).toBe(7);
    expect(before.pendingDefeat).toBeUndefined(); expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_02"]);
    expect(before.pendingLocationEncounter?.cardRemovedFromDeck).toBe(true);
    expect(before.pendingDecision?.optionLabels?.asset_bandages).toBe(`Discard Bandages: prevent ${Math.min(2, loss)} Health loss`);
    const snapshot = structuredClone(before); const result = choose(JSON.parse(JSON.stringify(before)), rules);
    if (!result.ok) throw new Error(result.error.message);
    expect(before).toEqual(snapshot); expect(result.state.players[0]?.health).toBe(5 - Math.max(0, loss - 2));
    expect(result.state.players[0]?.sanity).toBe(5); expect(result.state.players[0]?.skillImprovements.lore).toBe(1);
    expect(result.state.assetDiscardIds).toEqual(["asset_bandages"]); expect(result.state.players[0]?.assetIds).toEqual([]);
    expect(result.state.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_02"]);
    expect(result.state.locationDiscardIdsByDeck?.general).toEqual(["encounter_general_01"]);
    expect(result.state.activePlayerId).toBe("guest");
  });
  it("lets a same-space colleague decide privately without changing the encounter owner", () => {
    const { state, rules } = fixture(3, 0, "guest"); const offered = start(state, rules);
    expect(offered.pendingDecision?.playerId).toBe("guest"); expect(offered.pendingLocationEncounter?.playerId).toBe("host");
    expect(projectStateForPlayer(offered, "host").pendingDecision).not.toHaveProperty("optionIds");
    expect(projectStateForPlayer(offered, "guest").pendingDecision).toHaveProperty("optionIds");
    expect(choose(offered, rules, "asset_bandages", "host")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = choose(offered, rules); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.health).toBe(4); expect(result.state.players[1]?.health).toBe(5);
    expect(result.state.players[1]?.assetIds).toEqual([]);
  });
  it("declines once per loss, keeps the Item and applies the original damage", () => {
    const { state, rules } = fixture(); const result = choose(start(state, rules), rules, "skip");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.health).toBe(2); expect(result.state.players[0]?.assetIds).toEqual(["asset_bandages"]);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.assetDiscardIds).toEqual([]);
  });
  it.each(["remote", "defeated", "eliminated"])("does not offer a %s holder's prevention", status => {
    const { state, rules } = fixture(1, 0, "guest");
    if (status === "remote") state.players[1]!.locationId = "london";
    else state.players[1]![status as "defeated" | "eliminated"] = true;
    const result = start(state, rules); expect(result.pendingDecision).toBeUndefined(); expect(result.players[0]?.health).toBe(4);
  });
  it("does not offer Bandages for Sanity-only or zero loss", () => {
    for (const sanity of [0, 2]) { const { state, rules } = fixture(0, sanity); expect(start(state, rules).pendingDecision).toBeUndefined(); }
  });
  it("prevents lethal Health loss before defeat, but cannot prevent simultaneous Sanity defeat", () => {
    const { state, rules } = fixture(2, 0); state.players[0]!.health = 1;
    const saved = choose(start(state, rules), rules); if (!saved.ok) throw new Error(saved.error.message);
    expect(saved.state.pendingDefeat).toBeUndefined(); expect(saved.state.players[0]?.health).toBe(1);
    const both = fixture(2, 7); both.state.players[0]!.health = 1;
    const defeated = choose(start(both.state, both.rules), both.rules); if (!defeated.ok) throw new Error(defeated.error.message);
    expect(defeated.state.pendingDefeat?.causes).toEqual(["sanity"]); expect(defeated.state.players[0]?.skillImprovements.lore).toBeUndefined();
    expect(defeated.state.pendingLocationEncounter).toBeUndefined(); expect(defeated.state.assetDiscardIds).toEqual(["asset_bandages"]);
  });
  it("declining lethal simultaneous damage retains both defeat causes and discards once", () => {
    const { state, rules } = fixture(5, 7); const result = choose(start(state, rules), rules, "skip");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingDefeat?.causes).toEqual(["health", "sanity"]);
    expect(result.state.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_02"]);
    expect(result.state.locationDiscardIdsByDeck?.general).toEqual(["encounter_general_01"]);
    expect(result.state.players[0]?.skillImprovements.lore).toBeUndefined();
  });
  it("still defeats when remaining Health loss is lethal, preserving a pure input transition", () => {
    const { state, rules } = fixture(4); state.players[0]!.health = 1;
    const offered = start(state, rules); const snapshot = structuredClone(offered);
    const result = choose(offered, rules); if (!result.ok) throw new Error(result.error.message);
    expect(offered).toEqual(snapshot); expect(result.state.pendingDefeat?.causes).toEqual(["health"]);
    expect(result.state.players[0]?.skillImprovements.lore).toBeUndefined(); expect(result.state.assetDiscardIds).toEqual(["asset_bandages"]);
    expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("rejects forged amounts and replayed choices without consuming another card", () => {
    const { state, rules } = fixture(); const offered = start(state, rules);
    expect(choose(offered, rules, "asset_bandages:prevent-3")).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
    const result = choose(offered, rules); if (!result.ok) throw new Error(result.error.message);
    const snapshot = structuredClone(result.state);
    expect(executeCommand(result.state, "host", { type: "RESOLVE_DECISION", decisionId: offered.pendingDecision!.id, selectedOptionIds: ["asset_bandages"] }, rules, context())).toMatchObject({ ok: false, error: { code: "NO_PENDING_DECISION" } });
    expect(result.state).toEqual(snapshot);
  });
  it.each(["lost", "moved", "duplicate", "defeated"])("rejects a %s offered source without mutating state", change => {
    const { state, rules } = fixture(3, 0, "guest"); const offered = start(state, rules);
    if (change === "lost") offered.players[1]!.assetIds = [];
    if (change === "moved") offered.players[1]!.locationId = "london";
    if (change === "duplicate") offered.reserveAssetIds.push("asset_bandages");
    if (change === "defeated") offered.players[1]!.defeated = true;
    const snapshot = structuredClone(offered);
    expect(choose(offered, rules)).toMatchObject({ ok: false, error: { code: change === "defeated" ? "INVESTIGATOR_DEFEATED" : "INVALID_DECISION_SELECTION" } }); expect(offered).toEqual(snapshot);
  });
  it.each(["reserve", "deck", "discard", "holding"])("rejects duplicate Bandages in %s before beginning the encounter", pile => {
    const { state, rules } = fixture();
    if (pile === "reserve") state.reserveAssetIds.push("asset_bandages");
    if (pile === "deck") state.privateState.deckOrderById.assets = ["asset_bandages"];
    if (pile === "discard") state.assetDiscardIds.push("asset_bandages");
    if (pile === "holding") state.players[1]!.assetIds.push("asset_bandages");
    const snapshot = structuredClone(state);
    expect(resolveLocationEncounter(state, "host", "general", rules, context())).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(state).toEqual(snapshot);
  });
  it("does not import server-created reaction checkpoints as printed content", () => {
    expect(parseLocationEncounterInstruction({ kind: "damage_reaction", healthLoss: 1, sanityLoss: 0, declinedPlayerIds: [] })).toBeUndefined();
  });
  it("allows deliberately preventing only one Health while still discarding the whole card", () => {
    const { state, rules } = fixture(3); const result = choose(start(state, rules), rules, "asset_bandages:prevent-1");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.health).toBe(3); expect(result.state.assetDiscardIds).toEqual(["asset_bandages"]);
  });
  it("can save Health at Doom one, but rejects unsupported awakening on decline atomically", () => {
    const { state, rules } = fixture(2); state.doom = 1; state.players[0]!.health = 1;
    const offered = start(state, rules); const snapshot = structuredClone(offered);
    expect(choose(offered, rules, "skip")).toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } }); expect(offered).toEqual(snapshot);
    const saved = choose(offered, rules); if (!saved.ok) throw new Error(saved.error.message);
    expect(saved.state.doom).toBe(1); expect(saved.state.players[0]?.health).toBe(1);
  });
  it("declining one loss does not suppress prevention for a later loss in the encounter", () => {
    const { state } = fixture(); const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "effects", effects: [{ kind: "health", amount: -1 }, { kind: "improve", skill: "lore" }, { kind: "health", amount: -2 }] } } }] };
    const first = choose(start(state, rules), rules, "skip"); if (!first.ok) throw new Error(first.error.message);
    expect(first.state.players[0]?.health).toBe(4); expect(first.state.pendingDecision?.optionIds).toContain("asset_bandages");
    const second = choose(JSON.parse(JSON.stringify(first.state)), rules); if (!second.ok) throw new Error(second.error.message);
    expect(second.state.players[0]?.health).toBe(4); expect(second.state.players[0]?.skillImprovements.lore).toBe(1);
  });
  it("guards paid Health costs rather than treating them as preventable loss", () => {
    const { state } = fixture(); const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "optional", cost: [{ kind: "health", amount: -1 }], reward: { kind: "effects", effects: [] } } } }] };
    expect(resolveLocationEncounter(state, "host", "general", rules, context())).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
  });
  it.each([true, false])("orders prevention before a mandatory Item discard (prevent=%s)", prevent => {
    const { state } = fixture();
    const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "effects", effects: [{ kind: "health", amount: -1 }, { kind: "discard_item_assets", amount: 1 }] } } }] };
    const reacted = choose(start(state, rules), rules, prevent ? "asset_bandages" : "skip"); if (!reacted.ok) throw new Error(reacted.error.message);
    let final = reacted.state;
    if (!prevent) {
      expect(final.pendingDecision?.prompt).toContain("Item Asset to discard");
      const discarded = choose(final, rules); if (!discarded.ok) throw new Error(discarded.error.message); final = discarded.state;
    }
    expect(final.players[0]?.health).toBe(prevent ? 5 : 4); expect(final.assetDiscardIds).toEqual(["asset_bandages"]);
    expect(final.players[0]?.assetIds).toEqual([]); expect(final.boardClues).toEqual(state.boardClues);
    expect(final.pendingLocationEncounter).toBeUndefined();
  });
  it("guards a colleague's Bandages in nested ambush branches before the first roll", () => {
    const { state } = fixture(1, 0, "guest");
    const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "test", skill: "lore", modifier: 0, pass: { kind: "effects", effects: [] }, fail: { kind: "ambush", monsterId: "monster_deep_one", defeated: { kind: "effects", effects: [] }, notDefeated: { kind: "effects", effects: [] } } } } }] };
    const snapshot = structuredClone(state);
    expect(resolveLocationEncounter(state, "host", "general", rules, context())).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(state).toEqual(snapshot);
  });
});

describe("Whiskey and combined ordinary encounter prevention", () => {
  it.each([1, 2, 3])("prevents up to two of %s Sanity loss, never Health loss or healing", loss => {
    const { state, rules } = fixture(1, loss, "host", "asset_whiskey");
    const offered = start(state, rules); const snapshot = structuredClone(offered);
    expect(offered.players[0]?.sanity).toBe(7);
    expect(offered.pendingDecision?.optionLabels?.asset_whiskey).toBe(`Discard Whiskey: prevent ${Math.min(2, loss)} Sanity loss`);
    const result = choose(JSON.parse(JSON.stringify(offered)), rules, "asset_whiskey"); if (!result.ok) throw new Error(result.error.message);
    expect(offered).toEqual(snapshot); expect(result.state.players[0]?.health).toBe(4);
    expect(result.state.players[0]?.sanity).toBe(7 - Math.max(0, loss - 2));
    expect(result.state.players[0]?.skillImprovements.lore).toBe(1);
    expect(result.state.assetDiscardIds).toEqual(["asset_whiskey"]); expect(result.state.players[0]?.assetIds).toEqual([]);
    expect(result.state.activePlayerId).toBe("guest");
  });
  it.each(["skip", "asset_whiskey:prevent-1"])("supports optional %s rather than automatically preventing all loss", option => {
    const { state, rules } = fixture(0, 3, "host", "asset_whiskey");
    const result = choose(start(state, rules), rules, option); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.sanity).toBe(option === "skip" ? 4 : 5);
    expect(result.state.assetDiscardIds).toEqual(option === "skip" ? [] : ["asset_whiskey"]);
  });
  it.each(["remote", "defeated", "eliminated"])("excludes a %s Whiskey holder", status => {
    const { state, rules } = fixture(0, 2, "guest", "asset_whiskey");
    if (status === "remote") state.players[1]!.locationId = "london";
    else state.players[1]![status as "defeated" | "eliminated"] = true;
    const result = start(state, rules); expect(result.pendingDecision).toBeUndefined(); expect(result.players[0]?.sanity).toBe(5);
  });
  it("never offers Whiskey for Health-only or zero loss", () => {
    for (const health of [0, 2]) { const { state, rules } = fixture(health, 0, "host", "asset_whiskey"); expect(start(state, rules).pendingDecision).toBeUndefined(); }
  });
  it.each(["host", "guest"])("restores %s's private Whiskey choice before lethal Sanity damage", holder => {
    const { state, rules } = fixture(0, 2, holder, "asset_whiskey"); state.players[0]!.sanity = 1; state.doom = 1;
    const offered = start(state, rules); expect(offered.pendingDefeat).toBeUndefined(); expect(offered.pendingDecision?.playerId).toBe(holder);
    expect(projectStateForPlayer(offered, holder).pendingDecision).toHaveProperty("optionIds");
    const other = holder === "host" ? "guest" : "host";
    expect(projectStateForPlayer(offered, other).pendingDecision).not.toHaveProperty("optionIds");
    expect(choose(offered, rules, "asset_whiskey", other)).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const snapshot = structuredClone(offered);
    expect(choose(offered, rules, "skip")).toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } }); expect(offered).toEqual(snapshot);
    const result = choose(JSON.parse(JSON.stringify(offered)), rules, "asset_whiskey"); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.sanity).toBe(1); expect(result.state.pendingDefeat).toBeUndefined(); expect(result.state.doom).toBe(1);
  });
  it.each(["asset_bandages", "asset_whiskey"])("offers both held sources in %s-first order before simultaneous damage", first => {
    const { state, rules } = fixture(2, 2); state.players[0]!.health = state.players[0]!.sanity = 1;
    const second = first === "asset_bandages" ? "asset_whiskey" : "asset_bandages";
    state.players[0]!.assetIds = [first, second];
    const reacted = choose(start(state, rules), rules, first); if (!reacted.ok) throw new Error(reacted.error.message);
    expect(reacted.state.players[0]?.health).toBe(1); expect(reacted.state.players[0]?.sanity).toBe(1); expect(reacted.state.pendingDefeat).toBeUndefined();
    expect(reacted.state.pendingDecision?.optionIds).toContain(second);
    const saved = choose(JSON.parse(JSON.stringify(reacted.state)), rules, second); if (!saved.ok) throw new Error(saved.error.message);
    expect(saved.state.players[0]?.health).toBe(1); expect(saved.state.players[0]?.sanity).toBe(1); expect(saved.state.pendingDefeat).toBeUndefined();
    expect(saved.state.assetDiscardIds).toEqual([first, second]); expect(saved.state.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_02"]);
  });
  it.each(["asset_bandages", "asset_whiskey"])("declining %s does not decline another source held by the same investigator", first => {
    const { state, rules } = fixture(2, 2); const second = first === "asset_bandages" ? "asset_whiskey" : "asset_bandages";
    state.players[0]!.assetIds = [first, second];
    const declined = choose(start(state, rules), rules, "skip"); if (!declined.ok) throw new Error(declined.error.message);
    expect(declined.state.pendingDecision?.optionIds).toContain(second);
    const accepted = choose(JSON.parse(JSON.stringify(declined.state)), rules, second); if (!accepted.ok) throw new Error(accepted.error.message);
    expect(accepted.state.players[0]?.assetIds).toEqual([first]); expect(accepted.state.assetDiscardIds).toEqual([second]);
    expect(accepted.state.players[0]?.health).toBe(first === "asset_bandages" ? 3 : 5);
    expect(accepted.state.players[0]?.sanity).toBe(first === "asset_whiskey" ? 5 : 7);
  });
  it("hands the checkpoint between different same-space holders without applying damage early", () => {
    const { state, rules } = fixture(2, 2); state.players[1]!.assetIds = ["asset_whiskey"];
    const bandaged = choose(start(state, rules), rules); if (!bandaged.ok) throw new Error(bandaged.error.message);
    expect(bandaged.state.pendingDecision?.playerId).toBe("guest"); expect(bandaged.state.pendingLocationEncounter?.playerId).toBe("host");
    expect(bandaged.state.players[0]?.sanity).toBe(7);
    const whiskey = choose(bandaged.state, rules, "asset_whiskey"); if (!whiskey.ok) throw new Error(whiskey.error.message);
    expect(whiskey.state.players[0]?.sanity).toBe(7); expect(whiskey.state.players[1]?.sanity).toBe(7);
  });
  it.each(["health", "sanity", "both"])("preserves %s defeat after insufficient Whiskey prevention", cause => {
    const { state, rules } = fixture(cause === "sanity" ? 0 : 5, cause === "health" ? 2 : 9, "host", "asset_whiskey");
    const result = choose(start(state, rules), rules, "asset_whiskey"); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingDefeat?.causes).toEqual(cause === "both" ? ["health", "sanity"] : [cause]);
    expect(result.state.players[0]?.skillImprovements.lore).toBeUndefined(); expect(result.state.assetDiscardIds).toEqual(["asset_whiskey"]);
  });
  it.each(["reserve", "deck", "discard", "holding"])("rejects duplicate Whiskey in %s before any loss", pile => {
    const { state, rules } = fixture(0, 2, "host", "asset_whiskey");
    if (pile === "reserve") state.reserveAssetIds.push("asset_whiskey");
    if (pile === "deck") state.privateState.deckOrderById.assets = ["asset_whiskey"];
    if (pile === "discard") state.assetDiscardIds.push("asset_whiskey");
    if (pile === "holding") state.players[1]!.assetIds.push("asset_whiskey");
    const snapshot = structuredClone(state);
    expect(resolveLocationEncounter(state, "host", "general", rules, context())).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(state).toEqual(snapshot);
  });
  it.each(["skip", "asset_bandages"])("rejects %s when the originally offered card vanishes despite another eligible card", option => {
    const { state, rules } = fixture(2, 2); state.players[0]!.assetIds.push("asset_whiskey");
    const offered = start(state, rules); offered.players[0]!.assetIds = ["asset_whiskey"]; const snapshot = structuredClone(offered);
    expect(choose(offered, rules, option)).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } }); expect(offered).toEqual(snapshot);
  });
  it("guards paid Sanity costs but allows an unrelated Health cost with Whiskey", () => {
    const { state } = fixture(0, 2, "host", "asset_whiskey");
    for (const resource of ["health", "sanity"] as const) {
      const rules: GameContent = { ...content, locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "optional", cost: [{ kind: resource, amount: -1 }], reward: { kind: "effects", effects: [] } } } }] };
      const result = resolveLocationEncounter(state, "host", "general", rules, context());
      if (resource === "sanity") expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
      else { expect(result.ok).toBe(true); if (result.ok) expect(result.state.pendingDecision?.optionIds).toContain("accept"); }
    }
  });
  it("restores an older Bandages checkpoint without the new source-specific decline list", () => {
    const { state, rules } = fixture(); const offered = start(state, rules); const node = offered.pendingLocationEncounter!.queue[0]!;
    if (node.kind !== "damage_reaction") throw new Error("Missing checkpoint"); delete node.declinedAssetIds;
    const result = choose(JSON.parse(JSON.stringify(offered)), rules, "skip"); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.health).toBe(2); expect(result.state.pendingDecision).toBeUndefined();
  });
});
