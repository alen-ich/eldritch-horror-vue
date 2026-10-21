import { baseGameSpells } from "@eldritch/content";
import { validatePrivateSpellBacks, type SpellBackRecord, type SpellBackInstructionTag } from "./private-spell-back-types.js";

/** Server-only transcription. [Strength] represents the printed Strength icon.
 * Physical copy IDs follow the existing sheet-slot mapping, NOT printed numbers.
 * No instruction in this catalog is executable. Verified against all 20 paired crops.
 */
type Row = readonly [min: number, max: number | null, text: string, ...tags: SpellBackInstructionTag[]];
function card(slot: number, printedNumber: 1 | 2, rows: readonly Row[]): SpellBackRecord {
  const front = baseGameSpells[slot]!;
  const branches = rows.map(([min, max, text, ...tags]) => ({ when: { min, max }, instructions: [{ text, tags }] }));
  const body = rows.map(([min, max, text]) => `${max === null ? `${min}+` : max === min ? min : `${min}–${max}`}: ${text}`).join("\n");
  return {
    physicalId: front.id, kind: front.kind, copy: front.copy as 1 | 2, printedNumber, sheetSlot: slot,
    sourceBackSheet: "source-assets/spells/back.jpg",
    privateAssetPath: `apps/server/private-card-assets/spells/${front.id}.webp`, verifiedOn: "2026-10-20",
    text: `${front.name}\nResolve the effect based on your test result:\n${body}\nThen flip this card.\n${printedNumber}`,
    branches, afterBranches: [{ text: "Then flip this card.", tags: ["flip"] }],
  };
}

