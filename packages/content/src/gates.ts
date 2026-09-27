import { locationIds, type LocationId } from "@eldritch/protocol";
import { z } from "zod";

export const gateOmenSymbols = ["comet", "constellation", "eclipse"] as const;
export type GateOmenSymbol = (typeof gateOmenSymbols)[number];

export const gateIds = [
  "gate_arkham",
  "gate_buenos_aires",
  "gate_istanbul",
  "gate_london",
  "gate_rome",
  "gate_san_francisco",
  "gate_shanghai",
  "gate_sydney",
  "gate_tokyo",
] as const;
export type GateId = (typeof gateIds)[number];

export interface GateData {
  id: GateId;
  locationId: LocationId;
  name: string;
  omenSymbol: GateOmenSymbol;
  imageUrl: string;
  backImageUrl: "/tokens/gates/back.webp";
  verification: "verified_from_scan";
}

const gateDefinitions = [
  { id: "gate_arkham", locationId: "arkham", name: "Arkham", omenSymbol: "eclipse" },
  { id: "gate_buenos_aires", locationId: "buenos_aires", name: "Buenos Aires", omenSymbol: "constellation" },
  { id: "gate_istanbul", locationId: "istanbul", name: "Istanbul", omenSymbol: "comet" },
  { id: "gate_london", locationId: "london", name: "London", omenSymbol: "constellation" },
  { id: "gate_rome", locationId: "rome", name: "Rome", omenSymbol: "eclipse" },
  { id: "gate_san_francisco", locationId: "san_francisco", name: "San Francisco", omenSymbol: "comet" },
  { id: "gate_shanghai", locationId: "shanghai", name: "Shanghai", omenSymbol: "eclipse" },
  { id: "gate_sydney", locationId: "sydney", name: "Sydney", omenSymbol: "eclipse" },
  { id: "gate_tokyo", locationId: "tokyo", name: "Tokyo", omenSymbol: "constellation" },
] as const satisfies readonly Omit<GateData, "imageUrl" | "backImageUrl" | "verification">[];

export const baseGameGates: readonly GateData[] = gateDefinitions.map((gate) => ({
  ...gate,
  imageUrl: `/tokens/gates/${gate.locationId}.webp`,
  backImageUrl: "/tokens/gates/back.webp",
  verification: "verified_from_scan",
}));

const gateSchema = z.object({
  id: z.enum(gateIds),
  locationId: z.enum(locationIds),
  name: z.string().min(1),
  omenSymbol: z.enum(gateOmenSymbols),
  imageUrl: z.string().regex(/^\/tokens\/gates\/[a-z_]+\.webp$/),
  backImageUrl: z.literal("/tokens/gates/back.webp"),
  verification: z.literal("verified_from_scan"),
}).strict();

export function validateGateContent(gates: readonly GateData[]): void {
  const parsed = z.array(gateSchema).length(gateIds.length).parse(gates);
  const ids = new Set(parsed.map(({ id }) => id));
  if (ids.size !== parsed.length) throw new Error("Gate content contains duplicate IDs.");
  if (gateIds.some((id) => !ids.has(id))) throw new Error("Gate content does not match the base-game roster.");
  const locations = new Set(parsed.map(({ locationId }) => locationId));
  if (locations.size !== parsed.length) throw new Error("Gate content contains duplicate locations.");
}

validateGateContent(baseGameGates);
