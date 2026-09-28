import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, createLobby, discardCondition, gainCondition, projectPublicState, type GameContent } from "../src/index.js";

const content: GameContent = {
  conditions: [
    { id: "condition_blessed_01", kind: "blessed" },
    { id: "condition_blessed_02", kind: "blessed" },
    { id: "condition_cursed_01", kind: "cursed" },
    { id: "condition_debt_01", kind: "debt" },
  ],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: {} },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state() {
  const game = createLobby(["investigator"]);
  game.phase = "action";
  game.players[0]!.conditionIds = [];
  game.privateState.tokenPoolById = {
    "condition:blessed": ["condition_blessed_01", "condition_blessed_02"],
    "condition:cursed": ["condition_cursed_01"],
    "condition:debt": ["condition_debt_01"],
  };
  return game;
}

describe("Condition supply and gain lifecycle", () => {
  it("draws a physical card from the private supply without exposing remaining order", () => {
    const before = state();
    const result = gainCondition(before, "investigator", "blessed", content, createDeterministicEngineContext({ tokenIndexes: [1] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.conditionIds).toEqual(["condition_blessed_02"]);
    expect(result.state.privateState.tokenPoolById["condition:blessed"]).toEqual(["condition_blessed_01"]);
    expect(before.players[0]!.conditionIds).toEqual([]);
    expect(before.privateState.tokenPoolById["condition:blessed"]).toHaveLength(2);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("condition_blessed_01");
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("condition_blessed_02");
    expect(projectPublicState(result.state).players[0]!.conditionIds).toEqual(["condition_blessed"]);
  });

  it("discards the opposite boon or bane instead of drawing a replacement", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_cursed_01"];
    before.privateState.tokenPoolById["condition:cursed"] = [];
    const result = gainCondition(before, "investigator", "blessed", content, createDeterministicEngineContext({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.conditionIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById["condition:cursed"]).toEqual(["condition_cursed_01"]);
    expect(result.state.privateState.tokenPoolById["condition:blessed"]).toHaveLength(2);
  });

  it("does not gain an ordinary named Condition already held", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_debt_01"];
    before.privateState.tokenPoolById["condition:debt"] = [];
    const result = gainCondition(before, "investigator", "debt", content, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_GAIN_PREVENTED" }] });
  });

  it("rejects unavailable supply and unresolved same-kind flips without mutation", () => {
    const before = state();
    before.privateState.tokenPoolById["condition:debt"] = [];
    expect(gainCondition(before, "investigator", "debt", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CONDITION_UNAVAILABLE" } });
    before.players[0]!.conditionIds = ["condition_blessed_01"];
    expect(gainCondition(before, "investigator", "blessed", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CONDITION_EFFECT_UNSUPPORTED" } });
    expect(before.players[0]!.conditionIds).toEqual(["condition_blessed_01"]);
  });

  it("returns discarded copies and rejects an unheld ID", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_debt_01"];
    before.privateState.tokenPoolById["condition:debt"] = [];
    const result = discardCondition(before, "investigator", "condition_debt_01", content);
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_DISCARDED" }] });
    if (!result.ok) return;
    expect(result.state.privateState.tokenPoolById["condition:debt"]).toEqual(["condition_debt_01"]);
    expect(discardCondition(result.state, "investigator", "condition_debt_01", content))
      .toMatchObject({ ok: false, error: { code: "CONDITION_NOT_HELD" } });
  });
});
