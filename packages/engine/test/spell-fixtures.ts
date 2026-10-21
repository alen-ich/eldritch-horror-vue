import { baseGameSpells } from "../../content/src/spells.js";
import { createLobby, createSpellInventory, type GameContent, type EngineContext, type GameState } from "../src/index.js";
export const spellContext: EngineContext = { shuffle: items => [...items], rollDie: () => 6, createId: () => "id", drawToken: pool => ({ token: pool[0]!, remaining: pool.slice(1) }) };
const setup = { startingLocationId: "arkham", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 };
export const spellContent: GameContent = {
  spells: baseGameSpells, map: { adjacentLocationIds: { arkham: ["london"], london: ["arkham"] }, routes: [{ source: "arkham", target: "london", type: "train" }], locationTypes: { arkham: "city", london: "city" } },
  investigators: { trish_scarborough: setup, mark_harrigan: setup, lily_chen: setup },
  assets: ["a", "b", "c", "d"].map(id => ({ id, value: 1, engineEffects: [] })),
  mysteryIdsByAncientOne: { azathoth: ["one", "two", "three", "four"] }, mysteryTargetsById: { one: "one", two: "one", three: "one", four: "one" },
};
export function spellState(): GameState {
  const state = createLobby(["host", "guest"]); state.phase = "action"; state.ancientOneId = "azathoth"; state.doom = 10;
  state.activePlayerId = state.leadInvestigatorId = "host"; state.actionsRemaining = 2;
  state.players[0] = { ...state.players[0]!, investigatorId: "trish_scarborough", locationId: "arkham", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7 };
  state.players[1] = { ...state.players[1]!, investigatorId: "mark_harrigan", locationId: "london", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7 };
  state.privateState.spells = createSpellInventory(baseGameSpells, ["host", "guest"], spellContext);
  return state;
}
export function holdSpell(state: GameState, id: string, owner = "host"): void {
  state.privateState.spells!.deck = state.privateState.spells!.deck.filter(card => card !== id);
  (state.privateState.spells!.heldByPlayer[owner] ??= []).push(id);
}
