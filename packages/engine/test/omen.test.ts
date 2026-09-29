import { describe, expect, it } from "vitest";
import { advanceOmen, type GameContent, type GameState } from "../src/index.js";
import { advanceOmenTrack, omenTrack } from "../src/omen.js";

describe("Omen track", () => {
  it("follows the printed comet, constellation, eclipse, constellation clockwise order", () => {
    expect(omenTrack).toEqual(["comet", "constellation", "eclipse", "constellation"]);
    expect(advanceOmenTrack(0, 1, ["constellation", "constellation", "comet"]))
      .toEqual({ position: 1, symbol: "constellation", enteredSymbols: ["constellation"], doomAdvanceFromGates: 2 });
  });

  it("counts each entered space, including both constellation spaces and a wrap to green", () => {
    expect(advanceOmenTrack(0, 4, ["comet", "constellation", "eclipse"]))
      .toEqual({ position: 0, symbol: "comet", enteredSymbols: ["constellation", "eclipse", "constellation", "comet"], doomAdvanceFromGates: 4 });
    expect(advanceOmenTrack(3, 1, ["comet"])).toMatchObject({ position: 0, doomAdvanceFromGates: 1 });
    expect(advanceOmenTrack(2, 0, ["eclipse"])).toMatchObject({ position: 2, enteredSymbols: [], doomAdvanceFromGates: 0 });
  });

  it("does not advance Doom without a matching active Gate", () => {
    expect(advanceOmenTrack(0, 1, ["comet", "eclipse"]).doomAdvanceFromGates).toBe(0);
  });

  it("rejects invalid positions and step counts", () => {
    expect(() => advanceOmenTrack(-1, 1, [])).toThrow(/position/);
    expect(() => advanceOmenTrack(4, 1, [])).toThrow(/position/);
    expect(() => advanceOmenTrack(0, -1, [])).toThrow(/nonnegative/);
    expect(() => advanceOmenTrack(0, 1.5, [])).toThrow(/nonnegative/);
  });
});

const omenContent: GameContent = {
  gates: [
    { id: "gate_london", locationId: "london", omenSymbol: "constellation" },
    { id: "gate_tokyo", locationId: "tokyo", omenSymbol: "constellation" },
    { id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" },
  ],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: {} },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function mythosState(): GameState {
  return {
    stateVersion: 4, phase: "mythos", players: [], turnNumber: 1, actionsRemaining: 0,
    performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    ancientOneId: "cthulhu", omen: 0, doom: 12, activeGateIds: ["gate_london", "gate_tokyo", "gate_arkham"],
    privateState: { deckOrderById: {}, tokenPoolById: {} },
  };
}

describe("authoritative Mythos Omen effect", () => {
  it("counts only matching active Gates and advances state once", () => {
    const before = mythosState();
    const result = advanceOmen(before, omenContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.omen).toBe(1);
    expect(result.state.doom).toBe(10);
    expect(result.state.stateVersion).toBe(5);
    expect(result.events).toEqual([{ type: "OMEN_ADVANCED", position: 1, symbol: "constellation", doomAdvance: 2 }]);
    expect(before.omen).toBe(0);
    expect(before.doom).toBe(12);
  });

  it("applies Azathoth's green-space Eldritch tokens and its immediate loss", () => {
    const before = mythosState();
    before.ancientOneId = "azathoth";
    before.omen = 3;
    before.doom = 2;
    before.greenOmenTokens = 2;
    const result = advanceOmen(before, omenContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.omen).toBe(0);
    expect(result.state.doom).toBe(0);
    expect(result.state.gameResult).toBe("investigators_lose");
    expect(result.events.map(event => event.type)).toEqual(["OMEN_ADVANCED", "GAME_ENDED"]);
  });

  it("rejects missing Gate content and unsupported awakening without mutation", () => {
    const missing = mythosState();
    missing.activeGateIds = ["gate_missing"];
    expect(advanceOmen(missing, omenContent)).toMatchObject({ ok: false, error: { code: "GATE_CONTENT_MISSING" } });
    const awakening = mythosState();
    awakening.doom = 2;
    expect(advanceOmen(awakening, omenContent)).toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(awakening.omen).toBe(0);
    expect(awakening.doom).toBe(2);
    expect(awakening.stateVersion).toBe(4);
  });
});
