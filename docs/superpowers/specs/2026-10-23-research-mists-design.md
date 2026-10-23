# Named Mists of Releh Research reward

## Goal and evidence
Enable Cthulhu6 City: successful Observation gains this Clue and a Mists of Releh Spell; failure gains Paranoia. Locally inspected source `apps/web/public/cards/encounters/research_cthulhu/06.webp` confirms both branches. Current authored content retains the Spell node but engine parsing rejects the whole section. `gainSpell({type:"kind",kind:"mists_of_releh"})` already implements physical double-sided supply/duplicate handling and post-search shuffle.

## Recommended design
Admit only the stable `spell_mists_of_releh` reward ID in encounter effects, map it to the existing kind gain, and use the existing Research random transaction and private inventory. Preflight any such node against catalog/inventory before draw or RNG, including unchosen branches and restored decisions. The existing gain operation must handle unavailable supply without manufacturing a card and preserve duplicate-name limits. Retain existing public Spell-front projection; never expose physical backs/deck order.

Reusing the existing lifecycle avoids a duplicate search implementation. Alternative named Artifact rewards are larger: Grotesque Statue requires on-gain5 Clues plus prevention and Ruby extra actions; their unsupported gain/effect guards must not be bypassed. Implementing Mists casting is a separate feature and not required to receive a card; subsequent encounter guards remain closed.

## Scope, authority and exclusions
Server resolves the unchanged Research intent and owns RNG, card/marker bindings and Spell supply. Pure engine adds no content/framework imports or network fields. No packages. Cthulhu1 Sea remains blocked because its refusal consequence is not modeled, even though its reward names the same Spell. No arbitrary Spell IDs, casting, Artifact rewards, combat/possession guard expansion or readiness promotion.

## Acceptance
Prove actual Research6 City success/failure; exact Clue gain; one matching physical Spell moved with remaining supply conserved/shuffled; unavailable Spell completes Clue reward without manufacturing it; unrelated/duplicate cards preserved. JSON-restored owner-only Observation reroll reaches the reward once; hidden backs/deck remain private. Invalid/missing inventory/content and malformed nodes fail before side effects. Incomplete shuffle RNG rolls back state and consumed dice. Receiving Mists does not enable unsupported casting or next encounter. Real-room restoration verifies boundary already supplies Spell inventory/catalog. Root lint/typecheck/test/build and all three browser configs pass sequentially.

## Self-review
Approved under delegated user authority. Single named reward scope, validated source, explicit unsupported branches and privacy boundaries. Written plan before implementation.
