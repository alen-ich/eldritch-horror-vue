import type { GameState } from "./index.js";

export interface PrivateInvestigatorAbilityUsage {
  schemaVersion: 1;
  normanClueSubstitutions: { playerId: string; investigatorId: "norman_withers"; round: number }[];
}

/** Also usable before the initial roll, when checking applicable test effects. */
export function normanHasSubstitutionAvailable(state: GameState, playerId: string): boolean {
  const player = state.players.find(player => player.id === playerId);
  return !!player && player.investigatorId === "norman_withers" && !player.defeated && !player.eliminated
    && Number.isInteger(player.sanity) && player.sanity! >= 2
    && !state.privateState.investigatorAbilityUsage?.normanClueSubstitutions.some(entry => entry.round === state.turnNumber && entry.investigatorId === "norman_withers");
}

export function canUseNormanSpellReroll(state: GameState, playerId: string): boolean {
  const pending = state.privateState.spellCasting?.pending;
  return normanHasSubstitutionAvailable(state, playerId) && state.activeTest?.playerId === playerId
    && state.activeTest.continuation === "spell_cast" && pending?.casterPlayerId === playerId && pending.stage === "test"
    && /^spell_feed_the_mind_0[12]$/.test(pending.sourcePhysicalId)
    && pending.startedTurnNumber === state.turnNumber;
}

export function spendNormanSpellReroll(state: GameState, playerId: string): boolean {
  const usage = state.privateState.investigatorAbilityUsage;
  if (!usage || validateInvestigatorAbilityUsage(state) || !canUseNormanSpellReroll(state, playerId)) return false;
  state.players.find(player => player.id === playerId)!.sanity! -= 1;
  usage.normanClueSubstitutions.push({ playerId, investigatorId: "norman_withers", round: state.turnNumber });
  return true;
}

export function validateInvestigatorAbilityUsage(state: GameState): string | undefined {
  const usage = state.privateState.investigatorAbilityUsage;
  const version = state.privateState.investigatorAbilityUsageVersion;
  const pending = state.privateState.spellCasting?.pending;
  if (version !== undefined && version !== 1 || usage !== undefined && version !== 1) return "Invalid investigator ability usage version.";
  if (usage === undefined) {
    return version === 1 || pending && state.players.some(player => player.id === pending.casterPlayerId && player.investigatorId === "norman_withers")
      || state.pendingDecision?.optionIds.some(id => id.startsWith("norman-sanity:"))
      ? "Missing investigator ability usage." : undefined;
  }
  if (!usage || typeof usage !== "object" || Array.isArray(usage) || usage.schemaVersion !== 1
    || Object.keys(usage).some(key => !["schemaVersion", "normanClueSubstitutions"].includes(key))
    || !Array.isArray(usage.normanClueSubstitutions)) return "Invalid investigator ability usage.";
  const entries = usage.normanClueSubstitutions;
  if (entries.length > 1 || entries.some(entry => !entry || typeof entry !== "object" || Array.isArray(entry)
    || Object.keys(entry).length !== 3 || Object.keys(entry).some(key => !["playerId", "investigatorId", "round"].includes(key))
    || entry.investigatorId !== "norman_withers" || !state.players.some(player => player.id === entry.playerId)
    || !Number.isInteger(entry.round) || entry.round < 0 || entry.round !== state.turnNumber)) return "Invalid Norman substitution usage.";
  return undefined;
}
