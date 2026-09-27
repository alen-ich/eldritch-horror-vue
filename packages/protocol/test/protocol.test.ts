import { describe, expect, it } from "vitest";
import { gameCommandMessageSchema, gameCommandSchema, pendingDecisionSchema } from "../src/index.js";

describe("gameCommandSchema", () => {
  it("accepts rulebook action commands without player identity", () => {
    expect(gameCommandSchema.parse({ type: "TRAVEL", destinationIds: ["rome", "istanbul"] })).toEqual({
      type: "TRAVEL",
      destinationIds: ["rome", "istanbul"],
    });
    expect(gameCommandSchema.parse({ type: "REST" })).toEqual({ type: "REST" });
    expect(gameCommandSchema.parse({ type: "PREPARE_TRAVEL", ticketType: "ship" })).toEqual({ type: "PREPARE_TRAVEL", ticketType: "ship" });
    expect(gameCommandSchema.parse({ type: "END_ACTIONS" })).toEqual({ type: "END_ACTIONS" });
    expect(gameCommandSchema.parse({ type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" })).toEqual({
      type: "SELECT_ANCIENT_ONE",
      ancientOneId: "cthulhu",
    });
    expect(gameCommandSchema.parse({
      type: "RESOLVE_DECISION",
      decisionId: "decision-1",
      selectedOptionIds: ["die-2"],
    })).toEqual({
      type: "RESOLVE_DECISION",
      decisionId: "decision-1",
      selectedOptionIds: ["die-2"],
    });
  });

  it("rejects forged identity and unknown destinations", () => {
    expect(() => gameCommandSchema.parse({
      type: "TRAVEL",
      destinationIds: ["the_moon"],
      playerId: "someone-else",
    })).toThrow();
  });

  it("rejects an unknown Ancient One", () => {
    expect(() => gameCommandSchema.parse({
      type: "SELECT_ANCIENT_ONE",
      ancientOneId: "hastur",
    })).toThrow();
  });
});

describe("pendingDecisionSchema", () => {
  const decision = {
    id: "decision-1",
    kind: "select_rerolls",
    playerId: "player-1",
    visibility: "owner",
    prompt: "Choose dice to reroll.",
    optionIds: ["die-1", "die-2"],
    minSelections: 0,
    maxSelections: 1,
  } as const;

  it("accepts a bounded serializable decision", () => {
    expect(pendingDecisionSchema.parse(decision)).toEqual(decision);
  });

  it.each([
    { ...decision, optionIds: ["die-1", "die-1"] },
    { ...decision, minSelections: 2, maxSelections: 1 },
    { ...decision, maxSelections: 3 },
  ])("rejects an inconsistent decision", (invalidDecision) => {
    expect(() => pendingDecisionSchema.parse(invalidDecision)).toThrow();
  });
});

describe("gameCommandMessageSchema", () => {
  it("accepts a command with the state version observed by the client", () => {
    expect(gameCommandMessageSchema.parse({
      expectedStateVersion: 7,
      command: { type: "REST" },
    })).toEqual({
      expectedStateVersion: 7,
      command: { type: "REST" },
    });
  });

  it.each([-1, 1.5, "1", undefined])("rejects invalid state version %s", (expectedStateVersion) => {
    expect(() => gameCommandMessageSchema.parse({
      expectedStateVersion,
      command: { type: "REST" },
    })).toThrow();
  });

  it("rejects unknown envelope fields and forged identity", () => {
    expect(() => gameCommandMessageSchema.parse({
      expectedStateVersion: 0,
      command: { type: "REST", playerId: "another-player" },
      playerId: "another-player",
    })).toThrow();
  });
});
