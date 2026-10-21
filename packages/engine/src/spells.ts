import type { SpellFrontId } from "@eldritch/protocol";
import type { CommandResult, EngineContext, GameContent, GameState, RuleErrorCode } from "./index.js";

export interface SpellDefinition {
  id: string;
  kind: string;
  trait: "incantation" | "ritual";
  timing: "action" | "encounter" | "combat" | "prevent_health_loss" | "prevent_sanity_loss";
}
export interface PrivateSpellInventory {
  /** Top first; random double-sided draws remove the last card. */
  deck: string[];
  heldByPlayer: Record<string, string[]>;
  heldByDefeatedInvestigator: Record<string, string[]>;
}

function validCatalog(catalog: readonly SpellDefinition[]): boolean {
  const kinds = new Set(catalog.map(card => card.kind));
  return catalog.length === 20 && kinds.size === 10 && new Set(catalog.map(card => card.id)).size === 20
    && [...kinds].every(kind => /^[a-z_]+$/.test(kind)
      && ["01", "02"].every(copy => catalog.some(card => card.kind === kind && card.id === `spell_${kind}_${copy}`)))
    && catalog.every(card => ["incantation", "ritual"].includes(card.trait)
      && ["action", "encounter", "combat", "prevent_health_loss", "prevent_sanity_loss"].includes(card.timing)
      && catalog.filter(other => other.kind === card.kind).every(other => other.trait === card.trait && other.timing === card.timing));
}

/** Catalog validation is required before converting any physical identity. */
export function publicSpellId(physicalId: string): SpellFrontId {
  const match = /^spell_([a-z_]+)_(01|02)$/.exec(physicalId);
  if (!match) throw new Error("Invalid physical Spell identity.");
  return `spell_${match[1]}`;
}

export function createSpellInventory(catalog: readonly SpellDefinition[], playerIds: readonly string[], context: EngineContext): PrivateSpellInventory {
  if (!validCatalog(catalog) || !playerIds.length || new Set(playerIds).size !== playerIds.length || playerIds.some(id => !id)) throw new Error("Invalid Spell catalog or seats.");
  const deck = context.shuffle(catalog.map(card => card.id));
  if (deck.length !== 20 || new Set(deck).size !== 20 || deck.some(id => !catalog.some(card => card.id === id))) throw new Error("Invalid Spell shuffle.");
  return { deck, heldByPlayer: Object.fromEntries(playerIds.map((id): [string, string[]] => [id, []])), heldByDefeatedInvestigator: {} };
}

export function validateSpellInventory(state: GameState, catalog: readonly SpellDefinition[]): string | undefined {
  if (!validCatalog(catalog)) return "Spell catalog is invalid.";
  const inventory = state.privateState.spells;
  const record = (value: unknown): boolean => value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  if (!record(inventory) || !inventory || !Array.isArray(inventory.deck)
    || !record(inventory.heldByPlayer) || !record(inventory.heldByDefeatedInvestigator)) return "Spell inventory is not initialized or has invalid ownership maps.";
  const seats = state.players.map(player => player.id);
  const defeated: string[] = (state.defeatedInvestigators ?? []).map(player => player.investigatorId);
  if (new Set(seats).size !== seats.length || new Set(defeated).size !== defeated.length
    || Object.keys(inventory.heldByPlayer).some(id => !seats.includes(id))
    || Object.keys(inventory.heldByDefeatedInvestigator).some(id => !defeated.includes(id))) return "Spell owner references are invalid.";
  const holdings = [...Object.values(inventory.heldByPlayer), ...Object.values(inventory.heldByDefeatedInvestigator)];
  if (holdings.some(cards => !Array.isArray(cards))) return "Spell holdings are invalid.";
  const physical = [...inventory.deck, ...holdings.flat()];
  if (physical.length !== 20 || new Set(physical).size !== 20 || physical.some(id => !catalog.some(card => card.id === id))) return "Spell copies are not conserved.";
  if (holdings.some(cards => new Set(cards.map(publicSpellId)).size !== cards.length)) return "A holder has duplicate Spell kinds.";
  return undefined;
}

export type SpellGainRequest = { type: "random" } | { type: "kind"; kind: string } | { type: "trait"; trait: "incantation" | "ritual" };
const rejected = (code: RuleErrorCode, message: string): CommandResult => ({ ok: false, error: { code, message } });

function validateRecipient(state: GameState, playerId: string, content: GameContent): CommandResult | undefined {
  if (state.phase === "lobby") return rejected("WRONG_PHASE", "Spell inventory operations require an active game.");
  if (state.gameResult) return rejected("GAME_ENDED", "The game has ended.");
  const player = state.players.find(player => player.id === playerId);
  if (!player) return rejected("PLAYER_NOT_FOUND", "The investigator is not in this game.");
  if (player.defeated || player.eliminated) return rejected("INVESTIGATOR_DEFEATED", "This investigator cannot receive or discard Spells.");
  if (!content.spells) return rejected("SPELL_CONTENT_MISSING", "Spell content is unavailable.");
  const invalid = validateSpellInventory(state, content.spells);
  if (invalid) return rejected("SPELL_INVENTORY_INVALID", invalid);
}

