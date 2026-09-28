<script setup lang="ts">
import { baseGameInvestigators, baseGameLocations } from '@eldritch/content'
import type { LocationId } from '@eldritch/protocol'
const game = useGameRoom()
const me = computed(() => game.players.value.find(p => p.id === game.playerId.value))
const defeat = computed(() => game.investigatorLifecycle.value.pendingDefeat)
const city = ref('')
const cause = ref<'health' | 'sanity'>('health')
const lead = ref('')
const survivors = computed(() => game.players.value.filter(p => !p.defeated && !p.eliminated))
const available = computed(() => baseGameInvestigators.filter(i => !game.players.value.some(p => p.investigatorId === i.id) && !game.investigatorLifecycle.value.defeatedInvestigators?.some(p => p.investigatorId === i.id)))
watch(defeat, value => { city.value = value?.cityIds[0] ?? ''; cause.value = value?.causes[0] ?? 'health'; lead.value = survivors.value[0]?.id ?? '' }, { immediate: true })
</script>
<template>
  <section v-if="me?.defeated" class="defeat-panel">
    <strong>{{ me.eliminated ? 'You have been eliminated' : 'Your investigator was defeated' }}</strong>
    <form v-if="defeat?.playerId === me.id && !game.gameResult.value" @submit.prevent="game.send({ type: 'RESOLVE_DEFEAT', cityId: city as LocationId, cause, leadPlayerId: lead || undefined })">
      <label>Nearest City <select v-model="city"><option v-for="id in defeat.cityIds" :key="id" :value="id">{{ baseGameLocations.find(l => l.id === id)?.name }}</option></select></label>
      <label>Defeat cause <select v-model="cause"><option v-for="value in defeat.causes" :key="value" :value="value">{{ value }}</option></select></label>
      <label v-if="survivors.length">Pass lead if needed <select v-model="lead"><option v-for="p in survivors" :key="p.id" :value="p.id">{{ p.displayName }}</option></select></label>
      <button>Confirm defeat choices</button>
    </form>
    <template v-else-if="game.investigatorLifecycle.value.replacementWindow && !me.eliminated && !game.investigatorLifecycle.value.awakened">
      <button v-for="investigator in available" :key="investigator.id" @click="game.send({ type: 'REPLACE_INVESTIGATOR', investigatorId: investigator.id })">{{ investigator.name }}</button>
    </template>
    <p v-else-if="!me.eliminated">Replacement becomes available after Mythos resolves.</p>
  </section>
</template>
<style scoped>
.defeat-panel { position: absolute; z-index: 11; top: 30%; left: 25%; width: 50%; padding: 16px; background: #10272ef5; border: 1px solid #d5aa63; border-radius: 10px; } form { display: grid; gap: 12px; } select, button { padding: 8px; }
</style>
