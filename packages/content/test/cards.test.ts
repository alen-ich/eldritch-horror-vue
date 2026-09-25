import { describe, expect, it } from "vitest";
import { baseGameCards, cardImageUrl, validateCardContent } from "../src/index.js";

describe("base card content", () => {
  it("contains all 189 cards and eight card families", () => {
    expect(baseGameCards).toHaveLength(189);
    expect(new Set(baseGameCards.map((card) => card.card_type))).toHaveLength(8);
  });

  it("retains OCR review provenance", () => {
    expect(baseGameCards.filter((card) => card.extraction.review_required)).toHaveLength(78);
    expect(baseGameCards.every((card) => card.extraction.ocr_confidence >= 0 && card.extraction.ocr_confidence <= 100)).toBe(true);
  });

  it("maps relative bundle images to public application URLs", () => {
    expect(cardImageUrl(baseGameCards[0]!)).toBe("/cards/front/card_001.jpg");
    expect(cardImageUrl(baseGameCards[188]!, "back")).toBe("/cards/back/card_189.jpg");
  });

  it("rejects duplicate IDs", () => {
    const duplicate = { schema_version: "1.0", source_file: "test", card_count: 2, notes: [], cards: [baseGameCards[0], baseGameCards[0]] };
    expect(() => validateCardContent(duplicate)).toThrow(/duplicate IDs/);
  });
});
