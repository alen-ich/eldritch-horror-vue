import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import { commandMessageType, commandErrorMessageType, pendingDecisionMessageType, type GameCommand, type PendingDecision } from "@eldritch/protocol";
import { createDeterministicEngineContext, type GameState, type EngineContext } from "@eldritch/engine";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { baseGameSpellBacks } from "../src/private-spell-backs.js";
import { assertNoPrivateSpellBackData } from "../src/spell-back-privacy.js";
async function eventually(check:()=>boolean){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}assert.ok(check());}
export function registerSpellCastingRoomTests(getServer:()=>ColyseusTestServer<typeof config>):void {
describe("Spell casting",()=>{
  async function fixture(){
    const server=getServer(),room=await server.createRoom<GameRoom>("game",{});
    const host=await server.connectTo(room,{displayName:"Caster"}),guest=await server.connectTo(room,{displayName:"Recipient"});
    const internal=room as unknown as {toEngineState():GameState;applyEngineState(s:GameState):void;createEngineContext(c:GameCommand):EngineContext|undefined};
    async function send(client:typeof host,command:GameCommand){client.send(commandMessageType,{expectedStateVersion:room.state.stateVersion,command});await room.waitForMessage(commandMessageType);}
    await send(host,{type:"SELECT_INVESTIGATOR",investigatorId:"jim_culver"});await send(guest,{type:"SELECT_INVESTIGATOR",investigatorId:"lily_chen"});
    await send(host,{type:"SELECT_ANCIENT_ONE",ancientOneId:"azathoth"});await send(host,{type:"START_GAME"});
    const state=internal.toEngineState(),hostId=state.players[0]!.id,guestId=state.players[1]!.id;
    const source="spell_feed_the_mind_01";state.privateState.spells!.deck=state.privateState.spells!.deck.filter(id=>id!==source);state.privateState.spells!.heldByPlayer[hostId]=[source];
    state.players[1]!.locationId=state.players[0]!.locationId;state.actionsRemaining=1;state.players[0]!.skillImprovements.lore=1;
    internal.applyEngineState(state);
    internal.createEngineContext=()=>createDeterministicEngineContext({dice:Array(20).fill(6),ids:Array.from({length:30},(_,i)=>`room-${i}`),shuffleIndexes:Array(19).fill(0)});
    return {server,room,host,guest,internal,hostId,guestId,send};
  }
  it("detaches decisions and test dice on both snapshot boundaries",async()=>{
    const {host,internal,send}=await fixture();
    await send(host,{type:"CAST_SPELL",spellId:"spell_feed_the_mind"});
    const exported=internal.toEngineState(),before=structuredClone(exported);
    exported.pendingDecision!.optionIds.length=0;exported.activeTest!.dice[0]=1;
    assert.deepEqual(internal.toEngineState(),before);
    const imported=structuredClone(before);internal.applyEngineState(imported);
    imported.pendingDecision!.optionIds.length=0;imported.activeTest!.dice[0]=1;
    assert.deepEqual(internal.toEngineState(),before);
  });
  it("authorizes recipient, restores exact private continuation and reconnects",async()=>{
    const {server,room,host,guest,internal,hostId,guestId,send}=await fixture();
    const hostChoices:PendingDecision[]=[],guestChoices:PendingDecision[]=[];host.onMessage(pendingDecisionMessageType,d=>hostChoices.push(d));guest.onMessage(pendingDecisionMessageType,d=>guestChoices.push(d));
    await eventually(()=>host.state.players.get(hostId)?.castableSpellIds==="spell_feed_the_mind");
    await send(host,{type:"CAST_SPELL",spellId:"spell_feed_the_mind"});
    let state=internal.toEngineState();
    if(state.pendingDecision?.kind==="select_rerolls"){await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision.id,selectedOptionIds:[]});state=internal.toEngineState();}
    assert.equal(state.pendingDecision?.kind,"spell_target");
    await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:[guestId]});
    await eventually(()=>guestChoices.some(d=>d.kind==="spell_improvement"));
    state=internal.toEngineState();assert.equal(state.activePlayerId,hostId);assert.equal(state.actionsRemaining,1);
    assert.ok(!hostChoices.some(d=>d.kind==="spell_improvement"));
    const errors:unknown[]=[];host.onMessage(commandErrorMessageType,e=>errors.push(e));
    await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["improve:lore:2"]});
    await eventually(()=>errors.length>0);assert.deepEqual(internal.toEngineState(),state);
    const snapshot=JSON.parse(JSON.stringify(state)) as GameState;internal.applyEngineState(snapshot);snapshot.privateState.spellCasting!.pending!.sourcePhysicalId="forged";
    assert.throws(()=>internal.applyEngineState(snapshot),/Spell/);assert.deepEqual(internal.toEngineState(),state);
    const token=guest.reconnectionToken;guest.reconnection.enabled=false;guest.connection.close();await eventually(()=>!room.state.players.get(guestId)?.connected);
    const restored=await server.sdk.reconnect(token);const restoredChoices:PendingDecision[]=[];restored.onMessage(pendingDecisionMessageType,d=>restoredChoices.push(d));restored.send("request-seat-token");
    await eventually(()=>restoredChoices.some(d=>d.kind==="spell_improvement"));
    await send(restored,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["improve:lore:2"]});
    state=internal.toEngineState();assert.equal(state.players[1]!.skillImprovements.lore,2);
    assert.equal(state.pendingDecision?.playerId,guestId);
    await send(restored,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["decline"]});
    assert.equal(internal.toEngineState().privateState.spellCasting?.pending,undefined);
    for(const value of [room.state,host.state,restored.state,...hostChoices,...guestChoices,...restoredChoices]){
      const text=JSON.stringify(value);assert.doesNotMatch(text,/sourcePhysicalId|spell_feed_the_mind_0[12]|feedTheMindByPhysicalId/);assertNoPrivateSpellBackData([{path:"room Spell payload",text}],baseGameSpellBacks);
    }
  });
});
}
