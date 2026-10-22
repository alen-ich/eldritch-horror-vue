import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveResearchEncounter, type CommandResult, type GameContent, type GameState } from "../src/index.js";

const first = "encounter_research_azathoth_01", second = "encounter_research_azathoth_02";
const empty = { kind: "effects", effects: [] };
const content: GameContent = {
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 1 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  clues: [{ id: "clue_a", locationId: "arkham" }],
  researchEncounters: [{ id: first, deck: "research_azathoth", sections: { city: { kind: "test", skill: "will", modifier: 0, pass: empty, fail: empty } } }],
};
function fixture(): GameState {
  return { stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues: 1, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    boardClues: [{ id: "chosen", locationId: "arkham" }],
    privateState: { deckOrderById: { "encounter:research_azathoth": [first] }, tokenPoolById: { clues: [], clue_discard: [], "board_clue:chosen": ["clue_a"], "held_clues:host": ["clue_a"] } },
  };
}
function accepted(result: CommandResult): GameState { if (!result.ok) throw new Error(result.error.code); return result.state; }

describe("Research recycled deck ownership", () => {
  it.each(["draw", "completion"] as const)("isolates retained shuffle output at %s in both directions", stage => {
    const original = fixture();
    if (stage === "draw") original.researchDiscardIds = [second];
    const originalBefore = structuredClone(original);
    let retained: string[] = [];
    const context = { ...createDeterministicEngineContext({ dice: [1], ids: ["test", "choice"] }),
      shuffle: <T>(items: readonly T[]): T[] => {
        const result = [...items];
        retained = result as string[];
        return result;
      },
    };
    const drawn = accepted(resolveResearchEncounter(original, "host", "chosen", content, context));
    const inputBefore = structuredClone(drawn);
    const next = stage === "draw" ? drawn : accepted(executeCommand(drawn, "host", {
      type: "RESOLVE_DECISION", decisionId: drawn.pendingDecision!.id, selectedOptionIds: [],
    }, content, context));
    const deck = next.privateState.deckOrderById["encounter:research_azathoth"]!;
    const expected = stage === "draw" ? second : first;
    expect(deck).toEqual([expected]);
    expect(deck).not.toBe(retained);
    retained.push("provider-only");
    expect(deck).toEqual([expected]);
    deck.push("engine-only");
    expect(retained).toEqual([expected, "provider-only"]);
    expect(original).toEqual(originalBefore);
    if (stage === "completion") expect(drawn).toEqual(inputBefore);
  });
});
