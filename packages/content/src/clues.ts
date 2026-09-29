import { locationIds, type LocationId } from "@eldritch/protocol";
import { z } from "zod";
import { baseGameLocations } from "./map.js";

export interface ClueTokenData {
  id: `clue_${LocationId}`;
  locationId: LocationId;
  imageUrl: string;
  backImageUrl: "/tokens/clues/back.webp";
  verification: "verified_from_scan";
}

export const baseGameClues: readonly ClueTokenData[] = baseGameLocations.map(({ id }) => ({
  id: `clue_${id}`,
  locationId: id,
  imageUrl: `/tokens/clues/${id}.webp`,
  backImageUrl: "/tokens/clues/back.webp",
  verification: "verified_from_scan",
}));

const clueSchema = z.object({
  id: z.string().regex(/^clue_[a-z0-9_]+$/),
  locationId: z.enum(locationIds),
  imageUrl: z.string().regex(/^\/tokens\/clues\/[a-z0-9_]+\.webp$/),
  backImageUrl: z.literal("/tokens/clues/back.webp"),
  verification: z.literal("verified_from_scan"),
}).strict();

export function validateClueContent(clues: readonly ClueTokenData[]): void {
  const parsed = z.array(clueSchema).length(locationIds.length).parse(clues);
  if (new Set(parsed.map(clue => clue.id)).size !== parsed.length) throw new Error("Clue IDs must be unique.");
  const locations = new Set(parsed.map(clue => clue.locationId));
  if (locations.size !== parsed.length || locationIds.some(id => !locations.has(id))) throw new Error("Clues must cover each base-game board space exactly once.");
  if (parsed.some(clue => clue.id !== `clue_${clue.locationId}` || clue.imageUrl !== `/tokens/clues/${clue.locationId}.webp`)) {
    throw new Error("Clue IDs and images must match their printed locations.");
  }
}

validateClueContent(baseGameClues);
