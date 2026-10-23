import { countActiveTestSuccesses, testRerollDecisionIsValid, type CommandResult, type EngineContext, type GameContent, type GameState } from "./index.js";
import { conditionSuccessThreshold } from "./conditions.js";

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
  if (!canUseNormanSpellReroll(state, playerId)) return false;
  return spendNormanClueSubstitution(state, playerId);
}

/** Explicit allowlist: new test contexts need their own applicability audit. */
export function canUseNormanTestReroll(state: GameState, playerId: string): boolean {
  if (canUseNormanSpellReroll(state, playerId)) return true;
  return normanHasSubstitutionAvailable(state, playerId) && state.phase === "action"
    && state.activePlayerId === playerId && state.activeTest?.playerId === playerId
    && state.activeTest.continuation === "acquire_assets" && state.activeTest.skill === "influence";
}

export function spendNormanTestReroll(state: GameState, playerId: string): boolean {
  return canUseNormanTestReroll(state, playerId) && spendNormanClueSubstitution(state, playerId);
}

export function normanAcquireInteractionUnsupported(state: GameState, playerId: string): boolean {
  const player = state.players.find(candidate => candidate.id === playerId);
  return normanHasSubstitutionAvailable(state, playerId) && !!player?.locationId
    && state.players.some(holder => !holder.defeated && !holder.eliminated
      && holder.locationId === player.locationId && holder.investigatorId === "trish_scarborough");
}

/** Marked snapshots must carry exactly the choices regenerated from canonical sources. */
export function validateNormanAcquireRerollState(state: GameState, content: GameContent): string | undefined {
  if (state.privateState.spellCasting?.pending) return undefined; // Spell validator owns this continuation.
  const test = state.activeTest;
  const player = state.players.find(candidate => candidate.id === test?.playerId);
  const hasPaymentOption = state.pendingDecision?.optionIds.some(id => id.startsWith("norman-sanity:"));
  const markedAcquisition = state.privateState.investigatorAbilityUsageVersion === 1
    && test?.continuation === "acquire_assets" && player?.investigatorId === "norman_withers";
  if (!markedAcquisition && !hasPaymentOption) return undefined; // Genuine legacy decision.
  if (!test || !player || player.investigatorId !== "norman_withers" || player.defeated || player.eliminated
    || state.phase !== "action" || state.activePlayerId !== player.id || test.continuation !== "acquire_assets"
    || test.skill !== "influence" || test.modifier !== 0 || !Array.isArray(test.dice) || !test.dice.length
    || test.dice.length !== test.dicePool || test.dice.some(die => !Number.isInteger(die) || die < 1 || die > 6)
    || test.successThreshold !== conditionSuccessThreshold(player.conditionIds ?? [])
    || test.successes !== countActiveTestSuccesses(test, player, content)
    || validateInvestigatorAbilityUsage(state) || state.privateState.investigatorAbilityUsageVersion !== 1
    || state.pendingDecision?.continuation !== "test_reroll" || state.pendingDecision.kind !== "select_rerolls" || state.pendingDecision.playerId !== player.id
    || normanAcquireInteractionUnsupported(state, player.id) || !testRerollDecisionIsValid(state, content)) {
    return "Invalid or unsupported Norman acquisition test.";
  }
  return undefined;
}

export function withNormanAcquireRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "RANDOM_INPUT_REQUIRED", message: "Norman's acquisition test requires valid random input." } };
  }
}

/** Version-neutral payment shared by the supported action and Spell contexts. */
export function spendNormanClueSubstitution(state: GameState, playerId: string): boolean {
  if (validateInvestigatorAbilityUsage(state) || !normanHasSubstitutionAvailable(state, playerId)) return false;
  state.privateState.investigatorAbilityUsageVersion = 1;
  const usage = state.privateState.investigatorAbilityUsage ??= { schemaVersion: 1, normanClueSubstitutions: [] };
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
