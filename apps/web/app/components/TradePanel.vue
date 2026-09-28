<script setup lang="ts">
import { baseGameAssets } from '@eldritch/content'
import type { TradeBundle } from '@eldritch/protocol'
const game = useGameRoom()
const me = computed(() => game.players.value.find(p => p.id === game.playerId.value))
const partners = computed(() => game.players.value.filter(p => p.id !== me.value?.id && p.locationId === me.value?.locationId))
const targetId = ref('')
const target = computed(() => partners.value.find(p => p.id === targetId.value))
const empty = (): TradeBundle => ({ assetIds: [], clues: 0, tickets: [] })
const give = ref(empty())
const receive = ref(empty())
const open = ref(false)
const canOffer = computed(() => game.phase.value === 'action' && game.activePlayerId.value === me.value?.id && !me.value?.delayed && !game.pendingDecision.value && !game.tradeOffer.value && !game.performedActions.value.includes('trade') && !game.gameResult.value)
const title = (id: string) => baseGameAssets.find(card => card.id === id)?.name ?? id
watch(targetId, () => { give.value = empty(); receive.value = empty() })
watch(() => game.stateVersion.value, () => { open.value = false; give.value = empty(); receive.value = empty() })
function offer() {
  if (!target.value) return
  game.send({ type: 'OFFER_TRADE', targetPlayerId: target.value.id, give: give.value, receive: receive.value })
}
function describe(bundle: Readonly<TradeBundle> | { readonly assetIds: readonly string[]; readonly clues: number; readonly tickets: readonly string[] }) {
  return [...bundle.assetIds.map(title), `${bundle.clues} Clues`, ...bundle.tickets.map(t => `${t} ticket`)].join(', ')
}
</script>

<template>
  <aside class="trade-panel">
    <button v-if="!game.tradeOffer.value" :disabled="!canOffer || !partners.length" @click="open = !open">Trade</button>
    <form v-if="open && canOffer" @submit.prevent="offer">
      <label>Trade with <select v-model="targetId" required><option value="">Choose investigator</option><option v-for="p in partners" :key="p.id" :value="p.id">{{ p.displayName }}</option></select></label>
      <template v-if="target && me">
        <fieldset v-for="side in [{ label: 'You give', player: me, bundle: give }, { label: 'You receive', player: target, bundle: receive }]" :key="side.label">
          <legend>{{ side.label }}</legend>
          <label v-for="id in side.player.assetIds.split(',').filter(Boolean)" :key="id"><input v-model="side.bundle.assetIds" type="checkbox" :value="id">{{ title(id) }}</label>
          <label>Clues <input v-model.number="side.bundle.clues" type="number" min="0" :max="side.player.clues" required></label>
          <label>Tickets <select v-model="side.bundle.tickets" multiple aria-label="Tickets to trade"><option v-if="side.player.trainTickets" value="train">Train</option><option v-if="side.player.shipTickets" value="ship">Ship</option></select></label>
        </fieldset>
        <button type="submit">Send offer</button>
      </template>
      <button type="button" @click="open = false">Cancel</button>
    </form>
    <div v-if="game.tradeOffer.value" aria-live="polite">
      <strong>Trade offer</strong>
      <p>{{ game.players.value.find(p => p.id === game.tradeOffer.value?.fromPlayerId)?.displayName }} offers {{ describe(game.tradeOffer.value.give) }}</p>
      <p>In exchange for {{ describe(game.tradeOffer.value.receive) }}</p>
      <button v-if="game.tradeOffer.value.toPlayerId === me?.id" @click="game.send({ type: 'ANSWER_TRADE', offerId: game.tradeOffer.value.id, accept: true })">Accept trade</button>
      <button v-if="[game.tradeOffer.value.toPlayerId, game.tradeOffer.value.fromPlayerId].includes(me?.id ?? '')" @click="game.send({ type: 'ANSWER_TRADE', offerId: game.tradeOffer.value.id, accept: false })">Cancel trade</button>
    </div>
  </aside>
</template>

<style scoped>
.trade-panel { position: absolute; right: 18px; top: 70px; z-index: 8; max-width: min(360px, 85%); max-height: 65%; overflow: auto; background: #10272ef5; border: 1px solid #647e86; border-radius: 8px; padding: 10px; }
form, fieldset { display: grid; gap: 8px; } label { display: flex; gap: 8px; align-items: center; } input[type=checkbox] { width: auto; } button, select { padding: 6px; } p { font-size: .8rem; }
</style>
