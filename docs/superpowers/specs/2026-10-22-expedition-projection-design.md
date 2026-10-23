# Expedition discard projection isolation

## Intent and verified dependency
The completed Other World lifecycle review exposed the same shallow public-state spread for existing expeditionDiscardIds. A public projection consumer can mutate canonical physical inventory by modifying that array. Isolate it before further encounter family work. This is a bounded existing-flow fix; the user explicitly requests saved spec and plan for every iteration, so retain those artifacts.

## Approach and alternatives
Copy/default only expeditionDiscardIds in projectStateForPlayer, which supplies both projectPublicState and player projections. Existing otherWorldDiscardIds follows the same pattern. Deep cloning every public field would broaden behavior and cost without helping this requirement. Freezing the shared array does not isolate canonical ownership and changes mutability semantics. No new dependency.

## Scope, authority and privacy
Pure engine projection plus meaningful regression tests in expedition-discard.test.ts. No commands, schema, server logic, UI or rule outcomes change. Projection mutations must never alter canonical inventory, and subsequent canonical mutations must not alter an already produced view. Private deck/draw binding remains absent. No family readiness promotion or other inventory refactor. Preserve unrelated changes/current directory/current branch; no commit/push/merge/deploy.

## Acceptance
Public and owner projections have equal discard values but independent arrays. Mutating either side leaves the other unchanged. Legacy absent discard list projects as an empty array without mutating the source. Existing lifecycle, JSON restoration and multiplayer tests remain green. Root lint/typecheck/test/build and all three Playwright configurations run sequentially where they share generated directories.

## Self-review
Goal, exclusions and two-way isolation are explicit; no unanswered requirement. Self-approved under the user's delegated approval, 2026-10-22.
