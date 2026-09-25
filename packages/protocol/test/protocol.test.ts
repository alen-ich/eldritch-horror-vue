import { describe, expect, it } from "vitest";
import { gameCommandSchema } from "../src/index.js";

describe("gameCommandSchema", () => {
  it("accepts a known move without player identity", () => {
    expect(gameCommandSchema.parse({ type: "MOVE", destinationId: "rome" })).toEqual({
      type: "MOVE",
      destinationId: "rome",
    });
  });

  it("rejects forged identity and unknown destinations", () => {
    expect(() => gameCommandSchema.parse({
      type: "MOVE",
      destinationId: "the_moon",
      playerId: "someone-else",
    })).toThrow();
  });
});
