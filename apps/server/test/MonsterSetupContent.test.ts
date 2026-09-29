import { strict as assert } from "node:assert";
import { baseGameAncientOnes, baseGameMonsters } from "@eldritch/content";
import { buildMonsterPool } from "@eldritch/engine";
import { typedMonsterSpawnEffect } from "../src/private-monster-spawn-effects.js";

describe("base-game Monster cup content", () => {
  it("can satisfy every Ancient One's physical token set-asides", () => {
    const totalNormal = baseGameMonsters.filter(monster => monster.type === "normal").reduce((sum, monster) => sum + monster.count, 0);
    assert.equal(totalNormal, 34);
    for (const ancient of baseGameAncientOnes) {
      const instructions = ancient.setup.filter(effect => effect.type === "set_aside_monster");
      const pool = buildMonsterPool(baseGameMonsters, instructions);
      const setAsideCount = Object.values(pool.setAsideById).reduce((sum, tokens) => sum + tokens.length, 0);
      assert.equal(pool.cup.length + setAsideCount, totalNormal, ancient.name);
      assert.ok(pool.cup.every(id => baseGameMonsters.some(monster => monster.id === id && monster.type === "normal")));
    }
  });

  it("types every printed Monster spawn instruction without treating unknown text as no effect", () => {
    const printed = baseGameMonsters.filter(monster => monster.spawnEffect);
    assert.equal(printed.length, 7);
    const typed = printed.map(monster => typedMonsterSpawnEffect(monster.id, true));
    assert.equal(typed.filter(effect => effect?.type === "move_to").length, 6);
    assert.equal(typed.filter(effect => effect?.type === "unsupported").length, 1);
    assert.deepEqual(typedMonsterSpawnEffect("monster_wraith", true), { type: "unsupported" });
    assert.equal(typedMonsterSpawnEffect("monster_ghoul", false), undefined);
  });
});
