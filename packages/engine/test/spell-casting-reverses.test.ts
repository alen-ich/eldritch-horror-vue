import { describe, expect, it } from "vitest";
import { cast, castingState, choose, unwrap } from "./spell-casting-fixtures.js";
const front=(state: ReturnType<typeof cast>) => unwrap(choose(unwrap(choose(state,"host")),"improve:lore:1"));
describe("Feed the Mind reverse lifecycle",()=>{
  it.each([0,1,2])("offers loss or discard at %i successes",successes=>{
    const dice=Array.from({length:2},(_,i)=>i<successes?6:2);
    const state=successes?front(cast(castingState(),dice)):cast(castingState(),dice);
    expect(state.pendingDecision?.optionIds).toEqual(["lose_sanity","discard_spell"]);
    const next=unwrap(choose(state,"lose_sanity"));expect(next.players[0]!.sanity).toBe(5);
    expect(next.actionsRemaining).toBe(1);expect(next.privateState.spellCasting?.pending).toBeUndefined();
  });
  it("discards physically without forgetting component use",()=>{
    const state=cast(castingState(),[2,2]);const next=unwrap(choose(state,"discard_spell"));
    expect(next.privateState.spells!.heldByPlayer.host).toEqual([]);expect(next.privateState.spells!.deck).toHaveLength(20);
    expect(next.privateState.spellCasting!.usedPhysicalIds).toEqual(["spell_feed_the_mind_01"]);
  });
  it.each([true,false])("uses final four on failure: %s",hasFour=>{
    const next=cast(castingState("spell_feed_the_mind_02"),[hasFour?4:2,2]);
    expect(next.privateState.spells!.heldByPlayer.host).toHaveLength(hasFour?1:0);expect(next.actionsRemaining).toBe(1);
  });
  it("offers optional additional improvement after three successes",()=>{
    const initial=castingState();initial.players[0]!.skillImprovements.lore=1;
    const state=front(cast(initial,[6,6,6]));expect(state.pendingDecision?.optionIds).toContain("decline");
    expect(unwrap(choose(state,"decline")).actionsRemaining).toBe(1);
    const next=unwrap(choose(state,"improve:will:1"));expect(next.players[0]!.skillImprovements.will).toBe(1);
  });
  it("ordinary loss defeats, clears obsolete choices and charges exactly once",()=>{
    const initial=castingState("spell_feed_the_mind_02");initial.players[0]!.sanity=1;initial.actionsRemaining=1;
    const next=front(cast(initial));expect(next.pendingDefeat?.playerId).toBe("host");
    expect(next.privateState.spellCasting?.pending).toBeUndefined();expect(next.pendingDecision).toBeUndefined();
    expect(next.actionsRemaining).toBe(0);expect(next.activePlayerId).toBe("host");
  });
});
