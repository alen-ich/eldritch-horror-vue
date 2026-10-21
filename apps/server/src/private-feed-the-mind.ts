import type { PrivateSpellCastingRules } from "@eldritch/engine";
/** Server-only physical mapping, verified against the paired crops on 2026-10-20.
 * Printed numbers happen to match these two suffixes; never generalize that rule. */
export const privateFeedTheMindRules: PrivateSpellCastingRules = {
  feedTheMindByPhysicalId: {
    spell_feed_the_mind_01: {type:"optional_sanity_loss_or_discard_then_optional_improve"},
    spell_feed_the_mind_02: {type:"discard_unless_final_four_else_sanity_loss"},
  },
};
