import { z } from "zod";
import scans from "./remaining-card-scans.json" with { type: "json" };

const scanPath = z.string().regex(/^[a-z0-9/-]+\.jpg$/);
const sheetSchema = z.object({ file: scanPath, columns: z.number().int().min(1).max(8), rows: z.number().int().min(1).max(8),
  numbers: z.array(z.number().int().positive()).min(1), titles: z.array(z.string().min(1)).optional(), ids: z.array(z.string().regex(/^[a-z0-9_]+$/)).optional(),
}).strict().refine(sheet => sheet.numbers.length === sheet.columns * sheet.rows
  && (!sheet.titles || sheet.titles.length === sheet.numbers.length) && (!sheet.ids || sheet.ids.length === sheet.numbers.length), "Inconsistent scan layout.");
export const remainingCardScanManifest = z.object({ decks: z.array(z.object({
  id: z.string().regex(/^[a-z0-9_]+$/), family: z.enum(["research", "other_world", "expedition", "special", "artifact"]),
  backScan: scanPath, sheets: z.array(sheetSchema).min(1),
}).strict()).length(14) }).strict().parse(scans);

if (new Set(remainingCardScanManifest.decks.map(deck => deck.id)).size !== 14) throw new Error("Duplicate scan deck IDs.");
for (const deck of remainingCardScanManifest.decks) {
  const numbers = deck.sheets.flatMap(sheet => sheet.numbers);
  if (new Set(numbers).size !== numbers.length) throw new Error(`Duplicate printed numbers in ${deck.id}.`);
}
