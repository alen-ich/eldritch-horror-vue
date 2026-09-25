import { z } from "zod";
import rawCardBundle from "./data/cards.json" with { type: "json" };
import { cardTypes } from "./card-types.js";

export * from "./card-types.js";

const cardIdSchema = z.string().regex(/^card_\d{3}$/);
const relativeImageSchema = z.string().regex(/^images\/(front|back)\/card_\d{3}\.jpg$/);

const cardSchema = z.object({
  id: cardIdSchema,
  card_type: z.enum(cardTypes),
  title: z.string().min(1),
  descriptions: z.array(z.string()).min(1),
  images: z.object({ front: relativeImageSchema, back: relativeImageSchema }).strict(),
  source: z.object({
    front_page: z.number().int().positive(),
    back_page: z.number().int().positive(),
    grid_row: z.number().int().min(1).max(3),
    grid_column: z.number().int().min(1).max(3),
    back_grid_column: z.number().int().min(1).max(3),
  }).strict(),
  extraction: z.object({
    ocr_text: z.string(),
    ocr_confidence: z.number().min(0).max(100),
    title_ocr_confidence: z.number().min(0).max(100),
    ocr_rotation_degrees: z.union([z.literal(0), z.literal(270)]),
    review_required: z.boolean(),
  }).strict(),
  title_source: z.enum([
    "generated_identifier_no_global_card_title",
    "normalized_from_card_image",
    "normalized_section_headings",
  ]),
}).strict();

const cardBundleSchema = z.object({
  schema_version: z.literal("1.0"),
  source_file: z.string().min(1),
  card_count: z.number().int().positive(),
  notes: z.array(z.string()),
  cards: z.array(cardSchema),
}).strict();

export type CardData = z.infer<typeof cardSchema>;
export type CardBundle = z.infer<typeof cardBundleSchema>;

export function validateCardContent(input: unknown): CardBundle {
  const bundle = cardBundleSchema.parse(input);
  if (bundle.card_count !== bundle.cards.length) throw new Error("Card count does not match the card records.");

  const ids = new Set(bundle.cards.map((card) => card.id));
  if (ids.size !== bundle.cards.length) throw new Error("Card content contains duplicate IDs.");

  bundle.cards.forEach((card, index) => {
    const expectedId = `card_${String(index + 1).padStart(3, "0")}`;
    if (card.id !== expectedId) throw new Error(`Card sequence is incomplete at ${expectedId}.`);
    if (card.images.front !== `images/front/${card.id}.jpg` || card.images.back !== `images/back/${card.id}.jpg`) {
      throw new Error(`Card image paths do not match ${card.id}.`);
    }
  });

  return bundle;
}

export const baseGameCardBundle = validateCardContent(rawCardBundle);
export const baseGameCards: readonly CardData[] = baseGameCardBundle.cards;
export const baseGameCardById: ReadonlyMap<string, CardData> = new Map(baseGameCards.map((card) => [card.id, card]));
