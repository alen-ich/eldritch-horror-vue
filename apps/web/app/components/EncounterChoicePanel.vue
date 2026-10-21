<script setup lang="ts">
const game = useGameRoom()
const decision = computed(() => {
  const value = game.pendingDecision.value
  return (value?.kind === 'spell_target' || value?.kind === 'spell_improvement' || value?.kind === 'spell_reverse_choice' || value?.kind === 'encounter_choice' || value?.kind === 'artifact_target' || value?.kind === 'artifact_payment' || value?.kind === 'rest_asset_choice') && value.playerId === game.playerId.value && 'optionIds' in value ? value : undefined
})
const panel = ref<HTMLElement>()
let previousFocus: HTMLElement | undefined
watch(() => decision.value?.id, async (id, oldId) => {
  if (id && decision.value?.kind.startsWith('spell_')) {
    if (!oldId) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    await nextTick()
    panel.value?.querySelector<HTMLButtonElement>('button')?.focus()
  } else if (!id && previousFocus?.isConnected) {
    await nextTick()
    if (!(previousFocus instanceof HTMLButtonElement && previousFocus.disabled)) previousFocus.focus()
    previousFocus = undefined
  }
})
function trapTab(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !decision.value?.kind.startsWith('spell_')) return
  const buttons = Array.from(panel.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
const waitingForSpell = computed(() => game.pendingDecision.value?.kind.startsWith('spell_') && game.pendingDecision.value.playerId !== game.playerId.value)
function choose(id: string) {
  if (decision.value) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.value.id, selectedOptionIds: [id] })
}
</script>

<template>
  <section v-if="decision" ref="panel" @keydown="trapTab" class="encounter-choice" role="dialog" aria-modal="true" aria-labelledby="encounter-choice-title">
    <h2 id="encounter-choice-title">{{ decision.kind.startsWith('spell_') ? 'Spell action' : decision.kind === 'rest_asset_choice' ? 'Rest bonus' : decision.kind === 'artifact_target' || decision.kind === 'artifact_payment' ? 'Artifact action' : 'Encounter choice' }}</h2>
    <p>{{ decision.prompt }}</p>
    <button v-for="id in decision.optionIds" :key="id" @click="choose(id)">{{ decision.optionLabels?.[id] ?? id }}</button>
  </section>
  <p v-else-if="waitingForSpell" class="spell-wait" role="status">Waiting for another investigator’s Spell choice.</p>
</template>

<style scoped>
.encounter-choice { position: absolute; z-index: 20; top: 12%; left: 22%; width: min(56%, 560px); max-height: 72%; overflow: auto; padding: 20px; background: #10272ef5; border: 1px solid #d5aa63; border-radius: 10px; display: grid; gap: 10px; }
h2, p { margin: 0; }
button { padding: 10px; text-align: left; }
@media (max-width: 700px) { .encounter-choice { left: 5%; width: 90%; } }
</style>