export const baseGameSpellBacks: readonly SpellBackRecord[] = [
  card(0, 1, [
    [0, 0, "Your malformed magic lashes against your mind, and you fear your memories have been altered. If you did not roll any 4’s, discard this card.", "discard"],
    [1, null, "Your incantation inspires courage in the face of madness, but at the cost of your own blood. Lose 1 Health.", "resource_loss"],
  ]),
  card(1, 2, [
    [0, 0, "The magic warps your mind and thoughts until you can no longer tell reality from delusion. The chosen investigator loses 1 Sanity unless he gains a Hallucinations Condition.", "resource_loss", "condition_gain"],
    [1, 2, "The spell prevents any lingering effects of the traumatic experience. No additional effect.", "no_additional_effect"],
    [3, null, "The spell inspires and invigorates. Prevent that investigator from losing Sanity up to your test result instead.", "prevention_replacement"],
  ]),
  card(2, 2, [
    [0, 2, "Your chanting fills the air with ancient voices, and you fear the invocation has drained part of your life away. Lose 1 Health.", "resource_loss"],
    [3, null, "The goddess smiles upon your cause. Each investigator on your space that does not have a Blessed Condition gains a Blessed Condition.", "condition_gain"],
  ]),
  card(3, 1, [
    [0, 0, "The goddess has been angered, and her wrath is terrible to behold. The chosen investigator gains a Cursed Condition.", "condition_gain"],
    [1, 1, "You feel an almighty power surge through your mind and it is too much for your mind to handle. Lose 1 Sanity.", "resource_loss"],
    [2, null, "The goddess smiles upon your cause. No additional effect.", "no_additional_effect"],
  ]),
  card(4, 1, [
    [0, 1, "The ritual echoes in your head until it becomes gibberish. Discard this card unless you lose 2 Sanity.", "discard", "resource_loss"],
    [2, 2, "Your enemy’s flesh boils and peals away. No additional effect.", "no_additional_effect"],
    [3, null, "Flames and thick smoke envelop your target. The chosen Monster loses Health equal to your test result instead.", "monster_damage_replacement"],
  ]),
  card(5, 2, [
    [0, 0, "The spell backfires, searing your hands. Lose 2 Health.", "resource_loss"],
    [1, 1, "The distinct smell of burning flesh lets you know the spell has been cast correctly. Lose 1 Sanity.", "resource_loss"],
    [2, null, "The magic spreads, and the burning flesh peels from your enemies’ bodies. Each other Monster on your space also loses 2 Health.", "monster_damage"],
  ]),
  card(6, 1, [
    [0, 0, "Opening your mind wreaks havoc on your psyche. Discard this card unless you gain a Paranoia Condition.", "discard", "condition_gain"],
    [1, 2, "Your mind travels across the world, and the knowledge becomes clear. No additional effect.", "no_additional_effect"],
    [3, null, "The journey becomes clear to you, and the answer seems so simple. You may roll 1 additional die when resolving tests during the Research Encounter.", "test_bonus"],
  ]),
  card(7, 2, [
    [0, 0, "The knowledge gets lost in the void. Discard the chosen Clue.", "discard"],
    [1, 2, "The knowledge is too great for one mind to contain. Lose 1 Sanity.", "resource_loss"],
    [3, null, "Suddenly, the images and ideas coalesce into a new realization. Gain 1 Clue.", "resource_gain"],
  ]),
  card(8, 1, [
    [0, 2, "Casting the spell, you open yourself to terrible knowledge. Your mind is filled with gibberish, repeating endlessly. Discard this card unless you lose 2 Sanity.", "discard", "resource_loss"],
    [3, null, "You manipulate memories and potential knowledge with a practiced ease. The chosen investigator may improve 1 additional skill of his choice.", "skill_improvement"],
  ]),
  card(9, 2, [
    [0, 0, "You were unable to sufficiently focus your mind. You wonder if you simply lack the mental discipline this spell requires. If you did not roll any 4’s, discard this card.", "discard"],
    [1, null, "Casting your thought into the ether, your mind returns with strange knowledge. You may not entirely be the same person you were before. Lose 1 Sanity.", "resource_loss"],
  ]),
  card(10, 2, [
    [0, 0, "Something inside your chest shifts painfully. The chosen investigator loses 1 Health unless he gains an Internal Injury Condition.", "resource_loss", "condition_gain"],
    [1, 2, "The spell causes your skin to writhe and reform like a living being. No additional effect.", "no_additional_effect"],
    [3, null, "Flesh and bone mend themselves and harden against attack. Prevent that investigator from losing Health up to your test result instead.", "prevention_replacement"],
  ]),
  card(11, 1, [
    [0, 0, "The spell’s energy twists around you and locks your jaw shut as if it were forbidding you from speaking. You don’t know if you will be allowed to speak those words again. If you did not roll any 4’s, discard this card.", "discard"],
    [1, null, "It is unpleasant to watch this transformation, even when it succeeds. Lose 1 Sanity.", "resource_loss"],
  ]),
  card(12, 2, [
    [0, 1, "You remember that a swirling passage to an unknown world opened before you, but did you travel through it? If you did, where did you go? Discard this card unless you gain an Amnesia Condition.", "discard", "condition_gain"],
    [2, null, "You bend the fabric of space to your will, transporting the subject across the globe. No additional effect.", "no_additional_effect"],
  ]),
  card(13, 1, [
    [0, 0, "The portal closes abruptly, nearly severing you in half. The chosen investigator loses 3 Health.", "resource_loss"],
    [1, 2, "The ritual requires an exhausting amount of concentration. Lose 1 Sanity.", "resource_loss"],
    [3, null, "More than just warping space, you also manipulate time. You may perform an additional action.", "additional_action"],
  ]),
  card(14, 1, [
    [0, 1, "The spell’s dark energy turns against you, flooding your mind with madness. Discard this card unless you lose 2 Sanity.", "discard", "resource_loss"],
    [2, null, "The incantation takes effect with horrifying success. Lose 1 Sanity and gain +5 [Strength] during that encounter instead.", "resource_loss", "test_bonus"],
  ]),
  card(15, 2, [
    [0, 0, "The words must have been wrong. You suffer the damage you had hoped to inflict. Discard this card unless you gain an Internal Injury Condition.", "discard", "condition_gain"],
    [1, 1, "The spell compacts and twists the target’s body. Lose 1 Sanity.", "resource_loss"],
    [2, null, "The magic ripples and surges through the target once more. You may reroll 1 die when resolving the [Strength] test.", "reroll"],
  ]),
  card(16, 1, [
    [0, 0, "What could you have possibly forgotten? Why didn’t the spell work? If you did not roll any 4’s, discard this card.", "discard"],
    [1, 3, "For a moment, your mind is exposed to a powerful intelligence, dwelling between worlds. Lose 1 Sanity.", "resource_loss"],
    [4, null, "The magic is powerful and beyond your expectations. Gain 1 additional Item or Trinket Asset from the reserve.", "asset_gain"],
  ]),
  card(17, 2, [
    [0, 0, "You can feel that the spell has not worked the way you hoped. Discard this card unless you discard 1 Item Asset.", "discard"],
    [1, 1, "Something unnatural tries to pull the object away from you. Lose 1 Sanity.", "resource_loss"],
    [2, null, "All of your wishes materialize before your eyes. You may gain any number of Item or Trinket Assets from the reserve with total value equal to or less than your test result.", "asset_gain"],
  ]),
  card(18, 1, [
    [0, 1, "A thick, black fog engulfs you, choking your lungs and stinging your eyes. Lose 1 Health and 1 Sanity.", "resource_loss"],
    [2, null, "You walk forward boldly, knowing the mists will keep you hidden. No additional effect.", "no_additional_effect"],
  ]),
  card(19, 2, [
    [0, 0, "You see a monstrous form vanish into the fog. Whatever it was, you fear it may return the next time you recite the incantation. Discard this card unless you gain a Hallucinations Condition.", "discard", "condition_gain"],
    [1, null, "Although you are hidden by the darkness, you feel unnatural tendrils of fog wrapping around your body. Lose 1 Sanity.", "resource_loss"],
  ]),
];
validatePrivateSpellBacks(baseGameSpellBacks);
