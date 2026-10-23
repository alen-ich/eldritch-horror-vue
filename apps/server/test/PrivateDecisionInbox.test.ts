import assert from "node:assert/strict";
import { createPrivateDecisionInbox } from "../../web/app/game/private-decision-inbox.js";
import type { PendingDecision, PendingDecisionSummary } from "@eldritch/protocol";

// The web package has no unit runner; exercise its pure transport reconciliation
// with the existing Mocha runner, without importing Nuxt or browser globals.
describe("private decision delivery ordering", () => {
  const summary: PendingDecisionSummary = { id: "next", kind: "select_rerolls", playerId: "owner", visibility: "owner", prompt: "Choose", continuation: "test_reroll", minSelections: 0, maxSelections: 1, optionCount: 1 };
  const decision: PendingDecision = { ...summary, optionIds: ["norman-sanity:0"] };
  it("retains a private choice across an older absent or different public patch", () => {
    const inbox = createPrivateDecisionInbox(); inbox.receive(decision);
    assert.equal(inbox.sync(), undefined);
    assert.deepEqual(inbox.sync({ ...summary, id: "previous" }), { ...summary, id: "previous" });
    assert.deepEqual(inbox.sync(summary), decision);
  });
  it("accepts either delivery order and does not borrow options for another decision", () => {
    const inbox = createPrivateDecisionInbox(); assert.deepEqual(inbox.sync(summary), summary);
    assert.deepEqual(inbox.receive(decision), decision); assert.deepEqual(inbox.sync(summary), decision);
    assert.deepEqual(inbox.sync({ ...summary, id: "other" }), { ...summary, id: "other" });
    inbox.clear(); assert.deepEqual(inbox.sync(summary), summary);
  });
});
