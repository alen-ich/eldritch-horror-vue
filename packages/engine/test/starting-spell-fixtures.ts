import type { GameContent, GameState } from "../src/index.js";
import { spellContent, spellState } from "./spell-fixtures.js";

export function startingContent(): GameContent {
  return { ...spellContent, investigators: { ...spellContent.investigators,
    norman_withers: { ...spellContent.investigators.mark_harrigan!, startingSpellIds: ["spell_feed_the_mind"] },
  } };
}

export function lobby(): GameState {
  const state = spellState(); state.phase = "lobby";
  state.players[0]!.investigatorId = "norman_withers";
  delete state.privateState.spells;
  return state;
}
