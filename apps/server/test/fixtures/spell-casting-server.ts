// Isolated browser fixture. Never imported by production src/ or build.
import { defineServer, defineRoom } from "colyseus";
import { listen } from "@colyseus/tools";
import { baseGameSpells } from "@eldritch/content";
import { createDeterministicEngineContext, gainSpell, validateSpellInventory, type GameState, type GameContent, type EngineContext } from "@eldritch/engine";
import { commandMessageType, type GameCommand } from "@eldritch/protocol";
import { GameRoom } from "../../src/rooms/GameRoom.js";
class SpellCastingFixtureRoom extends GameRoom {
  private seeded=false;
  constructor(){
    super();const inherited=this.messages;
    this.messages={...inherited,[commandMessageType]:(client,payload)=>{
      inherited[commandMessageType](client,payload);
      if(this.seeded||this.state.phase!=="action")return;
      this.seeded=true;
      const internal=this as unknown as {toEngineState():GameState;applyEngineState(s:GameState):void};
      const state=internal.toEngineState(),caster=state.players[0]!;
      const copy="spell_feed_the_mind_01",deck=state.privateState.spells!.deck;
      if(caster.investigatorId==="norman_withers"){
        const held=state.privateState.spells!.heldByPlayer[caster.id]!;
        if(held.length!==1)throw Error("Norman must receive his production starting Spell.");
        if(held[0]!==copy){const index=deck.indexOf(copy);if(index<0)throw Error("Fixture copy unavailable.");deck[index]=held[0]!;held[0]=copy;}
        if(validateSpellInventory(state,baseGameSpells))throw Error("Fixture must conserve Spell inventory.");
        caster.skillImprovements.lore=1;state.players[1]!.locationId=caster.locationId;
        internal.applyEngineState(state);return;
      }
      state.privateState.spells!.deck=[...deck.filter(id=>id!==copy),copy];
      const content:GameContent={spells:baseGameSpells,map:{adjacentLocationIds:{},routes:[],locationTypes:{}},investigators:{},assets:[],mysteryIdsByAncientOne:{},mysteryTargetsById:{}};
      const gained=gainSpell(state,caster.id,{type:"kind",kind:"feed_the_mind"},content,this.fixtureContext());
      if(gained.ok === false)throw Error(gained.error.message);
      gained.state.players[0]!.skillImprovements.lore=1;
      gained.state.players[1]!.locationId=caster.locationId;
      internal.applyEngineState(gained.state);
    }};
  }
  private fixtureContext():EngineContext {return createDeterministicEngineContext({dice:Array(128).fill(6),ids:Array.from({length:32},(_,i)=>`fixture-${this.state.stateVersion}-${i}`),shuffleIndexes:Array(19).fill(0)});}
  protected override createEngineContext(command:GameCommand):EngineContext|undefined {
    return command.type==="CAST_SPELL"||this.state.activeTest?.continuation==="spell_cast"||this.state.pendingDecision?.continuation==="spell_cast_choice"?this.fixtureContext():super.createEngineContext(command);
  }
}
await listen(defineServer({rooms:{game:defineRoom(SpellCastingFixtureRoom)},express:app=>{app.get("/hi",(_req,res)=>res.send("Spell fixture"));}}),Number(process.env.PORT??2568));
