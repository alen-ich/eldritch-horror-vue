import { describe, expect, it } from "vitest";
import { baseGameCards, validateCardContent } from "../src/cards.js";

describe("base card content", () => {
  it("contains all 189 cards and nine card families", () => {
    expect(baseGameCards).toHaveLength(189);
    expect(new Set(baseGameCards.map((card) => card.card_type))).toHaveLength(9);
    expect(baseGameCards.filter((card) => card.card_type === "mystery")).toHaveLength(16);
  });

  it("retains OCR review provenance", () => {
    expect(baseGameCards.filter((card) => card.extraction.review_required)).toHaveLength(78);
    expect(baseGameCards.every((card) => card.extraction.ocr_confidence >= 0 && card.extraction.ocr_confidence <= 100)).toBe(true);
  });

  it("rejects duplicate IDs", () => {
    const duplicate = { schema_version: "1.0", source_file: "test", card_count: 2, notes: [], cards: [baseGameCards[0], baseGameCards[0]] };
    expect(() => validateCardContent(duplicate)).toThrow(/duplicate IDs/);
  });
});
