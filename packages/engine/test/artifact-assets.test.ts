import { describe, expect, it } from "vitest";
import { baseGameArtifacts } from "../../content/src/artifacts.js";
import { baseGameAssets } from "../../content/src/assets.js";
import { createLobby, createDeterministicEngineContext, executeCommand, projectPublicState, type GameState, type GameContent, type CommandResult } from "../src/index.js";

const tomes = ["artifact_ttka_halot", "artifact_cultes_des_goules", "artifact_de_vermis_mysteriis"] as const;
const foot = "asset_lucky_rabbits_foot", cigarette = "asset_lucky_cigarette_case", guide = "asset_urban_guide";
const content: GameContent = {
  artifacts: baseGameArtifacts, assets: baseGameAssets,
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 1 } } },
  map: { locationTypes: { arkham: "city", london: "city", sea: "sea" }, adjacentLocationIds: {}, routes: [] },
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  monsters: [{ id: "monster", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 4, perInvestigator: 0 } }],
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(tome: typeof tomes[number] = tomes[1], assets: string[] = []): GameState {
  const state = createLobby(["host", "guest"]); state.phase = "action";
  state.activePlayerId = state.leadInvestigatorId = "host"; state.actionsRemaining = 2;
  Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", health: 5, sanity: 7, locationId: "arkham", artifactIds: [tome], assetIds: assets });
  Object.assign(state.players[1]!, { investigatorId: "akachi_onyele", health: 5, sanity: 7, locationId: "arkham" });
  state.privateState.deckOrderById.artifacts = baseGameArtifacts.filter(card => card.id !== tome).map(card => card.id);
  state.privateState.tokenPoolById = { clues: ["clue_arkham", "clue_london"], "held_clues:host": [], "held_clues:guest": [] };
  state.monsters = [{ id: "target", monsterId: "monster", locationId: "arkham", damage: 0 }];
  return state;
}
function context(dice = [6, 6, 6, 6]) { return createDeterministicEngineContext({ dice, ids: ["test", "choice", "payment", "next"], tokenIndexes: [0, 0] }); }
function unwrap(result: CommandResult) { if (!result.ok) throw new Error(result.error.message); return result.state; }
function roll(state = fixture(), dice?: number[]) { return executeCommand(state, "host", { type: "USE_ARTIFACT_ACTION", artifactId: state.players[0]!.artifactIds![0] as typeof tomes[number] }, content, context(dice)); }
function begin(state = fixture(), dice?: number[]) { return unwrap(roll(state, dice)); }
function resolve(state: GameState, choice: string[] = [], dice?: number[], owner = "host") { return executeCommand(state, owner, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: choice }, content, context(dice)); }
function pay(state: GameState, tome: typeof tomes[number]) { return resolve(state, [tome === tomes[0] ? "target" : tome === tomes[1] ? "cultes:accept" : "vermis:will:1"]); }
function rolledDice(result: CommandResult) { if (!result.ok) throw new Error(result.error.message); return result.events.find(event => event.type === "TEST_ROLLED"); }

