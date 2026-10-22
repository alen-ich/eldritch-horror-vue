import { describe, expect, it } from "vitest";
import { baseGameAncientOnes } from "../../content/src/ancient-ones.js";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { baseGameConditions } from "../../content/src/conditions.js";
import { baseGameMonsters } from "../../content/src/monsters.js";
import { baseGameAssets } from "../../content/src/assets.js";
import { namedAmbushStats } from "../src/named-ambush.js";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveResearchEncounter, projectStateForPlayer, type GameContent, type GameState, type CommandResult } from "../src/index.js";

const ancient = baseGameAncientOnes.find(card => card.id === "cthulhu")!;
const profile = { ...ancient.cultist.normalCombat!, toughness: ancient.cultist.normalToughness, effectIds: ancient.cultist.normalEffectIds };
const content: GameContent = {
  researchEncounters: baseGameResearchEncounterRules, conditions: baseGameConditions, monsters: baseGameMonsters, assets: baseGameAssets,
  ancientOnes: { cthulhu: { startingDoom: 12, mythosDeck: ancient.mythosDeck, greenOmenTokens: 0, normalCultistCombat: profile } },
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  map: { adjacentLocationIds: { arkham: ["space_2"], the_amazon: ["space_2"], space_2: ["arkham", "the_amazon"] }, routes: [], locationTypes: { arkham: "city", the_amazon: "wilderness", space_2: "sea" } },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 2, influence: 2, observation: 2, strength: 3, will: 2 } } },
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(card: 1 | 7, clues = 0): GameState {
  const s = createLobby(["host", "guest"]), locationId = card === 1 ? "the_amazon" : "arkham";
  s.phase = "encounter"; s.activePlayerId = s.leadInvestigatorId = "host"; s.ancientOneId = "cthulhu"; s.doom = 12;
  s.players[0] = { ...s.players[0]!, investigatorId: "akachi_onyele", locationId, health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, clues };
  s.boardClues = [{ id: "chosen", locationId }];
  s.monsters = [{ id: "physical", monsterId: "monster_cultist", locationId: "space_2", damage: 0 }];
  s.privateState.deckOrderById["encounter:research_cthulhu"] = [`encounter_research_cthulhu_0${card}`, "encounter_research_cthulhu_02"];
  s.privateState.tokenPoolById = { "board_clue:chosen": ["clue_arkham"], "held_clues:host": clues ? ["clue_london"] : [], monsters: ["monster_cultist"], "set_aside:monster_deep_one": ["monster_deep_one"], clues: [] };
  for (const c of baseGameConditions) (s.privateState.tokenPoolById[`condition:${c.kind}`] ??= []).push(c.id);
  return s;
}
function accepted(r: CommandResult): GameState { if (!r.ok) throw new Error(r.error.code + ": " + r.error.message); return r.state; }
const rng = (die = 6) => createDeterministicEngineContext({ dice: [die, die, die], ids: ["test", "choice", "next"], tokenIndexes: [0] });

