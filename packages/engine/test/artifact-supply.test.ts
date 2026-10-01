import { describe, expect, it } from "vitest";
import { baseGameArtifacts } from "../../content/src/artifacts.js";
import { buildArtifactDeck, createLobby, executeCommand, gainNamedArtifact, projectPublicState, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  artifacts: baseGameArtifacts.map(({ id }) => ({ id })),
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(): GameState {
  const before = createLobby(["host", "guest"]);
  before.phase = "encounter"; before.ancientOneId = "azathoth"; before.doom = 10;
  before.activePlayerId = before.leadInvestigatorId = "host";
  before.players[0] = { ...before.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, artifactIds: [] };
  before.privateState.deckOrderById.artifacts = content.artifacts!.map(card => card.id);
  return before;
}
describe("physical Artifact foundation", () => {
  it("builds 14 unique physical cards in injected private order", () => {
    const ids = content.artifacts!.map(card => card.id);
    expect(buildArtifactDeck(ids, cards => [...cards].reverse())).toEqual([...ids].reverse());
    expect(ids).toHaveLength(14);
    expect(() => buildArtifactDeck([ids[0]!, ids[0]!], cards => [...cards])).toThrow();
    expect(() => buildArtifactDeck(["unknown"], cards => [...cards])).toThrow();
  });
  it("transfers the named T'tka Halot copy without disturbing remaining order or leaking it", () => {
    const before = state();
    const result = gainNamedArtifact(before, "host", "artifact_ttka_halot", content);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.artifactIds).toEqual(["artifact_ttka_halot"]);
    expect(result.state.privateState.deckOrderById.artifacts).toEqual(before.privateState.deckOrderById.artifacts!.filter(id => id !== "artifact_ttka_halot"));
    expect(result.events).toEqual([{ type: "ARTIFACT_GAINED", playerId: "host", artifactId: "artifact_ttka_halot" }]);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("artifact_grotesque_statue");
    expect(gainNamedArtifact(result.state, "guest", "artifact_ttka_halot", content)).toMatchObject({ ok: false, error: { code: "ARTIFACT_UNAVAILABLE" } });
    expect(before.players[0]?.artifactIds).toEqual([]);
    const publicCopy = projectPublicState(result.state);
    publicCopy.players[0]!.artifactIds!.push("invented");
    expect(result.state.players[0]?.artifactIds).toEqual(["artifact_ttka_halot"]);
  });
  it("rejects missing components, duplicates, unknown IDs and unsupported printed effects atomically", () => {
    for (const invalid of ["missing", "duplicate", "unknown", "owned"] as const) {
      const before = state();
      if (invalid === "missing") delete before.privateState.deckOrderById.artifacts;
      if (invalid === "duplicate") before.privateState.deckOrderById.artifacts!.push("artifact_ttka_halot");
      if (invalid === "unknown") before.privateState.deckOrderById.artifacts![0] = "artifact_unknown";
      if (invalid === "owned") before.players[1]!.artifactIds = ["artifact_ttka_halot"];
      const snapshot = structuredClone(before);
      expect(gainNamedArtifact(before, "host", "artifact_ttka_halot", content).ok).toBe(false);
      expect(before).toEqual(snapshot);
    }
    expect(gainNamedArtifact(state(), "host", "artifact_grotesque_statue", content)).toMatchObject({ ok: false, error: { code: "ARTIFACT_EFFECT_UNSUPPORTED" } });
  });
  it("rejects lobby, ended games, defeated recipients and nonmembers", () => {
    const before = state();
    expect(gainNamedArtifact(before, "unknown", "artifact_ttka_halot", content).ok).toBe(false);
    before.phase = "lobby";
    expect(gainNamedArtifact(before, "host", "artifact_ttka_halot", content).ok).toBe(false);
    before.phase = "encounter"; before.players[0]!.defeated = true;
    expect(gainNamedArtifact(before, "host", "artifact_ttka_halot", content).ok).toBe(false);
    before.players[0]!.defeated = false; before.gameResult = "investigators_lose";
    expect(gainNamedArtifact(before, "host", "artifact_ttka_halot", content).ok).toBe(false);
  });
  it("sets aside Artifacts on the defeated sheet instead of returning or duplicating them", () => {
    const granted = gainNamedArtifact(state(), "host", "artifact_ttka_halot", content);
    if (!granted.ok) throw new Error(granted.error.message);
    const before = granted.state;
    before.players[0]!.defeated = true;
    before.pendingDefeat = { playerId: "host", causes: ["health"], cityIds: ["arkham"] };
    const result = executeCommand(before, "host", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "guest" }, content);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.artifactIds).toEqual([]);
    expect(result.state.defeatedInvestigators?.[0]?.artifactIds).toEqual(["artifact_ttka_halot"]);
    expect(result.state.privateState.deckOrderById.artifacts).not.toContain("artifact_ttka_halot");
    expect(gainNamedArtifact(result.state, "guest", "artifact_ttka_halot", content)).toMatchObject({ ok: false, error: { code: "ARTIFACT_UNAVAILABLE" } });
  });
});
