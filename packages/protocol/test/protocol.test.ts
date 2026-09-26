import { describe, expect, it } from "vitest";
import { gameCommandMessageSchema, gameCommandSchema } from "../src/index.js";

describe("gameCommandSchema", () => {
  it("accepts rulebook action commands without player identity", () => {
    expect(gameCommandSchema.parse({ type: "TRAVEL", destinationIds: ["rome", "istanbul"] })).toEqual({
      type: "TRAVEL",
      destinationIds: ["rome", "istanbul"],
    });
    expect(gameCommandSchema.parse({ type: "REST" })).toEqual({ type: "REST" });
    expect(gameCommandSchema.parse({ type: "PREPARE_TRAVEL", ticketType: "ship" })).toEqual({ type: "PREPARE_TRAVEL", ticketType: "ship" });
    expect(gameCommandSchema.parse({ type: "END_ACTIONS" })).toEqual({ type: "END_ACTIONS" });
  });

  it("rejects forged identity and unknown destinations", () => {
    expect(() => gameCommandSchema.parse({
      type: "TRAVEL",
      destinationIds: ["the_moon"],
      playerId: "someone-else",
    })).toThrow();
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
