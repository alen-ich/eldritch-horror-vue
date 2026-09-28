import { describe, expect, it } from "vitest";
import { loseResource, recoverResource } from "../src/resources.js";

describe("investigator resources", () => {
  it("loses only the available amount and reports depletion", () => {
    expect(loseResource(5, 2)).toEqual({ value: 3, amount: 2, depleted: false });
    expect(loseResource(2, 5)).toEqual({ value: 0, amount: 2, depleted: true });
  });

  it("does not report an already empty resource as newly depleted", () => {
    expect(loseResource(0, 1)).toEqual({ value: 0, amount: 0, depleted: false });
  });

  it("recovers without exceeding the investigator maximum", () => {
    expect(recoverResource(3, 7, 2)).toEqual({ value: 5, amount: 2 });
    expect(recoverResource(6, 7, 3)).toEqual({ value: 7, amount: 1 });
  });

  it("accepts zero loss and recovery as no-ops", () => {
    expect(loseResource(4, 0)).toEqual({ value: 4, amount: 0, depleted: false });
    expect(recoverResource(4, 7, 0)).toEqual({ value: 4, amount: 0 });
  });

  it.each([
    () => loseResource(-1, 1),
    () => loseResource(1, -1),
    () => recoverResource(-1, 1, 1),
    () => recoverResource(2, 1, 1),
    () => recoverResource(1, 2, 0.5),
  ])("rejects invalid resource values", (operation) => {
    expect(operation).toThrow();
  });
});
