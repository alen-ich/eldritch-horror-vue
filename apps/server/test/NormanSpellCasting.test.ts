import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import { createDeterministicEngineContext, validateSpellInventory, type EngineContext, type GameState } from "@eldritch/engine";
import { baseGameSpells } from "@eldritch/content";
import { commandMessageType, commandErrorMessageType, pendingDecisionMessageType, type GameCommand, type PendingDecision } from "@eldritch/protocol";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
async function eventually(check:()=>boolean):Promise<void> { for(let n=0;n<100;n++){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(check()); }
export function registerNormanSpellCastingRoomTests(getServer:()=>ColyseusTestServer<typeof config>):void {
  describe("Norman Spell",()=>{
    async function fixture(){
      const server=getServer(),room=await server.createRoom<GameRoom>("game",{});
      const host=await server.connectTo(room,{displayName:"Norman"}),guest=await server.connectTo(room,{displayName:"Lily"});
      const internal=room as unknown as {toEngineState():GameState;applyEngineState(s:GameState):void;createEngineContext(c:GameCommand):EngineContext|undefined};
      async function send(client:typeof host,command:GameCommand,version=room.state.stateVersion){client.send(commandMessageType,{expectedStateVersion:version,command});await room.waitForMessage(commandMessageType);}
      await send(host,{type:"SELECT_INVESTIGATOR",investigatorId:"norman_withers"});await send(guest,{type:"SELECT_INVESTIGATOR",investigatorId:"lily_chen"});
      await send(host,{type:"SELECT_ANCIENT_ONE",ancientOneId:"azathoth"});await send(host,{type:"START_GAME"});
      const state=internal.toEngineState(),hostId=state.players[0]!.id,guestId=state.players[1]!.id;
      const context=()=>createDeterministicEngineContext({dice:Array(30).fill(6),ids:Array.from({length:40},(_,i)=>`norman-${room.state.stateVersion}-${i}`),shuffleIndexes:Array(19).fill(0)});
      const copy="spell_feed_the_mind_01",inventory=state.privateState.spells!,held=inventory.heldByPlayer[hostId]!;
      assert.equal(held.length,1);
      if(held[0]!==copy){const index=inventory.deck.indexOf(copy);assert.ok(index>=0);inventory.deck[index]=held[0]!;held[0]=copy;}
      assert.equal(validateSpellInventory(state,baseGameSpells),undefined);
      state.players[0]!.skillImprovements.lore=1;state.players[1]!.locationId=state.players[0]!.locationId;
      internal.applyEngineState(state);internal.createEngineContext=context;
      return {server,room,host,guest,internal,hostId,guestId,send};
    }
    it("rejects missing or corrupt new ledgers before any snapshot mutation",async()=>{
      const {host,internal,send}=await fixture();await send(host,{type:"CAST_SPELL",spellId:"spell_feed_the_mind"});
      const before=internal.toEngineState();
      for(const corrupt of [
        (s:GameState)=>{delete s.privateState.investigatorAbilityUsage;},
        (s:GameState)=>{s.privateState.investigatorAbilityUsage={schemaVersion:1,normanClueSubstitutions:[{playerId:"forged",investigatorId:"norman_withers",round:s.turnNumber}]};},
      ]){const snapshot=structuredClone(before);corrupt(snapshot);assert.throws(()=>internal.applyEngineState(snapshot),/ability|Norman/i);assert.deepEqual(internal.toEngineState(),before);}
      const exported=internal.toEngineState();exported.privateState.investigatorAbilityUsage!.normanClueSubstitutions.push({playerId:before.players[0]!.id,investigatorId:"norman_withers",round:before.turnNumber});assert.deepEqual(internal.toEngineState(),before);
      const imported=structuredClone(before);internal.applyEngineState(imported);imported.privateState.investigatorAbilityUsage!.normanClueSubstitutions.length=0;assert.deepEqual(internal.toEngineState(),before);
    });
    it("restores owner choices and pays once across reconnect, replay and other rooms",async()=>{
      const {server,room,host,guest,internal,hostId,send}=await fixture();
      const other=await server.createRoom<GameRoom>("game",{}),otherBefore=JSON.stringify(other.state);
      const hostChoices:PendingDecision[]=[],guestChoices:PendingDecision[]=[],errors:{code:string}[]=[];
      host.onMessage(pendingDecisionMessageType,d=>hostChoices.push(d));guest.onMessage(pendingDecisionMessageType,d=>guestChoices.push(d));guest.onMessage(commandErrorMessageType,e=>errors.push(e));
      await send(host,{type:"CAST_SPELL",spellId:"spell_feed_the_mind"});await eventually(()=>hostChoices.some(d=>d.optionIds.includes("norman-sanity:0")));
      const pending=internal.toEngineState(),id=pending.pendingDecision!.id;
      await send(guest,{type:"RESOLVE_DECISION",decisionId:id,selectedOptionIds:["norman-sanity:0"]});await eventually(()=>errors.length>0);assert.deepEqual(internal.toEngineState(),pending);
      const token=host.reconnectionToken;host.reconnection.enabled=false;host.connection.close();await eventually(()=>!room.state.players.get(hostId)?.connected);
      const restored=await server.sdk.reconnect(token),choices:PendingDecision[]=[],restoredErrors:{code:string}[]=[];
      restored.onMessage(pendingDecisionMessageType,d=>choices.push(d));restored.onMessage(commandErrorMessageType,e=>restoredErrors.push(e));restored.send("request-seat-token");
      await eventually(()=>choices.some(d=>d.id===id&&d.optionIds.includes("norman-sanity:0")));
      await send(restored,{type:"RESOLVE_DECISION",decisionId:id,selectedOptionIds:["norman-sanity:0"]},room.state.stateVersion-1);
      await eventually(()=>restoredErrors.some(e=>e.code==="STALE_STATE"));assert.equal(internal.toEngineState().players[0]!.sanity,7);
      await send(restored,{type:"RESOLVE_DECISION",decisionId:id,selectedOptionIds:["norman-sanity:0"]});
      const paid=internal.toEngineState();assert.equal(paid.players[0]!.sanity,6);assert.equal(paid.privateState.investigatorAbilityUsage!.normanClueSubstitutions.length,1);
      await eventually(()=>guest.state.players.get(hostId)?.sanity===6);assert.ok(!paid.pendingDecision?.optionIds.some(option=>option.startsWith("norman-sanity:")));
      await send(restored,{type:"RESOLVE_DECISION",decisionId:id,selectedOptionIds:["norman-sanity:0"]});assert.deepEqual(internal.toEngineState(),paid);
      internal.applyEngineState(JSON.parse(JSON.stringify(paid)) as GameState);assert.deepEqual(internal.toEngineState(),paid);
      for(const value of [room.state,guest.state,restored.state,...guestChoices])assert.doesNotMatch(JSON.stringify(value),/investigatorAbilityUsage|normanClueSubstitutions|norman-sanity:|sourcePhysicalId|feedTheMindByPhysicalId|private-card-assets/);
      assert.equal(JSON.stringify(other.state),otherBefore);
    });
    it("rejects a stripped completed-cast snapshot in a fresh destination",async()=>{
      const {server,host,internal,hostId,send}=await fixture();
      await send(host,{type:"CAST_SPELL",spellId:"spell_feed_the_mind"});
      let state=internal.toEngineState();
      await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["norman-sanity:0"]});state=internal.toEngineState();
      await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:[hostId]});state=internal.toEngineState();
      await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["improve:will:1"]});state=internal.toEngineState();
      await send(host,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["decline"]});state=internal.toEngineState();
      assert.equal(state.privateState.spellCasting?.pending,undefined);
      const destination=await server.createRoom<GameRoom>("game",{});
      const restored=destination as unknown as {toEngineState():GameState;applyEngineState(s:GameState):void};const before=restored.toEngineState();
      const damaged=structuredClone(state);delete damaged.privateState.investigatorAbilityUsage;
      assert.throws(()=>restored.applyEngineState(damaged),/ability|usage/i);assert.deepEqual(restored.toEngineState(),before);
      restored.applyEngineState(state);assert.deepEqual(restored.toEngineState().privateState.investigatorAbilityUsage,state.privateState.investigatorAbilityUsage);
    });
  });
}
