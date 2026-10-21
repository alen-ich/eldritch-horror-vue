import { z } from "zod";
import type { SpellFrontId } from "@eldritch/protocol";

export const spellKinds = ["instill_bravery", "blessing_of_isis", "shriveling", "clairvoyance", "feed_the_mind", "flesh_ward", "plumb_the_void", "wither", "conjuration", "mists_of_releh"] as const;
export type SpellKind = (typeof spellKinds)[number];
export type SpellTrait = "incantation" | "ritual";
export type SpellTiming = "action" | "encounter" | "combat" | "prevent_health_loss" | "prevent_sanity_loss";

export interface SpellCard {
  id: string;
  kind: SpellKind;
  name: string;
  trait: SpellTrait;
  timing: SpellTiming;
  loreModifier: number;
  copy: number;
  frontText: string;
  frontImageUrl: string;
  sourceFrontSheet: "source-assets/spells/front.jpg";
  sourceBackSheet: "source-assets/spells/back.jpg";
  sheetSlot: number;
  backVisibility: "server_only";
  backTextStatus: "verified";
  effectStatus: "not_executable" | "scoped_executable";
}

const definitions = [
  { kind: "instill_bravery", name: "Instill Bravery", trait: "incantation", timing: "prevent_sanity_loss", loreModifier: 0, frontText: "Once per round, when an investigator would lose Sanity, you may test Lore. If you pass, prevent that investigator from losing up to 2 Sanity. Then flip this card." },
  { kind: "blessing_of_isis", name: "Blessing of Isis", trait: "ritual", timing: "action", loreModifier: -1, frontText: "Action: Test Lore -1. If you pass, choose an investigator on your space without a Blessed Condition to gain a Blessed Condition. Then flip this card." },
  { kind: "shriveling", name: "Shriveling", trait: "ritual", timing: "action", loreModifier: 0, frontText: "Action: Test Lore. If you pass, choose a Monster on your space to lose 2 Health. Then flip this card." },
  { kind: "clairvoyance", name: "Clairvoyance", trait: "incantation", timing: "encounter", loreModifier: 0, frontText: "During the Encounter Phase, you may test Lore. If you pass, you may encounter a Clue as if on its space, ignoring Monsters there. Then flip this card." },
  { kind: "feed_the_mind", name: "Feed the Mind", trait: "ritual", timing: "action", loreModifier: -1, frontText: "Action: Test Lore -1. If you pass, choose an investigator on your space to improve one skill of his choice. Then flip this card." },
  { kind: "flesh_ward", name: "Flesh Ward", trait: "incantation", timing: "prevent_health_loss", loreModifier: 0, frontText: "Once per round, when an investigator would lose Health, you may test Lore. If you pass, prevent that investigator from losing up to 2 Health. Then flip this card." },
  { kind: "plumb_the_void", name: "Plumb the Void", trait: "ritual", timing: "action", loreModifier: -1, frontText: "Action: Test Lore -1. If you pass, an investigator of your choice may move to any space. Then flip this card." },
  { kind: "wither", name: "Wither", trait: "incantation", timing: "combat", loreModifier: 0, frontText: "When resolving a Combat Encounter, you may test Lore. If you pass, gain +3 Strength during that encounter. Then flip this card." },
  { kind: "conjuration", name: "Conjuration", trait: "ritual", timing: "action", loreModifier: 1, frontText: "Action: Test Lore +1. If you pass, you may gain one Item or Trinket Asset from the Reserve with value at most your test result. Then flip this card." },
  { kind: "mists_of_releh", name: "Mists of Releh", trait: "incantation", timing: "encounter", loreModifier: 0, frontText: "During the Encounter Phase, you may test Lore. If you pass, you may choose an encounter as if there are no Monsters on your space. Then flip this card." },
] as const satisfies readonly { kind: SpellKind; name: string; trait: SpellTrait; timing: SpellTiming; loreModifier: number; frontText: string }[];

export const baseGameSpells: readonly SpellCard[] = definitions.flatMap((definition, index) =>
  [1, 2].map(copy => {
    const id = `spell_${definition.kind}_${String(copy).padStart(2, "0")}`;
    return {
      ...definition,
      id,
      copy,
      frontImageUrl: `/cards/spells/${id}.webp`,
      sourceFrontSheet: "source-assets/spells/front.jpg" as const,
      sourceBackSheet: "source-assets/spells/back.jpg" as const,
      sheetSlot: index * 2 + copy - 1,
      backVisibility: "server_only" as const,
      backTextStatus: "verified" as const,
      effectStatus: definition.kind === "feed_the_mind" ? "scoped_executable" as const : "not_executable" as const,
    };
  }),
);

const spellSchema = z.object({
  id: z.string().regex(/^spell_[a-z_]+_\d{2}$/),
  kind: z.enum(spellKinds),
  name: z.string().min(1),
  trait: z.enum(["incantation", "ritual"]),
  timing: z.enum(["action", "encounter", "combat", "prevent_health_loss", "prevent_sanity_loss"]),
  loreModifier: z.number().int(),
  copy: z.number().int().min(1).max(2),
  frontText: z.string().min(1),
  frontImageUrl: z.string().startsWith("/cards/spells/"),
  sourceFrontSheet: z.literal("source-assets/spells/front.jpg"),
  sourceBackSheet: z.literal("source-assets/spells/back.jpg"),
  sheetSlot: z.number().int().min(0).max(19),
  backVisibility: z.literal("server_only"),
  backTextStatus: z.literal("verified"),
  effectStatus: z.enum(["not_executable", "scoped_executable"]),
}).strict();

export function validateSpellContent(cards: readonly SpellCard[]): void {
  spellSchema.array().length(20).parse(cards);
  if (new Set(cards.map(card => card.id)).size !== cards.length) throw new Error("Duplicate Spell card IDs.");
  for (const [index, card] of cards.entries()) {
    const definition = definitions[Math.floor(index / 2)]!;
    const copy = index % 2 + 1;
    if (card.effectStatus !== (definition.kind === "feed_the_mind" ? "scoped_executable" : "not_executable") || card.kind !== definition.kind || card.name !== definition.name || card.trait !== definition.trait
      || card.timing !== definition.timing || card.loreModifier !== definition.loreModifier || card.frontText !== definition.frontText
      || card.copy !== copy || card.id !== `spell_${definition.kind}_${String(copy).padStart(2, "0")}`
      || card.frontImageUrl !== `/cards/spells/${card.id}.webp` || card.sheetSlot !== index) {
      throw new Error(`Invalid Spell card mapping: ${card.id}.`);
    }
  }
}

validateSpellContent(baseGameSpells);

/** Always use the same front artwork, independently of the held physical copy. */
export const baseGameSpellFronts: readonly { id: SpellFrontId; name: string; trait: SpellTrait; frontImageUrl: string }[] = definitions.map(card => ({
  id: `spell_${card.kind}`,
  name: card.name,
  trait: card.trait,
  frontImageUrl: `/cards/spells/spell_${card.kind}_01.webp`,
}));

export function spellExecutionSupport(frontId: SpellFrontId): "feed_the_mind" | "unsupported" {
  return frontId === "spell_feed_the_mind" ? "feed_the_mind" : "unsupported";
}
