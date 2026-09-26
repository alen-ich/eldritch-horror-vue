import { describe, expect, it } from "vitest";
import { gameCommandSchema } from "../src/index.js";

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
