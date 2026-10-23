import { z } from "zod";
import { expeditionLocationIds, type ExpeditionLocationId } from "@eldritch/protocol";
import { baseGameScannedTokenEncounters } from "./token-encounters.js";

const setupCardSchema = z.object({ id: z.string().min(1), locationId: z.enum(expeditionLocationIds) }).strict();
const locationByDeck: Readonly<Record<string, ExpeditionLocationId>> = Object.fromEntries(
  expeditionLocationIds.map(locationId => [`expedition_${locationId}`, locationId]),
);

/** Setup metadata only: no front outcome or executable Expedition effect. */
export const baseGameExpeditionSetup: readonly { id: string; locationId: ExpeditionLocationId }[] =
  baseGameScannedTokenEncounters.filter(card => card.family === "expedition").map(card =>
    setupCardSchema.parse({ id: card.id, locationId: locationByDeck[card.deck] }),
  );

export function validateExpeditionSetupContent(cards: readonly { id: string; locationId: ExpeditionLocationId }[]): void {
  const parsed = z.array(setupCardSchema).length(18).parse(cards);
  const expected = new Map(baseGameExpeditionSetup.map(card => [card.id, card.locationId]));
  if (new Set(parsed.map(card => card.id)).size !== 18 || parsed.some(card => expected.get(card.id) !== card.locationId)
    || expeditionLocationIds.some(site => parsed.filter(card => card.locationId === site).length !== 3)) {
    throw new Error("Invalid base-game Expedition setup catalog.");
  }
}

validateExpeditionSetupContent(baseGameExpeditionSetup);
