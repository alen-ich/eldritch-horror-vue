import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, withSpellRandomTransaction } from "../src/index.js";
import { spellState } from "./spell-fixtures.js";
describe("Spell random transactions", () => {
  it("rolls back all injected queues on rejection and exceptions", () => {
    const ctx = createDeterministicEngineContext({ dice: [4], ids: ["a"], tokenIndexes: [1], shuffleIndexes: [0] });
    const consume = () => { ctx.rollDie(); ctx.createId(); ctx.drawToken([1,2]); ctx.shuffle([1,2]); };
    const failed = withSpellRandomTransaction(ctx, () => { consume(); return { ok: false, error: { code: "SPELL_CAST_INVALID", message: "reject" } }; });
    expect(failed.ok).toBe(false);
    const thrown = withSpellRandomTransaction(ctx, () => { consume(); throw Error("bad input"); });
    expect(thrown).toMatchObject({ok: false, error: {code: "SPELL_RANDOM_INPUT_INVALID"}});
    expect(ctx.rollDie()).toBe(4); expect(ctx.createId()).toBe("a");
    expect(ctx.drawToken([1,2]).token).toBe(2); expect(ctx.shuffle([1,2])).toEqual([2,1]);
  });
  it("commits only successful inputs", () => {
    const ctx = createDeterministicEngineContext({ dice: [6,2] });
    expect(withSpellRandomTransaction(ctx, () => { ctx.rollDie(); return {ok:true,state:spellState(),events:[]}; }).ok).toBe(true);
    expect(ctx.rollDie()).toBe(2);
  });
});
