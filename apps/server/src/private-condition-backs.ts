import { baseGameConditions } from "@eldritch/content";

/** Server-only mechanical transcription of the supplied English backs, in front-sheet slot order. */
export const baseGameConditionBacks = [
  { title: "Hitmen", text: "You see now that it was no ordinary bank you borrowed from. Some armed men confront you and demand that you repay what you owe. Test Strength. If you fail, lose 3 Health. Then discard this card." },
  { title: "Unwilling Servant", text: "A sorcerer holds you down and carves a symbol into your forehead. Test Will. If you fail, you have no recollection of your actions; gain an Amnesia Condition. Then discard this card." },
  { title: "Debt Collector", text: "The man in the silk suit hands you a large stack of papers and asks you to fill them out. Test Influence. If you fail, discard 2 Item possessions. Then discard this card." },
  { title: "Local Authorities", text: "Someone was asking about you, says a fellow traveler. Test Observation. If you fail, move to the nearest City space and gain a Detained Condition unless you discard 1 Ally Asset. Then discard this card." },
  { title: "Make a Deal", text: "An intruder offers to help in exchange for an undefined favor. You may gain a Dark Pact Condition. If you do not, advance Doom by 1. Then discard this card." },
  { title: "Beyond Riches", text: "A man accuses you of stealing part of your identity. Test Will. If you fail, lose 3 Sanity. Then discard this card." },
  { title: "The Terrible Truth", text: "Memories of a profane ritual return to you. Gain a Dark Pact Condition. Then discard this card." },
  { title: "Unexplained Debts", text: "Your paperwork records a loan with unspecified promises of repayment. Gain a Debt Condition. Then discard this card." },
  { title: "Forgotten Crimes", text: "You went on a crime spree you cannot recall. Gain a Detained Condition. Then discard this card." },
  { title: "Pact with Yog-Sothoth", text: "Spawn 1 Gate for each Spell you have, then advance the Omen by 1. Then discard this card." },
  { title: "Pact with the Dark Man", text: "The day has come to fulfill your bargain. You are devoured." },
  { title: "One of the Thousand", text: "A cult leader says the Black Goat has come to collect her due. Another investigator of your choice is devoured. Then discard this card." },
  { title: "Twisted Knee", text: "Lose 2 Health unless you become Delayed. Then flip this card." },
  { title: "Stabbing Pain", text: "Become Delayed. Then flip this card." },
  { title: "Strange Remedy", text: "Lose 1 Health. You may become Delayed to discard this card. If you do not discard it, flip this card." },
  { title: "Cracked Rib", text: "Lose 1 Health. Then flip this card." },
  { title: "Excruciating Pain", text: "Lose 3 Health. Then discard this card." },
  { title: "Internal Bleeding", text: "Lose 1 Health and become Delayed. Then discard this card." },
  { title: "Kleptomania", text: "Gain 1 random Item Asset from the deck. Then test Observation. If your test result is less than that Asset's value, discard it and gain a Detained Condition. Then discard this card." },
  { title: "Violent Outbursts", text: "Each other investigator on your space loses 2 Health and you discard 1 Ally Asset. Then flip this card." },
  { title: "Agoraphobia", text: "If you are on a City space, the presence of other people drives you to distraction; lose 2 Sanity. Then flip this card." },
  { title: "Harried", text: "If there is a Monster on your space, only 6s count as successes on your tests. Then flip this card." },
  { title: "Karmic Justice", text: "Discard this card." },
  { title: "The Innsmouth Look", text: "If you are on a Sea space, you are devoured. Otherwise, lose 3 Health and discard this card." },
  { title: "Delusions", text: "Discard all of your Clues. Then discard this card." },
  { title: "The Voices", text: "Lose 1 Sanity. Then flip this card." },
  { title: "Swarming", text: "Lose 3 Sanity. Then discard this card." },
  { title: "Starvation", text: "Spend 1 Clue or test Will -1. If you fail, lose 3 Health and gain an Internal Injury Condition. Then discard this card." },
  { title: "Holding Cell", text: "Spend 1 Clue or test Strength -1. If you fail, lose 2 Health and 2 Sanity. Then discard this card." },
  { title: "Cruel and Unusual", text: "Spend 1 Clue or test Will -1. If you fail, lose 3 Sanity and gain a Paranoia Condition. Then discard this card." },
  { title: "Beloved of Bast", text: "Recover 2 Health and 2 Sanity. Then flip this card." },
  { title: "Visions of Hypnos", text: "Gain 2 Clues. Then flip this card." },
  { title: "Blessing of Nodens", text: "You may discard 1 Monster of your choice. Then flip this card." },
  { title: "Nerve Damage", text: "Discard 1 Item possession. Then flip this card." },
  { title: "Muscle Spasms", text: "Discard 1 Item possession and become Delayed. Then discard this card." },
  { title: "Fractured Spine", text: "Discard all but 1 of your Item possessions. Then discard this card." },
] as const;

export const privateConditionBackById: Readonly<Record<string, { title: string; text: string }>> =
  Object.fromEntries(baseGameConditions.map((card, index) => [card.id, baseGameConditionBacks[index]]));
