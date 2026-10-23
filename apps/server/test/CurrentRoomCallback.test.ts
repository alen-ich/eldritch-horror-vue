import assert from "node:assert/strict";
import { currentRoomCallback } from "../../web/app/game/current-room-callback.js";
import { createPrivateDecisionInbox } from "../../web/app/game/private-decision-inbox.js";
import type { PendingDecision } from "@eldritch/protocol";

describe("current room callback isolation", () => {
  it("ignores obsolete state, error, token and connection events even for the same room ID", () => {
    const oldRoom = { roomId: "same" }, nextRoom = { roomId: "same" };
    let current = oldRoom;
    const view = { version: 0, error: "", token: "", status: "connected" };
    const guard = <Args extends unknown[]>(callback: (...args: Args) => void) => currentRoomCallback(() => current === oldRoom, callback);
    const state = guard((version: number) => { view.version = version; });
    const error = guard((message: string) => { view.error = message; });
    const token = guard((value: string) => { view.token = value; });
    const drop = guard(() => { view.status = "connecting"; });
    const reconnect = guard(() => { view.status = "connected"; });
    const leave = guard(() => { view.status = "disconnected"; });
    state(1); drop(); assert.equal(view.status, "connecting");
    reconnect(); assert.equal(view.status, "connected");
    current = nextRoom;
    state(99); error("obsolete"); token("obsolete"); drop(); reconnect(); leave();
    assert.deepEqual(view, { version: 1, error: "", token: "", status: "connected" });
    const currentState = currentRoomCallback(() => current === nextRoom, (stateVersion: number) => { view.version = stateVersion; });
    currentState(2); assert.equal(view.version, 2);
  });

  it("does not repopulate a cleared private inbox from an obsolete connection", () => {
    const inbox = createPrivateDecisionInbox();
    let current = true;
    const receive = currentRoomCallback(() => current, (decision: PendingDecision) => { inbox.receive(decision); });
    const decision: PendingDecision = { id: "shared-id", kind: "select_rerolls", playerId: "owner", visibility: "owner", prompt: "Choose", continuation: "test_reroll", minSelections: 0, maxSelections: 1, optionIds: ["private-old-option"] };
    const { optionIds: _options, ...summary } = decision;
    const publicSummary = { ...summary, optionCount: 1 };
    receive(decision); assert.deepEqual(inbox.sync(publicSummary), decision);
    current = false; inbox.clear(); receive(decision);
    assert.deepEqual(inbox.sync(publicSummary), publicSummary);
  });
});