function shuffleSupply(inventory: PrivateSpellInventory, context: EngineContext): void {
  if (inventory.deck.length < 2) return;
  const original = inventory.deck;
  const shuffled = context.shuffle(original);
  if (shuffled.length !== original.length || new Set(shuffled).size !== original.length || shuffled.some(id => !original.includes(id))) throw new Error("Invalid shuffle input.");
  inventory.deck = shuffled;
}

/** Version-neutral: only an enclosing authoritative command increments stateVersion. */
export function gainSpell(state: GameState, playerId: string, request: SpellGainRequest, content: GameContent, context: EngineContext): CommandResult {
  const invalid = validateRecipient(state, playerId, content);
  if (invalid) return invalid;
  const catalog = content.spells!;
  if (!request || !["random", "kind", "trait"].includes(request.type)
    || request.type === "kind" && !catalog.some(card => card.kind === request.kind)
    || request.type === "trait" && !["incantation", "ritual"].includes(request.trait)) return rejected("SPELL_CONTENT_MISSING", "The requested Spell filter is invalid.");
  const next = structuredClone(state);
  const inventory = next.privateState.spells!;
  const held = inventory.heldByPlayer[playerId] ??= [];
  const owns = (id: string): boolean => held.some(card => publicSpellId(card) === publicSpellId(id));
  const matches = (id: string): boolean => {
    const definition = catalog.find(card => card.id === id)!;
    return request.type === "random" || request.type === "kind" && definition.kind === request.kind || request.type === "trait" && definition.trait === request.trait && !owns(id);
  };
  try {
    if (request.type === "random" && !inventory.deck.some(id => !owns(id))) return { ok: true, state: next, events: [] };
    let selected: string | undefined;
    if (request.type === "random") {
      while (inventory.deck.length) {
        const drawn = inventory.deck.pop()!;
        if (!owns(drawn)) { selected = drawn; break; }
        inventory.deck.push(drawn);
        shuffleSupply(inventory, context);
      }
    } else {
      let index = inventory.deck.length - 1;
      while (index >= 0 && !matches(inventory.deck[index]!)) index--;
      if (index >= 0) {
        const drawn = inventory.deck.splice(index, 1)[0]!;
        if (owns(drawn)) inventory.deck.push(drawn);
        else selected = drawn;
      }
      shuffleSupply(inventory, context);
    }
    if (selected) held.push(selected);
    return { ok: true, state: next, events: selected ? [{ type: "SPELL_GAINED", playerId, spellId: publicSpellId(selected) }] : [] };
  } catch {
    return rejected("SPELL_RANDOM_INPUT_INVALID", "Spell random input is unavailable or invalid.");
  }
}

/** Return a discarded double-sided card immediately; there is no Spell discard pile. */
export function discardSpell(state: GameState, playerId: string, physicalId: string, content: GameContent, context: EngineContext): CommandResult {
  const invalid = validateRecipient(state, playerId, content);
  if (invalid) return invalid;
  if (!state.privateState.spells!.heldByPlayer[playerId]?.includes(physicalId)) return rejected("SPELL_NOT_HELD", "That Spell is not held by this investigator.");
  const next = structuredClone(state);
  const inventory = next.privateState.spells!;
  inventory.heldByPlayer[playerId] = inventory.heldByPlayer[playerId]!.filter(id => id !== physicalId);
  inventory.deck.push(physicalId);
  try { shuffleSupply(inventory, context); }
  catch { return rejected("SPELL_RANDOM_INPUT_INVALID", "Spell random input is unavailable or invalid."); }
  return { ok: true, state: next, events: [{ type: "SPELL_DISCARDED", playerId, spellId: publicSpellId(physicalId) }] };
}

/** Fail closed only where an unimplemented Spell could change this resolution. */
export function spellEffectIsUnsupported(state: GameState, playerId: string, effectContext: "encounter" | "combat" | "health_loss" | "sanity_loss", content: GameContent): boolean {
  if (!state.privateState.spells) return Boolean(content.spells && state.phase !== "lobby");
  if (!content.spells || validateSpellInventory(state, content.spells)) return true;
  return state.players.some(holder => !holder.defeated && !holder.eliminated
    && (state.privateState.spells!.heldByPlayer[holder.id] ?? []).some(id => {
      const spell = content.spells!.find(card => card.id === id)!;
      if (effectContext === "health_loss") return spell.timing === "prevent_health_loss";
      if (effectContext === "sanity_loss") return spell.timing === "prevent_sanity_loss";
      // Encounter text is preflighted conservatively before tests/rewards. Either
      // resource could be lost; protective spells can target remote colleagues.
      return spell.timing === "prevent_health_loss" || spell.timing === "prevent_sanity_loss"
        || holder.id === playerId && (spell.timing === "encounter" || effectContext === "combat" && spell.timing === "combat");
    }));
}
