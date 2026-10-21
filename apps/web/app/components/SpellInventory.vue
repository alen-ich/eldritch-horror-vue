<script setup lang="ts">
import { baseGameSpellFronts } from '@eldritch/content'
import type { SpellFrontId } from '@eldritch/protocol'

const props = defineProps<{ spellIds: readonly SpellFrontId[]; supplyTopId?: SpellFrontId; canCastFeedTheMind?: boolean }>()
const emit = defineEmits<{ cast: [spellId: "spell_feed_the_mind"] }>()
const held = computed(() => props.spellIds.flatMap(id => {
  const front = baseGameSpellFronts.find(card => card.id === id)
  return front ? [front] : []
}))
const supplyTop = computed(() => baseGameSpellFronts.find(card => card.id === props.supplyTopId))
</script>

<template>
  <section aria-label="Spell inventory" class="spell-inventory">
    <p class="spell-status">Feed the Mind supports casting. Other effects not implemented.</p>
    <h3>Held Spells</h3>
    <p v-if="!held.length">No Spells held</p>
    <div class="spell-cards">
      <article v-for="spell in held" :key="spell.id">
        <img :src="spell.frontImageUrl" :alt="spell.name">
        <div><h4>{{ spell.name }}</h4><p>{{ spell.trait }}</p><button v-if="spell.id === 'spell_feed_the_mind'" data-spell-cast :disabled="!props.canCastFeedTheMind" @click="emit('cast', 'spell_feed_the_mind')">Cast Feed the Mind</button></div>
      </article>
    </div>
    <h3>Spell supply · visible top</h3>
    <article v-if="supplyTop" class="supply-front">
      <img :src="supplyTop.frontImageUrl" :alt="supplyTop.name">
      <p>{{ supplyTop.name }}</p>
    </article>
    <p v-else>Spell supply is empty</p>
  </section>
</template>

<style scoped>
.spell-inventory { display: grid; gap: .65rem; }
.spell-inventory h3, .spell-inventory h4, .spell-inventory p { margin: 0; }
.spell-status { color: #cbb78e; }
.spell-cards { display: flex; flex-wrap: wrap; gap: 1rem; }
.spell-cards article, .supply-front { display: flex; align-items: center; gap: .8rem; }
.spell-inventory img { width: 5rem; height: auto; border-radius: .35rem; }
.spell-cards img { width: 7rem; }
</style>
