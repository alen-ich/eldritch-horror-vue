import assert from "node:assert/strict";
import { baseGameSpellBacks } from "../src/private-spell-backs.js";
import { privateFeedTheMindRules } from "../src/private-feed-the-mind.js";
describe("verified Feed the Mind handlers",()=>{
  it("binds typed behavior to the two visually verified physical reverses",()=>{
    assert.deepEqual(Object.keys(privateFeedTheMindRules.feedTheMindByPhysicalId).sort(),["spell_feed_the_mind_01","spell_feed_the_mind_02"]);
    const first=baseGameSpellBacks.find(card=>card.physicalId==="spell_feed_the_mind_01")!;
    assert.equal(first.printedNumber,1);assert.deepEqual(first.branches.map(b=>b.when),[{min:0,max:2},{min:3,max:null}]);
    assert.match(first.text,/unless you lose 2 Sanity/);assert.match(first.text,/improve 1 additional skill/);
    assert.equal(privateFeedTheMindRules.feedTheMindByPhysicalId[first.physicalId]!.type,"optional_sanity_loss_or_discard_then_optional_improve");
    const second=baseGameSpellBacks.find(card=>card.physicalId==="spell_feed_the_mind_02")!;
    assert.equal(second.printedNumber,2);assert.match(second.text,/roll any 4/);assert.match(second.text,/Lose 1 Sanity/);
    assert.equal(privateFeedTheMindRules.feedTheMindByPhysicalId[second.physicalId]!.type,"discard_unless_final_four_else_sanity_loss");
  });
});
