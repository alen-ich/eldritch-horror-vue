# Active Expedition setup foundation

## Intent and verified gap
Complete the missing Expedition placement portion of authoritative setup, prerequisite to future Expedition encounters. CODEX milestone order prioritizes setup before encounter effects. Code has no Expedition deck/state; all 18 fronts and six backs already exist in the scan catalog. The official Reference Guide, printed page 6, says Expeditions share one shuffled deck and the token follows its top card's back: https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf. The six local back scans were inspected in this session; existing manifest maps them to Africa, Himalayas, Amazon, Tunguska, Antarctica and Pyramids.

## Scope and recommended architecture
Create an explicit content-safe 18-record setup catalog {id, locationId}, derived from existing physical scan entries and a six-location mapping. Strict validation rejects wrong/missing/duplicate IDs or locations; readiness/effect status remains unchanged. Engine stays pure TypeScript and independently validates a complete canonical base-game setup catalog. START_GAME with this catalog shuffles a single private `encounter:expedition` deck and sets public `activeExpeditionLocationId` to its top card's location, without drawing/revealing the front. The injected uniform shuffle represents randomized tabletop shuffle/cut; no player-selected cut UI is introduced.

Server includes this catalog in production content, round-trips the location in Schema/toEngineState/applyEngineState, and validates deck conservation/top-location consistency before applying restored snapshots. A previously initialized room cannot restore a snapshot with the Expedition deck silently removed. Public/player projections contain only the location, never physical top-card identity/order. Legacy synthetic snapshots with neither field nor deck remain readable without retroactive initialization.

Client reads the public location and renders an accessible SVG marker plus inspector text. It performs no random selection or rules decision. Reconnection and room replacement use the existing snapshot lifecycle; resetting rooms clears the marker.

## Alternatives
Separate per-region decks contradict the shared-deck rule. Publishing the top front ID reveals a specific encounter outcome unnecessarily. Shipping an encounter command before its effects are transcribed would bypass existing safety guards. An internal-only helper would leave production setup incomplete; the selected vertical slice includes server synchronization and visible placement.

## Authority, errors and privacy
Only existing host-authorized, runtime-validated START_GAME invokes setup. New catalog failures use EXPEDITION_CONTENT_MISSING before RNG; deterministic input failures roll back available context checkpoints and leave canonical state/version unchanged. One accepted start advances version once. No network command or player-selected token location is added. Restored duplicate/missing/foreign cards or a mismatched marker reject before synchronized/private room mutation. Existing hidden data remains server-only.

## Acceptance and tests
Exactly 18 unique canonical cards, three per six sites, form one conserved private deck; deterministic shuffle controls its top and public marker. Bad catalog/map entries, missing RNG, unauthorized/stale/repeated start and invalid restoration cannot mutate state or consume retained deterministic queues. Serialization/reconnect preserves order and location without reshuffling. Two clients agree on the public location and see no Expedition front IDs/order in payloads. Browser board exposes one accessible marker whose location survives reload; replacement/empty snapshots clear it. Existing tests remain green.

## Exclusions and review
No Expedition draws, effects/rewards, deck cycling/relocation commands, full setup completeness claim, new package, Ancient One entry effects or overall readiness promotion. Only setup/top marker is implemented. Self-review: one coherent vertical slice, explicit legacy behavior and private/public boundary; approved under user delegation. Current branch, inline, no commits/push/merge/deploy.
