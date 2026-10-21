import { describe, expect, it } from "vitest";
import { executeCommand } from "../src/index.js";
import { cast, castingState, castingContent, castingContext, choose, unwrap } from "./spell-casting-fixtures.js";
describe("Feed the Mind front", () => {
  it("reserves last action while recipient chooses, with one version per command", () => {
    const initial=castingState(); initial.actionsRemaining=1; const before=structuredClone(initial);
    const started=cast(initial); expect(initial).toEqual(before); expect(started.stateVersion).toBe(initial.stateVersion+1);
    expect(started.pendingDecision?.kind).toBe("spell_target"); expect(started.actionsRemaining).toBe(1);
    const target=unwrap(choose(started,"guest")); expect(target.pendingDecision?.playerId).toBe("guest");
    expect(choose(target,"improve:lore:1","host")).toMatchObject({ok:false});
    const result=unwrap(choose(target,"improve:lore:1")); expect(result.players[1]!.skillImprovements.lore).toBe(1);
    expect(result.privateState.spellCasting?.usedPhysicalIds).toContain("spell_feed_the_mind_01");
  });
  it.each(["lore","influence","observation","strength","will"])("caps %s and offers Lily twice",skill=>{
    const state=castingState(); state.players[1]!.investigatorId="lily_chen";
    const target=unwrap(choose(cast(state),"guest"));
    expect(target.pendingDecision?.optionIds).toContain(`improve:${skill}:2`);
    const result=unwrap(choose(target,`improve:${skill}:2`));
    expect(result.players[1]!.skillImprovements[skill as "lore"]).toBe(2);
  });
  it("rejects illegal casts without consuming input",()=>{
    for(const change of [(s:ReturnType<typeof castingState>)=>{s.actionsRemaining=0;},(s:ReturnType<typeof castingState>)=>{s.players[0]!.delayed=true;},(s:ReturnType<typeof castingState>)=>{s.activePlayerId="guest";}]){
      const state=castingState();change(state);const ctx=castingContext([4]);const before=structuredClone(state);
      expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},castingContent,ctx).ok).toBe(false);
      expect(ctx.rollDie()).toBe(4); expect(state).toEqual(before);
    }
  });
});
