import { describe, expect, it } from "vitest";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { baseGameConditions } from "../../content/src/conditions.js";
import { bindResearchInstruction } from "../src/research-instructions.js";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveResearchEncounter, projectStateForPlayer, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  researchEncounters: baseGameResearchEncounterRules, conditions: baseGameConditions,
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  map: { adjacentLocationIds: { arkham: ["space_2", "the_amazon"], the_amazon: ["arkham", "space_2"], space_2: ["arkham", "the_amazon"] }, routes: [], locationTypes: { arkham: "city", the_amazon: "wilderness", space_2: "sea", space_3: "sea" } },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 2, influence: 2, observation: 2, strength: 2, will: 2 } } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(number: number, section = "city"): GameState {
  const before = createLobby(["host", "guest"]);
  const locationId = section === "city" ? "arkham" : section === "wilderness" ? "the_amazon" : "space_2";
  before.phase = "encounter"; before.activePlayerId = before.leadInvestigatorId = "host"; before.ancientOneId = "cthulhu"; before.doom = 12;
  before.players[0] = { ...before.players[0]!, investigatorId: "akachi_onyele", locationId, health: 5, sanity: 7, maxHealth: 5, maxSanity: 7 };
  before.boardClues = [{ id: "chosen", locationId }, { id: "other", locationId }];
  before.privateState.deckOrderById["encounter:research_cthulhu"] = [`encounter_research_cthulhu_0${number}`, "encounter_research_cthulhu_01"];
  before.privateState.tokenPoolById = { "board_clue:chosen": ["clue_arkham"], "board_clue:other": ["clue_london"], "held_clues:host": [], clues: ["clue_london"] };
  for (const condition of baseGameConditions) (before.privateState.tokenPoolById[`condition:${condition.kind}`] ??= []).push(condition.id);
  return before;
}
const rng = (die = 6) => createDeterministicEngineContext({ dice: Array(12).fill(die), tokenIndexes: [0, 0], ids: ["test", "choice", "next"] });
describe("Cthulhu scan-backed Research", () => {
  const supported = baseGameResearchEncounterRules.filter(card => card.deck === "research_cthulhu").flatMap(card => Object.entries(card.sections).filter(([, instruction]) => bindResearchInstruction(instruction, "chosen")).map(([section]) => ({ number: card.number, section })));
  it("supports exactly 15 sections without dropping ambush, Spell or Artifact effects", () => {
    expect(supported).toHaveLength(15);
    for (const card of baseGameResearchEncounterRules.filter(card => card.deck === "research_cthulhu")) {
      for (const [section, instruction] of Object.entries(card.sections)) {
        if (bindResearchInstruction(instruction, "chosen")) continue;
        const before = state(card.number, section); const snapshot = structuredClone(before);
        expect(resolveResearchEncounter(before, "host", "chosen", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
        expect(before).toEqual(snapshot);
      }
    }
  });
  it.each(supported)("runs both branches of card $number $section and cycles once", ({ number, section }) => {
    for (const die of [1, 6]) {
      const before = state(number, section); const snapshot = structuredClone(before);
      const result = resolveResearchEncounter(before, "host", "chosen", content, rng(die));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingDecision).toBeUndefined();
      const extra = number === 2 || number === 3 && section === "city" || number === 5 && section === "city" || number === 7 && section === "wilderness";
      expect(result.state.players[0]?.clues).toBe(die === 6 ? extra ? 2 : 1 : 0);
      if (die === 6) expect(result.state.boardClues?.map(clue => clue.id)).toEqual(["other"]);
      expect(result.state.privateState.deckOrderById["encounter:research_cthulhu"]).toEqual(["encounter_research_cthulhu_01", `encounter_research_cthulhu_0${number}`]);
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
});
