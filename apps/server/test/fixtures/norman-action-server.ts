// Isolated deterministic browser setup. Never imported by production sources.
import { defineServer, defineRoom } from "colyseus";
import { listen } from "@colyseus/tools";
import { baseGameGates } from "@eldritch/content";
import type { GameState } from "@eldritch/engine";
import { commandMessageType } from "@eldritch/protocol";
import { GameRoom } from "../../src/rooms/GameRoom.js";

class NormanActionFixtureRoom extends GameRoom {
  private seeded = false;
  constructor() {
    super();
    const inherited = this.messages;
    this.messages = { ...inherited, [commandMessageType]: (client, payload) => {
      inherited[commandMessageType](client, payload);
      if (this.seeded || this.state.phase !== "action") return;
      this.seeded = true;
      const internal = this as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), player = state.players[0]!;
      player.clues = 2;
      state.privateState.tokenPoolById[`held_clues:${player.id}`] = state.privateState.tokenPoolById.clues!.splice(0, 2);
      const cup = state.privateState.tokenPoolById.monsters!;
      for (const monster of state.monsters ?? []) cup.push(monster.monsterId);
      const gate = baseGameGates.find(candidate => candidate.id === state.activeGateIds![0])!;
      state.monsters = ["norman-target", "norman-other"].map(id => {
        const index = cup.indexOf("monster_cultist");
        if (index < 0) throw Error("Fixture requires conserved Cultist tokens.");
        cup.splice(index, 1);
        return { id, monsterId: "monster_cultist", locationId: gate.locationId, damage: 0 };
      });
      state.monsterLocationIds = [gate.locationId];
      player.locationId = gate.locationId === "arkham" ? "london" : "arkham";
      internal.applyEngineState(state);
    } };
  }
}
await listen(defineServer({ rooms: { game: defineRoom(NormanActionFixtureRoom) }, express: app => {
  app.get("/hi", (_req, res) => res.send("Norman action fixture"));
} }), Number(process.env.PORT ?? 2569));
