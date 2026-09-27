export const cardTypes = [
  "expedition_encounter",
  "location_encounter_americas",
  "location_encounter_asia_australia",
  "location_encounter_europe",
  "mystery",
  "mythos",
  "other_world_encounter",
  "research_encounter",
  "special_encounter",
] as const;

export type CardType = (typeof cardTypes)[number];

export interface CardCatalogEntry {
  id: string;
  title: string;
  cardType: CardType;
  reviewRequired: boolean;
  thumbnailUrl: string;
}

export interface CardCatalogIndex {
  schemaVersion: "1.0";
  cardCount: number;
  cards: CardCatalogEntry[];
}