describe("normal Cthulhu Cultist Research", () => {
  it.each([1, 7] as const)("runs card %i success/failure with loss before Strength and no physical Monster changes", card => {
    for (const die of [1, 6]) {
      const before = state(card), snapshot = structuredClone(before);
      const after = accepted(resolveResearchEncounter(before, "host", "chosen", content, rng(die)));
      expect(after.players[0]).toMatchObject({ sanity: 6, health: die === 6 ? 5 : 4, clues: die === 6 ? 1 : 0 });
      if (die === 1) expect(after.players[0]!.conditionIds?.[0]).toContain(card === 1 ? "cursed" : "amnesia");
      expect(after.boardClues).toEqual(die === 6 ? [] : [{ id: "chosen", locationId: card === 1 ? "the_amazon" : "space_2" }]);
      expect(after.monsters).toEqual(before.monsters);
      expect(after.privateState.tokenPoolById.monsters).toEqual(before.privateState.tokenPoolById.monsters);
      expect(after.privateState.tokenPoolById["set_aside:monster_deep_one"]).toEqual(["monster_deep_one"]);
      expect(after.researchDiscardIds).toEqual([`encounter_research_cthulhu_0${card}`]);
      expect(after.activePlayerId).toBe("guest"); expect(after.pendingLocationEncounter).toBeUndefined();
      expect(before).toEqual(snapshot);
    }
  });

  it("defeats from Sanity before dice or parent branches", () => {
    const before = state(1); before.players[0]!.sanity = 1;
    const after = accepted(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({})));
    expect(after.pendingDefeat?.causes).toEqual(["sanity"]);
    expect(after.players[0]!.conditionIds ?? []).toEqual([]); expect(after.boardClues).toEqual(before.boardClues);
    expect(after.pendingLocationEncounter).toBeUndefined(); expect(after.doom).toBe(11);
    expect(after.monsters).toEqual(before.monsters);
  });

  it("restores owner-only Strength reroll without repeating loss or exposing private queue", () => {
    const paused = accepted(resolveResearchEncounter(state(1, 1), "host", "chosen", content, rng(1)));
    expect(paused.players[0]!.sanity).toBe(6); expect(paused.activeTest?.skill).toBe("strength");
    expect(paused.activeTest?.dice).toEqual([1, 1, 1]);
    expect(JSON.stringify(projectStateForPlayer(paused, "guest"))).not.toContain("ambush_result");
    expect("optionIds" in projectStateForPlayer(paused, "guest").pendingDecision!).toBe(false);
    const restored = JSON.parse(JSON.stringify(paused)) as GameState;
    const command = { type: "RESOLVE_DECISION" as const, decisionId: restored.pendingDecision!.id, selectedOptionIds: ["die-0"] };
    expect(executeCommand(restored, "guest", command, content, rng())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const after = accepted(executeCommand(restored, "host", command, content, rng()));
    expect(after.players[0]).toMatchObject({ sanity: 6, clues: 1, health: 5 });
    expect(after.activePlayerId).toBe("guest"); expect(after.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
  });

  it("rolls back loss, draw and partial random input on insufficient Strength dice", () => {
    const before = state(1), snapshot = structuredClone(before), context = createDeterministicEngineContext({ dice: [6] });
    expect(resolveResearchEncounter(before, "host", "chosen", content, context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(before).toEqual(snapshot); expect(context.rollDie()).toBe(6);
  });

  it("rejects unsupported awakening before dice and leaves canonical state unchanged", () => {
    const before = state(1), snapshot = structuredClone(before); before.players[0]!.sanity = 1; before.doom = 1;
    const actual = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before).toEqual(actual); expect(snapshot.doom).toBe(12);
  });

  it.each([undefined, { ...profile, beforeStrengthSanityLoss: 2 }, { ...profile, effectIds: [...profile.effectIds, "unknown"] }, { ...profile, horrorCheck: { modifier: 0, damage: 0 } }])("rejects missing/unverified profile before loss", normalCultistCombat => {
    const before = state(1), snapshot = structuredClone(before);
    const bad: GameContent = { ...content, ancientOnes: { cthulhu: { ...content.ancientOnes!.cthulhu!, normalCultistCombat } } };
    expect(resolveResearchEncounter(before, "host", "chosen", bad, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "MONSTER_CONTENT_MISSING" } });
    expect(before).toEqual(snapshot);
  });

  it("keeps possession and colleague prevention guards before ordinary loss", () => {
    const whiskey = baseGameAssets.find(a => a.engineEffects.some(e => e.type === "discard_prevent_sanity_loss"))!;
    for (const owner of [0, 1]) {
      const before = state(1); before.players[owner]!.assetIds = [whiskey.id]; before.players[1]!.locationId = "the_amazon";
      const snapshot = structuredClone(before);
      expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
      expect(before).toEqual(snapshot);
    }
  });

  it("rejects awakened/restored Cultist work before a paid reroll", () => {
    const paused = accepted(resolveResearchEncounter(state(1, 1), "host", "chosen", content, rng(1)));
    paused.awakened = true; const snapshot = structuredClone(paused);
    expect(executeCommand(paused, "host", { type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng())).toMatchObject({ ok: false });
    expect(paused).toEqual(snapshot);
  });

  it("does not reuse the Cthulhu profile for other Ancient Ones or altered Monster text", () => {
    const before = state(1); before.ancientOneId = "azathoth";
    expect(namedAmbushStats(before, content, "monster_cultist")).toBeUndefined();
    before.ancientOneId = "cthulhu";
    const monsters = baseGameMonsters.map(m => m.id === "monster_cultist" ? { ...m, specialEffect: "unsupported" } : m);
    expect(resolveResearchEncounter(before, "host", "chosen", { ...content, monsters }, rng())).toMatchObject({ ok: false, error: { code: "MONSTER_CONTENT_MISSING" } });
    before.players[0]!.artifactIds = ["artifact_ttka_halot"];
    expect(resolveResearchEncounter(before, "host", "chosen", content, rng())).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
  });

  it("preserves the existing surviving-investigator toughness calculation for named printed Monsters", () => {
    const before = state(1); before.players[1]!.defeated = true;
    const monsters = baseGameMonsters.map(m => m.id === "monster_deep_one" ? { ...m, toughness: { base: 1, perInvestigator: 1 } } : m);
    expect(namedAmbushStats(before, { ...content, monsters }, "monster_deep_one")?.toughness).toBe(2);
  });

  it("preserves the physical Clue and prior Sanity loss when reroll RNG is missing", () => {
    const paused = accepted(resolveResearchEncounter(state(1, 1), "host", "chosen", content, rng(1))), snapshot = structuredClone(paused);
    const context = createDeterministicEngineContext({});
    const result = executeCommand(paused, "host", { type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, context);
    expect(result).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(paused).toEqual(snapshot);
  });
});
