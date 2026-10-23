<script setup lang="ts">
import { baseGameGates, baseGameMonsters, baseGameLocations } from '@eldritch/content'
const game = useGameRoom()
const me = computed(() => game.players.value.find(player => player.id === game.playerId.value))
const isNorman = computed(() => me.value?.investigatorId === 'norman_withers')
const targetId = ref('')
const targetMonsters = computed(() => game.monsters.value.filter(monster =>
  baseGameMonsters.some(card => card.id === monster.monsterId && card.type === 'normal')
  && baseGameGates.some(gate => game.activeGateIds.value.includes(gate.id) && gate.locationId === monster.locationId)))
watch(targetMonsters, targets => {
  if (!targets.some(monster => monster.id === targetId.value)) targetId.value = targets[0]?.id ?? ''
}, { immediate: true })
function targetLabel(monster: typeof targetMonsters.value[number], index: number): string {
  const name = baseGameMonsters.find(card => card.id === monster.monsterId)?.name ?? 'Monster'
  const location = baseGameLocations.find(space => space.id === monster.locationId)?.name ?? monster.locationId
  return `${name} at ${location} (${index + 1})`
}
function discardMonster(useSanity: boolean) {
  game.send({ type: 'USE_INVESTIGATOR_ACTION', monsterInstanceId: targetId.value, useSanity })
}
const label = computed(() => me.value?.investigatorId === 'jim_culver' ? 'Recover 1 Sanity on this space'
  : me.value?.investigatorId === 'trish_scarborough' ? 'Gain 1 Clue' : '')
const available = computed(() => game.phase.value === 'action' && game.activePlayerId.value === game.playerId.value
  && !game.pendingDecision.value && !game.activeTest.value && !game.tradeOffer.value && !game.investigatorLifecycle.value.pendingDefeat
  && !game.gameResult.value && !me.value?.delayed && !me.value?.defeated && !me.value?.eliminated
  && !me.value?.conditionIds.split(',').some(id => id.startsWith('condition_detained')) && game.actionsRemaining.value > 0
  && !game.performedActions.value.includes('investigator')
  && (me.value?.investigatorId !== 'trish_scarborough' || me.value.clues === 0))
</script>

<template>
  <div v-if="isNorman && game.phase.value !== 'lobby'" class="investigator-action norman-action">
    <label>Monster at a Gate
      <select v-model="targetId" :disabled="!available || !targetMonsters.length">
        <option v-for="(monster, index) in targetMonsters" :key="monster.id" :value="monster.id">{{ targetLabel(monster, index) }}</option>
      </select>
    </label>
    <span v-if="!targetMonsters.length" role="status">No non-Epic Monsters at Gates.</span>
    <button :disabled="!available || !targetId || (me?.clues ?? 0) < 2" @click="discardMonster(false)">Spend 2 Clues: discard Monster</button>
    <button :disabled="!available || !targetId || (me?.clues ?? 0) < 1 || (me?.sanity ?? 0) < 2" @click="discardMonster(true)">Spend 1 Clue and 1 Sanity: discard Monster</button>
  </div>
  <div v-else-if="label && game.phase.value !== 'lobby'" class="investigator-action">
    <button :disabled="!available" @click="game.send({ type: 'USE_INVESTIGATOR_ACTION' })">{{ label }}</button>
  </div>
</template>

<style scoped>
.investigator-action { position: absolute; z-index: 5; bottom: 110px; left: 24%; }
button { padding: 8px 12px; background: #10272e; color: #efdcb8; border: 1px solid #d5aa63; border-radius: 6px; }
button:disabled { opacity: .5; }
.norman-action { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 65%; padding: 8px; background: #10272e; color: #efdcb8; }
label { display: grid; gap: 4px; }
select { max-width: 280px; padding: 6px; background: #10272e; color: #efdcb8; border: 1px solid #d5aa63; }
</style>
