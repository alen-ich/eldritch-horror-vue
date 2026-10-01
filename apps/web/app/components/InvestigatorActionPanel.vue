<script setup lang="ts">
const game = useGameRoom()
const me = computed(() => game.players.value.find(player => player.id === game.playerId.value))
const label = computed(() => me.value?.investigatorId === 'jim_culver' ? 'Recover 1 Sanity on this space'
  : me.value?.investigatorId === 'trish_scarborough' ? 'Gain 1 Clue' : '')
const available = computed(() => game.phase.value === 'action' && game.activePlayerId.value === game.playerId.value
  && !game.pendingDecision.value && !game.gameResult.value && !me.value?.delayed && game.actionsRemaining.value > 0
  && !game.performedActions.value.includes('investigator')
  && (me.value?.investigatorId !== 'trish_scarborough' || me.value.clues === 0))
</script>

<template>
  <div v-if="label && game.phase.value !== 'lobby'" class="investigator-action">
    <button :disabled="!available" @click="game.send({ type: 'USE_INVESTIGATOR_ACTION' })">{{ label }}</button>
  </div>
</template>

<style scoped>
.investigator-action { position: absolute; z-index: 5; bottom: 110px; left: 24%; }
button { padding: 8px 12px; background: #10272e; color: #efdcb8; border: 1px solid #d5aa63; border-radius: 6px; }
button:disabled { opacity: .5; }
</style>
