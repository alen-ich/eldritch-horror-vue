import type { GameState } from "../src/index.js";
import { castingContent, castingState } from "./spell-casting-fixtures.js";
export const normanContent = { ...castingContent, investigators: { ...castingContent.investigators, norman_withers: castingContent.investigators.mark_harrigan! } };
export function normanState(copy="spell_feed_the_mind_01"): GameState {
  const state = castingState(copy); state.players[0]!.investigatorId = "norman_withers";
  state.privateState.investigatorAbilityUsageVersion = 1;
  state.privateState.investigatorAbilityUsage = { schemaVersion: 1, normanClueSubstitutions: [] };
  return state;
}
