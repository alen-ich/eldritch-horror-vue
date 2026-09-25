<script setup lang="ts">
import { baseGameCards, cardImageUrl, cardTypes, type CardData, type CardType } from '@eldritch/content'

const pageSize = 12
const query = ref('')
const selectedType = ref<'all' | CardType>('all')
const page = ref(1)
const activeCard = ref<CardData>()
const activeSide = ref<'front' | 'back'>('front')

const typeLabels: Record<CardType, string> = {
  expedition_encounter: 'Expedition',
  location_encounter_americas: 'Americas',
  location_encounter_asia_australia: 'Asia / Australia',
  location_encounter_europe: 'Europe',
  mythos: 'Mythos',
  other_world_encounter: 'Other World',
  research_encounter: 'Research',
  special_encounter: 'Special',
}

const filteredCards = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return baseGameCards.filter((card) => {
    const matchesType = selectedType.value === 'all' || card.card_type === selectedType.value
    const matchesSearch = !search || `${card.id} ${card.title}`.toLocaleLowerCase().includes(search)
    return matchesType && matchesSearch
  })
})
const pageCount = computed(() => Math.max(1, Math.ceil(filteredCards.value.length / pageSize)))
const visibleCards = computed(() => filteredCards.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([query, selectedType], () => { page.value = 1 })

function openCard(card: CardData) {
  activeCard.value = card
  activeSide.value = 'front'
}
</script>

<template>
  <section class="card-catalog panel">
    <div class="catalog-heading">
      <div><p class="chapter">Card archive · {{ baseGameCards.length }}</p><h2>Browse the supplied card set</h2></div>
      <p class="catalog-note">OCR text is reference data. Cards marked “review” should be checked against their scan.</p>
    </div>
    <div class="catalog-controls">
      <label>Search<input v-model="query" type="search" placeholder="Title or card_001"></label>
      <label>Card family<select v-model="selectedType"><option value="all">All families</option><option v-for="type in cardTypes" :key="type" :value="type">{{ typeLabels[type] }}</option></select></label>
      <span>{{ filteredCards.length }} matches</span>
    </div>
    <div v-if="visibleCards.length" class="card-grid">
      <button v-for="card in visibleCards" :key="card.id" class="card-tile" @click="openCard(card)">
        <img :src="cardImageUrl(card)" :alt="`${card.title} card front`" loading="lazy">
        <span><strong>{{ card.title }}</strong><small>{{ typeLabels[card.card_type] }} · {{ card.id }}</small></span>
        <b v-if="card.extraction.review_required" class="review">Review</b>
      </button>
    </div>
    <p v-else class="empty">No cards match those filters.</p>
    <nav class="pagination" aria-label="Card catalog pages">
      <button :disabled="page === 1" @click="page--">Previous</button><span>Page {{ page }} of {{ pageCount }}</span><button :disabled="page === pageCount" @click="page++">Next</button>
    </nav>

    <div v-if="activeCard" class="card-modal" role="dialog" aria-modal="true" :aria-label="activeCard.title" @click.self="activeCard = undefined">
      <article>
        <button class="close" aria-label="Close card" @click="activeCard = undefined">×</button>
        <img :src="cardImageUrl(activeCard, activeSide)" :alt="`${activeCard.title} card ${activeSide}`">
        <div class="card-detail">
          <p class="chapter">{{ typeLabels[activeCard.card_type] }} · {{ activeCard.id }}</p>
          <h2>{{ activeCard.title }}</h2>
          <div class="side-toggle"><button :class="{ active: activeSide === 'front' }" @click="activeSide = 'front'">Front</button><button :class="{ active: activeSide === 'back' }" @click="activeSide = 'back'">Back</button></div>
          <p v-if="activeCard.extraction.review_required" class="warning">Machine extraction requires review; rely on the scan for authoritative card text.</p>
          <p>OCR confidence: {{ activeCard.extraction.ocr_confidence }}%</p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.card-catalog { margin-top: 18px; padding: 28px; }
.catalog-heading { display: flex; justify-content: space-between; gap: 24px; align-items: end; }.catalog-heading h2 { margin-bottom: 0; }.catalog-note { max-width: 420px; margin: 0; color: #93a7a7; font-size: .78rem; line-height: 1.5; }
.catalog-controls { display: grid; grid-template-columns: 1fr 220px auto; align-items: end; gap: 12px; margin: 24px 0; }.catalog-controls > span { color: #91a7a8; padding: 13px 0; font-size: .76rem; }
select { color: #f6f2df; background: #07171c; border: 1px solid #47636a; border-radius: 9px; padding: 12px 14px; }
.card-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }.card-tile { position: relative; overflow: hidden; text-align: left; color: #edf0df; background: #0a1c21; border: 1px solid #345159; border-radius: 10px; padding: 0; }.card-tile:hover { border-color: #d5aa63; transform: translateY(-2px); }.card-tile img { display: block; width: 100%; aspect-ratio: 744 / 1040; object-fit: cover; object-position: top; }.card-tile > span { display: grid; gap: 4px; padding: 10px; }.card-tile strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .76rem; }.card-tile small { color: #91a7a8; font-size: .6rem; }.review { position: absolute; top: 7px; right: 7px; color: #24180b; background: #e6b56b; border-radius: 999px; padding: 4px 6px; font-size: .52rem; text-transform: uppercase; letter-spacing: .06em; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 22px; }.pagination button, .side-toggle button { color: #edf0df; background: #29464e; border: 0; border-radius: 8px; padding: 9px 13px; }.pagination span { color: #91a7a8; font-size: .75rem; }.empty { color: #91a7a8; text-align: center; padding: 50px; }
.card-modal { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 24px; background: #02090ce8; }.card-modal article { position: relative; display: grid; grid-template-columns: minmax(260px, 440px) minmax(260px, 390px); max-height: calc(100vh - 48px); overflow: auto; background: #10272d; border: 1px solid #45636b; border-radius: 16px; box-shadow: 0 30px 100px #000; }.card-modal img { width: 100%; max-height: calc(100vh - 48px); object-fit: contain; background: #061419; }.card-detail { padding: 36px 28px; }.card-detail p { color: #aebfbc; line-height: 1.55; }.side-toggle { display: flex; gap: 8px; }.side-toggle button.active { color: #142127; background: #d5aa63; }.warning { color: #ffd39c !important; border-left: 3px solid #d5aa63; padding-left: 12px; }.close { position: absolute; z-index: 2; top: 10px; right: 10px; width: 34px; height: 34px; color: #edf0df; background: #07171ccc; border: 1px solid #557078; border-radius: 50%; font-size: 1.35rem; }
@media (max-width: 1000px) { .card-grid { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 700px) { .catalog-heading { display: block; }.catalog-note { margin-top: 12px; }.catalog-controls { grid-template-columns: 1fr; }.card-grid { grid-template-columns: repeat(2, 1fr); }.card-modal article { grid-template-columns: 1fr; }.card-modal img { max-height: 60vh; } }
</style>
