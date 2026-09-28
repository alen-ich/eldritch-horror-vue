import { strict as assert } from "node:assert";
import { baseGameConditions } from "@eldritch/content";
import { privateConditionBackById, privateConditionBackEffectById } from "../src/private-condition-backs.js";

describe("private Condition backs", () => {
  it("pairs each physical front with one server-only reverse transcript", () => {
    assert.equal(Object.keys(privateConditionBackById).length, 36);
    for (const card of baseGameConditions) {
      const back = privateConditionBackById[card.id];
      assert.ok(back?.title);
      assert.ok(back.text);
    }
    assert.equal(privateConditionBackById.condition_blessed_03?.title, "Blessing of Nodens");
    assert.equal(privateConditionBackById.condition_back_injury_01?.title, "Nerve Damage");
    assert.deepEqual(Object.keys(privateConditionBackEffectById).sort(), ["condition_blessed_01", "condition_blessed_02", "condition_cursed_02", "condition_leg_injury_02", "condition_hallucinations_01"].sort());
  });
});