describe("verified Assets in Artifact Lore actions", () => {
  it.each(baseGameAssets.filter(card => card.nonCombatEncounterSupport !== "unsupported").map(card => card.id))("allows explicitly scoped %s, without unrelated skill/Spell/combat bonuses", id => {
    const result = roll(fixture(tomes[1], [id]));
    expect(result.ok).toBe(true);
    expect(rolledDice(result)).toMatchObject({ skill: "lore", dice: Array(id === guide ? 2 : 1).fill(6) });
  });
  it.each(tomes)("uses the Foot, modifier and City's colleague aura for %s", tome => {
    const state = fixture(tome, [foot, cigarette]); state.players[1]!.assetIds = [guide];
    const pending = begin(state, [4, 1]);
    expect(pending.activeTest?.dice).toEqual([4, 1]);
    expect(pending.pendingDecision?.optionLabels?.[`asset-increment:${cigarette}:0`]).toContain("4 → 5");
    const modified = unwrap(resolve(pending, [`asset-increment:${cigarette}:0`], []));
    expect(modified.activeTest?.successes).toBe(1);
    expect(modified.usedAssetDieModifierIds).toEqual([cigarette]);
    expect(modified.pendingDecision?.optionIds.some(id => id.startsWith("asset-increment:"))).toBe(false);
    const rerolled = unwrap(resolve(JSON.parse(JSON.stringify(modified)), [`asset-reroll:${foot}:1`], [6]));
    expect(rerolled.usedAssetRerollIds).toEqual([foot]); expect(rerolled.players[0]?.clues).toBe(0);
    const after = unwrap(pay(rerolled, tome));
    expect(after.players[0]?.sanity).toBe(6); expect(after.actionsRemaining).toBe(1);
    expect(after.players[0]?.assetIds).toEqual([foot, cigarette]); expect(after.players[1]?.assetIds).toEqual([guide]);
    expect(after.stateVersion).toBe(rerolled.stateVersion + 1);
  });
  it.each(["remote", "defeated", "eliminated", "sea"])("does not apply an excluded %s Urban Guide", variant => {
    const state = fixture(); state.players[1]!.assetIds = [guide];
    if (variant === "remote") state.players[1]!.locationId = "london";
    if (variant === "defeated") state.players[1]!.defeated = true;
    if (variant === "eliminated") state.players[1]!.eliminated = true;
    if (variant === "sea") state.players.forEach(player => player.locationId = "sea");
    expect(rolledDice(roll(state))).toMatchObject({ dice: [6] });
  });
  it("combines improvement and local aura, but never a colleague's free reroll", () => {
    const state = fixture(); state.players[0]!.skillImprovements.lore = 1;
    state.players[1]!.assetIds = [guide, foot, cigarette];
    const result = roll(state); expect(rolledDice(result)).toMatchObject({ dice: [6, 6, 6] });
    expect(unwrap(result).pendingDecision?.kind).toBe("artifact_payment");
  });
  it.each(tomes)("does not prevent %s's paid Sanity with held or local Whiskey", tome => {
    const state = fixture(tome, ["asset_whiskey", "asset_bandages", "asset_king_james_bible"]);
    const after = unwrap(pay(begin(state), tome));
    expect(after.players[0]?.sanity).toBe(6); expect(after.assetDiscardIds).toEqual([]);
    expect(after.players[0]?.assetIds).toEqual(state.players[0]?.assetIds);
    const local = fixture(tome); local.players[1]!.assetIds = ["asset_whiskey"];
    expect(unwrap(pay(begin(local), tome)).players[0]?.sanity).toBe(6);
  });
  it("keeps physical Clue and free rerolls independent and replaces a modified result", () => {
    const state = fixture(tomes[1], [foot, cigarette]); state.players[0]!.clues = 1;
    state.privateState.tokenPoolById["held_clues:host"] = [state.privateState.tokenPoolById.clues!.shift()!];
    const modified = unwrap(resolve(begin(state, [4]), [`asset-increment:${cigarette}:0`], []));
    const clue = unwrap(resolve(modified, ["die-0"], [1])); expect(clue.activeTest?.dice).toEqual([1]);
    expect(clue.players[0]?.clues).toBe(0); expect(clue.usedAssetRerollIds ?? []).toEqual([]);
    const free = unwrap(resolve(clue, [`asset-reroll:${foot}:0`], [6]));
    expect(free.pendingDecision?.kind).toBe("artifact_payment"); expect(free.usedAssetDieModifierIds).toEqual([cigarette]);
    expect(JSON.stringify(projectPublicState(free))).not.toContain("clue_arkham");
    expect(unwrap(pay(free, tomes[1])).players[0]?.clues).toBe(2);
  });
  it("preserves declined and consumed round sources across another Tome action", () => {
    const state = fixture(tomes[2], [foot, cigarette]);
    const declined = unwrap(resolve(begin(state, [6])));
    const after = unwrap(resolve(declined, ["vermis:skip"]));
    expect(after.usedAssetRerollIds ?? []).toEqual([]); expect(after.usedAssetDieModifierIds ?? []).toEqual([]);
    after.players[0]!.artifactIds!.unshift(tomes[1]);
    after.privateState.deckOrderById.artifacts = after.privateState.deckOrderById.artifacts!.filter(id => id !== tomes[1]);
    const pending = begin(after, [4]);
    expect(pending.pendingDecision?.optionIds).toContain(`asset-reroll:${foot}:0`);
    const modified = unwrap(resolve(pending, [`asset-increment:${cigarette}:0`], []));
    const passed = unwrap(resolve(modified, [`asset-reroll:${foot}:0`], [6]));
    const completed = unwrap(resolve(passed, ["cultes:skip"]));
    completed.phase = "mythos"; completed.replacementWindow = true;
    const fresh = unwrap(executeCommand(completed, "host", { type: "BEGIN_NEXT_ROUND" }, content));
    expect(fresh.usedAssetRerollIds).toEqual([]); expect(fresh.usedAssetDieModifierIds).toEqual([]);
  });
  it.each(["deck", "discard", "reserve", "colleague", "defeated-sheet"])("rejects a duplicated held Asset in %s before dice and at resumed/payment checkpoints", pile => {
    function duplicate(state: GameState) {
      if (pile === "deck") state.privateState.deckOrderById.assets = [foot];
      if (pile === "discard") state.assetDiscardIds = [foot];
      if (pile === "reserve") state.reserveAssetIds = [foot];
      if (pile === "colleague") state.players[1]!.assetIds = [foot];
      if (pile === "defeated-sheet") state.defeatedInvestigators = [{ investigatorId: "trish_scarborough", locationId: "arkham", cause: "health", assetIds: [foot], clues: 0, travelTickets: [] }];
    }
    const state = fixture(tomes[1], [foot]); duplicate(state); const snapshot = structuredClone(state);
    expect(roll(state, []).ok).toBe(false); expect(state).toEqual(snapshot);
    const pending = begin(fixture(tomes[1], [foot]), [4]); duplicate(pending);
    expect(resolve(pending, [`asset-reroll:${foot}:0`], []).ok).toBe(false);
    const payment = unwrap(resolve(begin(fixture(tomes[1], [foot]), [6]))); duplicate(payment);
    expect(pay(payment, tomes[1]).ok).toBe(false);
  });
  it("guards duplicate local aura and unsupported possessions before rolling or payment", () => {
    const state = fixture(); state.players[1]!.assetIds = [guide]; state.reserveAssetIds = [guide];
    expect(roll(state, []).ok).toBe(false);
    for (const id of ["unknown", "asset_dynamite"]) {
      const bad = fixture(tomes[1], [id]); expect(roll(bad, []).ok).toBe(false);
      const pending = begin(); pending.players[0]!.assetIds = [id]; expect(pay(pending, tomes[1]).ok).toBe(false);
    }
  });
  it("rejects a lost selected source and another owner without consuming a private choice", () => {
    const pending = begin(fixture(tomes[0], [foot, cigarette]), [4]);
    expect(resolve(pending, [`asset-reroll:${foot}:0`], [], "guest").ok).toBe(false);
    pending.players[0]!.assetIds = [cigarette]; const snapshot = structuredClone(pending);
    expect(resolve(pending, [`asset-reroll:${foot}:0`], []).ok).toBe(false); expect(pending).toEqual(snapshot);
    pending.players[0]!.artifactIds = [];
    expect(resolve(pending, []).ok).toBe(false);
  });
});
