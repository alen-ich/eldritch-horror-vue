# Base-game Mythos reference

## English scan coverage

Four supplied source sheets contain all 51 base-game Mythos card fronts:

- 18 green cards;
- 21 yellow cards;
- 12 blue Rumor cards.

The source sheets live under `source-assets/mythos`. Run `pnpm mythos:generate` to reproduce the individual WebP fronts under `apps/web/public/cards/mythos`. The generator uses the verified 6-by-3, 3-by-1, and 6-by-2 source grids and assigns stable color-sequence IDs.

## Structured content

`packages/content/src/mythos.ts` records each card's:

- stable ID and English title;
- color and printed card kind;
- verified left-to-right icon sequence, including Rumor spaces and Eldritch-token counts;
- source-sheet row and column;
- generated browser asset path;
- scan-verification and executable-effect status.

Validation requires exactly 18 green, 21 yellow, and 12 blue cards, unique IDs and titles, and Rumor classification for every blue card. Tests also require all 51 generated fronts to exist.

## Authority boundary

The card roster, titles, colors, visible card kinds, and printed icon sequences are verified from the English scans. The rulebook's Mythos-phase icon key was visually checked against the scanned cards. Green cards share Advance Omen, Monster Surge, Spawn Clues; yellow cards share Advance Omen, Resolve Reckoning, Spawn Gates; blue cards begin with Spawn Clues, then their printed Rumor/Eldritch placement icons. The printed text effect for each card has not yet been transcribed into executable content, so the `mythos_cards` readiness family remains `needs_review`.

The engine must not execute OCR or display text. A later rules slice will model the shared Mythos resolution sequence first, then encode repeated effect patterns and Rumor state with deterministic tests.

The pure engine's draw transition reveals the top card from the server-private staged deck, exposes only that card ID, prevents drawing again until the revealed card is resolved, and ends the game if a required draw finds the initialized deck empty. An uninitialized deck or unknown card ID fails without mutation. It resolves the first printed icon atomically with the draw: Spawn Clues for blue Rumors, Advance Omen for green and yellow cards. Missing icon data, missing random input for Clues, or unsupported awakening rejects the draw without consuming the card. The Lead can invoke this transition with `ADVANCE_MYTHOS`; the end-of-Mythos replacement window cannot open while a revealed card is unresolved.

The pure Omen kernel now models the board's four printed spaces in clockwise order (comet, constellation, eclipse, constellation). It counts Doom from active Gates separately for every space entered, including both constellation spaces and wraps around the track. This is not yet a live Mythos transition: active Gate placement, Ancient One overrides, awakening, and subsequent icons must be connected before a card can progress.

The Clue-icon step uses the revealed card's verified icon and the reference-card count for the current player count. It places opaque board markers through the physical Clue pool, stops at the component limit, and rejects a second resolution for the same card. The live icon cursor enforces printed order, including the preceding icons on green cards.

The room now persists a printed-icon cursor. Drawing a card advances it past the first resolved icon; the Clue step rejects a green card while Monster Surge is still next, and advances the cursor only after successful spawning. Other icon handlers must use the same cursor before the room can expose the Mythos phase.

The green-card Monster Surge step reads the current Omen and all active Gate symbols. It spawns the scan-verified Reference-card number of Monsters at each matching Gate, or opens one Gate (including that Gate's normal Monster spawn) when none match. It stops when the finite Monster cup is empty, advances the icon cursor after the whole step, and leaves the input state untouched if any supported spawn cannot be resolved. The subsequent green Clue icon can then run through the live command.

The yellow-card Spawn Gates step reads the Reference-card count and opens that many Gates, each with its required Monster spawn when the cup is nonempty. It requires the icon cursor to be past Reckoning, stops at the finite Gate stack, and treats all opens as one atomic state change. Full Reckoning ordering remains pending.

Five scanned Event cards have typed printed-text effects. **Support of the Church** grants the Lead Investigator a physical Blessed Condition through the existing supply and Blessed/Cursed lifecycle. **Perplexing Stars** moves the Omen counterclockwise one space, then advances Doom once for each active Gate matching the new symbol; it applies Azathoth's zero-Doom loss and refuses unsupported awakening for other Ancient Ones without changing state. **Omen of Good Fortune** pauses for an owner-only Lead choice of any of the four physical Omen spaces or no movement; the chosen move does not advance Doom. **The World Fights Back** prompts each surviving investigator in Lead order to recover 2 Health, recover 2 Sanity, discard one normal Monster on their space, or skip. Recovery caps at the investigator's maximum; discarded normal tokens return to the randomized private cup, while set-aside normal tokens return to their set-aside supply. Epic Monsters cannot be discarded. **Rally the People** searches the private Asset deck for its first Ally, falling back to the discard pile if needed; the Lead gains that Asset and the deck is reshuffled. If no Ally remains in either pile, no Asset is gained. Choices and private options survive reconnects, while other players see only a decision summary. Each effect resolves after the card's printed icons, consumes the card, and opens the end-of-Mythos replacement window. The other 46 printed card texts remain untyped and stop safely at the icon boundary.

Once that window is open and any desired investigator replacements are complete, the Lead may send `BEGIN_NEXT_ROUND`. The server increments the round, resets per-turn Action and Condition usage, and starts with the first surviving investigator in Lead order. It refuses unresolved cards, decisions, and defeat choices. This does not make the other untyped Mythos cards playable.

A guarded internal Reckoning step now advances the yellow icon cursor only when the higher-priority Ancient One and Monster categories have no executable trigger to resolve, and no unmodeled possession or multi-Condition choice is present. In that narrow case it resolves a single Blessed or Cursed Condition per investigator, beginning with the Lead Investigator and proceeding in seat order, then unlocks Spawn Gates. Unsupported effects fail before changing game state; this is not a complete Reckoning implementation.

An authenticated Lead Investigator may send `ADVANCE_MYTHOS` in Mythos. The server supplies randomness and resolves one verified icon per command, preserving the cursor across reconnects and rejecting stale state versions. Once the icons are complete, the command refuses unimplemented printed card text; the five typed Event cards above open replacement timing after their effects or owner choices. Encounter enters Mythos, but most printed Mythos text remains unimplemented.

The web panel now displays the currently revealed public Mythos front, title, and resolved-icon count to all players. The Lead's next-step button is disabled while an owner choice is pending; the Omen choice itself appears in a reconnect-safe dialog. Private remaining deck order is never sent to the browser.

A Mythos-only Omen transition reads the public active Gates, moves one space clockwise, and reduces Doom for matching symbols. Azathoth's Eldritch tokens on green also advance Doom, with its immediate loss at zero. Awakening for the other three Ancient Ones remains explicitly unsupported, so their Doom cannot silently cross zero. The transition resolves as the first icon of a green or yellow revealed Mythos card.
