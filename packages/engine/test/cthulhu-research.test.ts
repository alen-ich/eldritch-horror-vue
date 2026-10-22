import { describe, expect, it } from "vitest";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { baseGameConditions } from "../../content/src/conditions.js";
import { baseGameMonsters } from "../../content/src/monsters.js";
import { bindResearchInstruction } from "../src/research-instructions.js";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveResearchEncounter, projectStateForPlayer, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  researchEncounters: baseGameResearchEncounterRules, conditions: baseGameConditions, monsters: baseGameMonsters,
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  map: { adjacentLocationIds: { arkham: ["space_2", "the_amazon"], the_amazon: ["arkham", "space_2"], space_2: ["arkham", "the_amazon"] }, routes: [], locationTypes: { arkham: "city", the_amazon: "wilderness", space_2: "sea", space_3: "sea" } },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 2, influence: 2, observation: 2, strength: 3, will: 2 } } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(number: number, section = "city"): GameState {
  const before = createLobby(["host", "guest"]);
  const locationId = section === "city" ? "arkham" : section === "wilderness" ? "the_amazon" : "space_2";
  before.phase = "encounter"; before.activePlayerId = before.leadInvestigatorId = "host"; before.ancientOneId = "cthulhu"; before.doom = 12;
  before.players[0] = { ...before.players[0]!, investigatorId: "akachi_onyele", locationId, health: 5, sanity: 7, maxHealth: 5, maxSanity: 7 };
  before.boardClues = [{ id: "chosen", locationId }, { id: "other", locationId }];
  before.privateState.deckOrderById["encounter:research_cthulhu"] = [`encounter_research_cthulhu_0${number}`, number === 1 ? "encounter_research_cthulhu_02" : "encounter_research_cthulhu_01"];
  before.privateState.tokenPoolById = { "board_clue:chosen": ["clue_arkham"], "board_clue:other": ["clue_london"], "held_clues:host": [], clues: ["clue_london"] };
  for (const condition of baseGameConditions) (before.privateState.tokenPoolById[`condition:${condition.kind}`] ??= []).push(condition.id);
  return before;
}
const rng = (die = 6) => createDeterministicEngineContext({ dice: Array(12).fill(die), tokenIndexes: [0, 0], ids: ["test", "choice", "next"] });
describe("Cthulhu scan-backed Research", () => {
  const supported = baseGameResearchEncounterRules.filter(card => card.deck === "research_cthulhu").flatMap(card => Object.entries(card.sections).filter(([, instruction]) => bindResearchInstruction(instruction, "chosen")).map(([section]) => ({ number: card.number, section })));
  it("binds exactly 20 sections without dropping unsupported Spell or Artifact effects", () => {
    expect(supported).toHaveLength(20);
    for (const card of baseGameResearchEncounterRules.filter(card => card.deck === "research_cthulhu")) {
      for (const [section, instruction] of Object.entries(card.sections)) {
        if (bindResearchInstruction(instruction, "chosen")) continue;
        const before = state(card.number, section); const snapshot = structuredClone(before);
        expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
        expect(before).toEqual(snapshot);
      }
    }
  });
  it.each(supported.filter(({ number, section }) => !(number === 1 && section === "wilderness" || number === 7 && section === "city")))("runs both branches of card $number $section and discards once", ({ number, section }) => {
    for (const die of [1, 6]) {
      const before = state(number, section); const snapshot = structuredClone(before);
      const result = resolveResearchEncounter(before, "host", "chosen", content, rng(die));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingDecision).toBeUndefined();
      const extra = number === 2 || number === 3 && section === "city" || number === 5 && section === "city" || number === 7;
      expect(result.state.players[0]?.clues).toBe(die === 6 ? extra ? 2 : 1 : 0);
      if (die === 6) expect(result.state.boardClues?.map(clue => clue.id)).toEqual(["other"]);
      expect(result.state.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual([number === 1 ? "encounter_research_cthulhu_02" : "encounter_research_cthulhu_01"]);
      expect(result.state.researchDiscardIds).toEqual([`encounter_research_cthulhu_0${number}`]);
      expect(before).toEqual(snapshot);
    }
  });
  it("moves only this Clue to the unique nearest Sea with physical identity preserved", () => {
    const result = resolveResearchEncounter(state(1), "host", "chosen", content, rng(1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.boardClues).toEqual([{ id: "chosen", locationId: "space_2" }, { id: "other", locationId: "arkham" }]);
    expect(result.state.privateState.tokenPoolById["board_clue:chosen"]).toEqual(["clue_arkham"]);
  });
  it("offers only equally nearest Seas, restores the choice and enforces ownership", () => {
    const tied: GameContent = { ...content, map: { ...content.map, adjacentLocationIds: { arkham: ["space_2", "space_3"] } } };
    const offered = resolveResearchEncounter(state(1), "host", "chosen", tied, rng(1));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision?.optionIds).toEqual(["space_2", "space_3"]);
    expect("optionIds" in projectStateForPlayer(offered.state, "guest").pendingDecision!).toBe(false);
    const paused: GameState = JSON.parse(JSON.stringify(offered.state));
    const command = { type: "RESOLVE_DECISION" as const, decisionId: paused.pendingDecision!.id, selectedOptionIds: ["space_3"] };
    expect(executeCommand(paused, "guest", command, tied, rng()).ok).toBe(false);
    const result = executeCommand(paused, "host", command, tied, rng());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.boardClues?.[0]?.locationId).toBe("space_3"); expect(result.state.activePlayerId).toBe("guest");
  });
  it("retreats Doom on success only, caps the track, and retains the failed Clue", () => {
    for (const doom of [12, 20]) {
      const before = state(6, "sea"); before.doom = doom;
      const result = resolveResearchEncounter(before, "host", "chosen", content, rng());
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.doom).toBe(Math.min(20, doom + 1)); expect(result.state.players[0]?.clues).toBe(1);
    }
    const result = resolveResearchEncounter(state(6, "sea"), "host", "chosen", content, rng(1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.doom).toBe(12); expect(result.state.boardClues).toHaveLength(2);
    expect(result.state.players[0]?.conditionIds?.[0]).toContain("hallucinations");
  });
  it("references named ambush attributes without drawing, spawning, damaging or returning tokens", () => {
    const before = state(7, "sea");
    before.monsters = [{ id: "existing", monsterId: "monster_deep_one", locationId: "arkham", damage: 1, setAside: true }];
    before.privateState.tokenPoolById.monsters = ["monster_deep_one", "monster_ghoul"];
    before.privateState.tokenPoolById["set_aside:monster_deep_one"] = ["monster_deep_one"];
    const snapshot = structuredClone(before);
    const result = resolveResearchEncounter(before, "host", "chosen", content, rng());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.monsters).toEqual(before.monsters);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual(before.privateState.tokenPoolById.monsters);
    expect(result.state.privateState.tokenPoolById["set_aside:monster_deep_one"]).toEqual(["monster_deep_one"]);
    expect(result.state.players[0]?.clues).toBe(2);
    expect(result.state.activePlayerId).toBe("guest");
    expect(result.events).toContainEqual({ type: "NAMED_MONSTER_AMBUSH_RESOLVED", playerId: "host", monsterId: "monster_deep_one", successes: 2, healthLost: 0, defeated: true });
    expect(result.events.some(event => event.type === "MONSTER_SPAWNED" || event.type === "MONSTER_DEFEATED")).toBe(false);
    expect(before).toEqual(snapshot);
  });
  it("retreats Doom only after defeating Star Spawn on the failed Research branch", () => {
    // A synthetic high-Strength investigator isolates toughness 5 from pending possession bonuses.
    const strong: GameContent = { ...content, investigators: { akachi_onyele: { ...content.investigators.akachi_onyele!, skills: { ...content.investigators.akachi_onyele!.skills, strength: 8 } } } };
    for (const doom of [12, 20]) {
      const before = state(5, "sea"); before.doom = doom;
      before.monsters = [{ id: "remote-star", monsterId: "monster_star_spawn", locationId: "arkham", damage: 4, setAside: true }];
      before.privateState.tokenPoolById.monsters = ["monster_ghoul"];
      before.privateState.tokenPoolById["set_aside:monster_star_spawn"] = [];
      const snapshot = structuredClone(before);
      const result = resolveResearchEncounter(before, "host", "chosen", strong, createDeterministicEngineContext({ dice: [1, 1, 6, 6, 6, 6, 6, 6] }));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.doom).toBe(Math.min(20, doom + 1));
      expect(result.state.players[0]).toMatchObject({ health: 5, sanity: 5, clues: 0 });
      expect(result.state.boardClues).toEqual(before.boardClues);
      expect(result.state.monsters).toEqual(before.monsters);
      expect(result.state.privateState.tokenPoolById).toEqual(before.privateState.tokenPoolById);
      expect(result.events).toContainEqual({ type: "NAMED_MONSTER_AMBUSH_RESOLVED", playerId: "host", monsterId: "monster_star_spawn", successes: 5, healthLost: 0, defeated: true });
      expect(result.events.some(event => event.type === "MONSTER_SPAWNED" || event.type === "MONSTER_DEFEATED")).toBe(false);
      expect(result.state.activePlayerId).toBe("guest");
      expect(result.state.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual(["encounter_research_cthulhu_01"]);
    expect(result.state.researchDiscardIds).toEqual(["encounter_research_cthulhu_05"]);
      expect(before).toEqual(snapshot);
    }
  });
  it("uses Star Spawn's printed modifiers and damage without triggering its Reckoning", () => {
    const result = resolveResearchEncounter(state(5, "sea"), "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1, 1, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]).toMatchObject({ health: 2, sanity: 4, clues: 0 });
    expect(result.state.doom).toBe(12); expect(result.state.boardClues).toHaveLength(2);
    expect(result.events.find(event => event.type === "NAMED_MONSTER_AMBUSH_RESOLVED")).toMatchObject({ monsterId: "monster_star_spawn", successes: 0, healthLost: 3, defeated: false });
  });
  it("restores the nested Star Spawn checkpoint with owner-only physical Clue rerolls", () => {
    const before = state(5, "sea"); before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_london"];
    const offered = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1], ids: ["research", "research-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const horror = executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "research-choice", selectedOptionIds: [] }, content, createDeterministicEngineContext({ dice: [1], ids: ["horror", "horror-choice"] }));
    if (!horror.ok) throw new Error(horror.error.message);
    expect(horror.state.activeTest?.skill).toBe("will"); expect(horror.state.activeTest?.dice).toEqual([1]);
    const restored: GameState = JSON.parse(JSON.stringify(horror.state));
    const command = { type: "RESOLVE_DECISION" as const, decisionId: "horror-choice", selectedOptionIds: ["die-0"] };
    expect(executeCommand(restored, "guest", command, content, rng()).ok).toBe(false);
    const result = executeCommand(restored, "host", command, content, createDeterministicEngineContext({ dice: [6, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]).toMatchObject({ health: 2, sanity: 5, clues: 0 });
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
  });
  it("interrupts Star Spawn combat on Horror or Health defeat without Doom retreat", () => {
    for (const cause of ["sanity", "health"] as const) {
      const before = state(5, "sea"); before.players[0]![cause] = 1;
      const result = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: cause === "sanity" ? [1, 1, 1] : [1, 1, 6, 1] }));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.pendingDefeat?.causes).toEqual([cause]);
      expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.doom).toBe(11);
      expect(result.events.some(event => event.type === "DOOM_RETREATED")).toBe(false);
      expect(result.state.boardClues).toEqual(before.boardClues);
      expect(result.state.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual(["encounter_research_cthulhu_01"]);
    expect(result.state.researchDiscardIds).toEqual(["encounter_research_cthulhu_05"]);
    }
  });
  it("preflights Star Spawn statistics and possession bonuses before even successful Research", () => {
    const before = state(5, "sea"); const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", { ...content, monsters: baseGameMonsters.filter(monster => monster.id !== "monster_star_spawn") }, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "MONSTER_CONTENT_MISSING" } });
    expect(before).toEqual(snapshot);
    before.players[0]!.artifactIds = ["artifact_ttka_halot"];
    expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
  });
  it("resolves a surviving Deep One's printed failure outcome instead of placing it", () => {
    const before = state(7, "sea");
    const result = resolveResearchEncounter(before, "host", "chosen", content, rng(1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]).toMatchObject({ health: 4, sanity: 5, clues: 0 });
    expect(result.state.players[0]?.conditionIds?.[0]).toContain("leg_injury");
    expect(result.state.monsters ?? []).toEqual([]); expect(result.state.boardClues).toEqual(before.boardClues);
  });
  it("pauses Will and Strength independently for owner-only Clue rerolls and survives serialization", () => {
    const before = state(7, "sea"); before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_london"];
    const offered = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1], ids: ["horror", "horror-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.activeTest?.skill).toBe("will");
    const strength = executeCommand(JSON.parse(JSON.stringify(offered.state)), "host", { type: "RESOLVE_DECISION", decisionId: "horror-choice", selectedOptionIds: [] }, content, createDeterministicEngineContext({ dice: [6, 1], ids: ["strength", "strength-choice"] }));
    if (!strength.ok) throw new Error(strength.error.message);
    expect(strength.state.players[0]?.sanity).toBe(5);
    expect(strength.state.activeTest?.skill).toBe("strength");
    expect(strength.state.players[0]?.clues).toBe(1);
    expect(executeCommand(strength.state, "guest", { type: "RESOLVE_DECISION", decisionId: "strength-choice", selectedOptionIds: ["die-1"] }, content, rng()).ok).toBe(false);
    const result = executeCommand(JSON.parse(JSON.stringify(strength.state)), "host", { type: "RESOLVE_DECISION", decisionId: "strength-choice", selectedOptionIds: ["die-1"] }, content, createDeterministicEngineContext({ dice: [6], tokenIndexes: [0] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.clues).toBe(2);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_london"]);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
  });
  it("stops at Horror defeat before Strength, rewards or failure Conditions", () => {
    const before = state(7, "sea"); before.players[0]!.sanity = 1;
    const result = resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingDefeat?.causes).toEqual(["sanity"]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.currentLocationEncounterCardId).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual(["encounter_research_cthulhu_01"]);
    expect(result.state.researchDiscardIds).toEqual(["encounter_research_cthulhu_07"]);
    expect(result.events.some(event => event.type === "NAMED_MONSTER_AMBUSH_RESOLVED")).toBe(false);
  });
  it("stops at Health defeat before the printed non-defeat effect", () => {
    const before = state(7, "sea"); before.players[0]!.health = 1;
    const result = resolveResearchEncounter(before, "host", "chosen", content, rng(1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingDefeat?.causes).toEqual(["health"]);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("applies Blessed/Cursed thresholds to ambush tests and rejects missing statistics before rolling", () => {
    for (const [kind, die, defeated] of [["blessed", 4, true], ["cursed", 5, false]] as const) {
      const before = state(7, "sea"); before.players[0]!.conditionIds = [`condition_${kind}_01`];
      const result = resolveResearchEncounter(before, "host", "chosen", content, rng(die));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.events.find(event => event.type === "NAMED_MONSTER_AMBUSH_RESOLVED")).toMatchObject({ defeated });
    }
    const before = state(4); const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", { ...content, monsters: [] }, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "MONSTER_CONTENT_MISSING" } });
    expect(before).toEqual(snapshot);
  });
});
