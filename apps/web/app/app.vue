<script setup lang="ts">
import { baseGameAncientOnes, baseGameAssets, baseGameBoardDimensions, baseGameConditions, baseGameGates, baseGameInvestigators, baseGameLocations, baseGameMap, baseGameMonsters, baseGameMythosCards, baseGameMysteries, baseGameRoutes, baseGameScannedLocationEncounters, baseGameScannedTokenEncounters, skillNames } from '@eldritch/content'
import type { AssetCardData, ConditionCard } from '@eldritch/content'
import { baseGameArtifacts } from '@eldritch/content'
import type { AncientOneId, InvestigatorId, LocationId } from '@eldritch/protocol'

const displayName = ref('')
const joinCode = ref('')
const attemptedReconnect = ref(false)
const inspectedLocationId = ref<LocationId>()
const boardZoom = ref(1)
const dockExpanded = ref(true)
const reserveExpanded = ref(true)
const selectedPlayerId = ref('')
const trayState = ref<'collapsed' | 'peek' | 'expanded'>('collapsed')
const activeTrayTab = ref('assets')
const selectedReserveAssetIds = ref<string[]>([])
const travelRoute = ref<LocationId[]>([])
const selectedRerollOptionId = ref<string>()
const selectedConditionRecoveryIds = ref<string[]>([])
const trayTabs = [
  { id: 'assets', label: 'Assets', icon: '◆' },
  { id: 'artifacts', label: 'Artifacts', icon: '◇' },
  { id: 'spells', label: 'Spells', icon: '✦' },
  { id: 'conditions', label: 'Conditions', icon: '◈' },
  { id: 'tasks', label: 'Tasks', icon: '✓' },
  { id: 'log', label: 'Log', icon: '≡' },
] as const
const game = useGameRoom()

const locationById = Object.fromEntries(baseGameLocations.map((location) => [location.id, location])) as Record<LocationId, typeof baseGameLocations[number]>
const investigatorById = Object.fromEntries(baseGameInvestigators.map((investigator) => [investigator.id, investigator]))
const assetById = Object.fromEntries(baseGameAssets.map((asset) => [asset.id, asset]))
const conditionById = Object.fromEntries(baseGameConditions.flatMap((card) => [[card.id, card], [`condition_${card.kind}`, card]]))
const monsterById = Object.fromEntries(baseGameMonsters.map(monster => [monster.id, monster]))
const gateById = Object.fromEntries(baseGameGates.map(gate => [gate.id, gate]))
const me = computed(() => game.players.value.find((player) => player.id === game.playerId.value))
const displayedPlayer = computed(() => game.players.value.find((player) => player.id === selectedPlayerId.value) ?? me.value ?? game.players.value[0])
const displayedInvestigator = computed(() => displayedPlayer.value?.investigatorId ? investigatorById[displayedPlayer.value.investigatorId] : undefined)
const activeMystery = computed(() => baseGameMysteries.find((mystery) => mystery.id === game.activeMysteryId.value))
const currentMythosCard = computed(() => baseGameMythosCards.find(card => card.id === game.currentMythosCardId.value))
const selectedByInvestigator = computed(() => new Map(game.players.value
  .filter((player) => player.investigatorId)
  .map((player) => [player.investigatorId, player])))
const isMyTurn = computed(() => game.phase.value === 'action' && game.activePlayerId.value === game.playerId.value && !game.pendingDecision.value && !game.gameResult.value)
const isMyEncounter = computed(() => game.phase.value === 'encounter' && game.activePlayerId.value === game.playerId.value && !game.pendingDecision.value && !game.gameResult.value)
const myEncounterMonsters = computed(() => game.monsters.value.filter(monster => monster.locationId === me.value?.locationId))
const encounterDecks = computed(() => {
  const location = me.value?.locationId as LocationId | undefined
  if (!location || !locationById[location]) return [] as { id: 'general' | 'america' | 'europe' | 'asia_australia'; label: string }[]
  const regional: 'america' | 'europe' | 'asia_australia' | undefined = location === 'arkham' || location === 'san_francisco' || location === 'buenos_aires' ? 'america'
    : location === 'london' || location === 'rome' || location === 'istanbul' ? 'europe'
      : location === 'shanghai' || location === 'tokyo' || location === 'sydney' ? 'asia_australia' : undefined
  return regional ? [{ id: 'general' as const, label: 'General' }, { id: regional, label: regional === 'asia_australia' ? 'Asia / Australia' : regional[0]!.toUpperCase() + regional.slice(1) }]
    : [{ id: 'general' as const, label: 'General' }]
})
const researchClues = computed(() => game.boardClues.value.filter(clue => clue.locationId === me.value?.locationId))
const latestEncounterCard = computed(() => [...baseGameScannedLocationEncounters, ...baseGameScannedTokenEncounters].find(card => card.id === (game.currentLocationEncounterCardId.value || game.lastLocationEncounterCardId.value)))
const isDetained = computed(() => (me.value?.conditionIds?.split(',') ?? []).some(id => conditionById[id]?.kind === 'detained'))
const canUseNormalActions = computed(() => isMyTurn.value && !isDetained.value)
const localConditionActions = computed(() => game.players.value.flatMap(player => (player.conditionIds ? player.conditionIds.split(',') : [])
  .filter(id => player.locationId === me.value?.locationId && ['debt', 'detained'].includes(conditionById[id]?.kind ?? '')
    && !game.usedConditionActionIds.value.includes(`condition_action:${player.id}:${id}`)
    && (!isDetained.value || (player.id === me.value?.id && conditionById[id]?.kind === 'detained')))
  .map(id => ({ id, kind: conditionById[id]!.kind, ownerId: player.id, name: conditionById[id]?.name ?? 'Condition', owner: player.displayName }))))
const travelOrigin = computed(() => travelRoute.value.at(-1) ?? me.value?.locationId as LocationId | undefined)
const travelTicketsUsed = computed(() => {
  const used = { train: 0, ship: 0 }
  for (let index = 1; index < travelRoute.value.length; index++) {
    const route = baseGameRoutes.find(route =>
      (route.source === travelRoute.value[index - 1] && route.target === travelRoute.value[index])
      || (route.target === travelRoute.value[index - 1] && route.source === travelRoute.value[index]))
    if (route && route.type !== 'uncharted') used[route.type]++
  }
  return used
})
const legalDestinations = computed(() => new Set(
  !canUseNormalActions.value || game.performedActions.value.includes('travel') || travelRoute.value.length >= 3 || !travelOrigin.value
    ? []
    : (baseGameMap.adjacentLocationIds[travelOrigin.value] ?? []).filter(destination => {
      if (!travelRoute.value.length) return true
      const route = baseGameRoutes.find(route =>
        (route.source === travelOrigin.value && route.target === destination)
        || (route.target === travelOrigin.value && route.source === destination))
      return route?.type === 'train' ? travelTicketsUsed.value.train < (me.value?.trainTickets ?? 0)
        : route?.type === 'ship' && travelTicketsUsed.value.ship < (me.value?.shipTickets ?? 0)
    })
))
const inspectedLocation = computed(() => inspectedLocationId.value ? locationById[inspectedLocationId.value] : undefined)
const inspectedClueCount = computed(() => game.boardClues.value.filter(clue => clue.locationId === inspectedLocationId.value).length)
const myAssetIds = computed(() => me.value?.assetIds ? me.value.assetIds.split(',') : [])
const ownedAssets = computed(() => myAssetIds.value.map((id) => assetById[id]).filter((asset): asset is AssetCardData => Boolean(asset)))
const ownedArtifacts = computed(() => baseGameArtifacts.filter(card => (me.value?.artifactIds.split(',') ?? []).includes(card.id)))
const ownedConditions = computed(() => (me.value?.conditionIds ? me.value.conditionIds.split(',') : [])
  .map(id => conditionById[id]).filter((card): card is ConditionCard => Boolean(card)))
const privateAssetDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && (decision.kind === 'select_acquired_cards' || decision.kind === 'discard_reserve_card') ? decision : undefined
})
const privateRerollDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'select_rerolls' ? decision : undefined
})
const privateConditionRecoveryDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'recover_conditions' ? decision : undefined
})
const privateOmenDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_omen_space' ? decision : undefined
})
const privateWorldFightsBackDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_world_fights_back' ? decision : undefined
})
const privateDebtTradeDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'trade_debt_for_condition' ? decision : undefined
})
const privateDesperateTimesDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_desperate_times' ? decision : undefined
})
const privateThatWhichConsumesDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_that_which_consumes_gate' ? decision : undefined
})
const privateHeatWaveDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_heat_wave' ? decision : undefined
})
const privateBloodFlowsDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_blood_flows_monster' ? decision : undefined
})
const privateTideOfDespairDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_tide_of_despair' ? decision : undefined
})
const privateUnexpectedBetrayalDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && decision.kind === 'choose_unexpected_betrayal_ally' ? decision : undefined
})
const selectedReserveValue = computed(() => selectedReserveAssetIds.value.reduce((total, id) => total + (assetById[id]?.value ?? 0), 0))
const inspectedRoutes = computed(() => inspectedLocationId.value
  ? baseGameRoutes.filter((route) => route.source === inspectedLocationId.value || route.target === inspectedLocationId.value)
  : [])
const boardViewBox = computed(() => {
  const width = baseGameBoardDimensions.width / boardZoom.value
  const height = baseGameBoardDimensions.height / boardZoom.value
  const focus = me.value?.locationId ? locationById[me.value.locationId as LocationId] : undefined
  const centerX = focus?.x ?? baseGameBoardDimensions.width / 2
  const centerY = focus?.y ?? baseGameBoardDimensions.height / 2
  const x = Math.max(0, Math.min(baseGameBoardDimensions.width - width, centerX - width / 2))
  const y = Math.max(0, Math.min(baseGameBoardDimensions.height - height, centerY - height / 2))
  return `${x} ${y} ${width} ${height}`
})

onMounted(async () => {
  const queryRoom = new URLSearchParams(location.search).get('room')
  if (queryRoom) joinCode.value = queryRoom
  const reconnected = await game.reconnect()
  attemptedReconnect.value = reconnected
  if (!reconnected && queryRoom) {
    await game.joinGame(queryRoom, 'Investigator')
  }
})

watch(() => game.roomId.value, (id) => {
  if (id) history.replaceState(null, '', `?room=${encodeURIComponent(id)}`)
})

watch(() => privateAssetDecision.value?.id, () => { selectedReserveAssetIds.value = [] })
watch(() => game.stateVersion.value, () => { travelRoute.value = [] })
watch(() => game.roomId.value, () => { travelRoute.value = [] })
watch(() => privateRerollDecision.value?.id, () => { selectedRerollOptionId.value = undefined })
watch(() => privateConditionRecoveryDecision.value?.id, () => { selectedConditionRecoveryIds.value = [] })

async function createGame() {
  await game.createGame(displayName.value.trim() || 'Host')
}

async function joinGame() {
  if (!joinCode.value.trim()) return
  await game.joinGame(joinCode.value.trim(), displayName.value.trim() || 'Investigator')
}

function selectInvestigator(investigatorId: InvestigatorId) {
  game.send({ type: 'SELECT_INVESTIGATOR', investigatorId })
}

function selectAncientOne(ancientOneId: AncientOneId) {
  if (me.value?.isHost) game.send({ type: 'SELECT_ANCIENT_ONE', ancientOneId })
}

function isTakenByAnother(investigatorId: InvestigatorId) {
  const player = selectedByInvestigator.value.get(investigatorId)
  return Boolean(player && player.id !== game.playerId.value)
}

function move(destinationId: LocationId) {
  if (legalDestinations.value.has(destinationId)) travelRoute.value.push(destinationId)
}

function confirmTravel() {
  if (!canUseNormalActions.value || !travelRoute.value.length) return
  game.send({ type: 'TRAVEL', destinationIds: [...travelRoute.value] })
}

function selectLocation(destinationId: LocationId) {
  inspectedLocationId.value = destinationId
  move(destinationId)
}

function isLegalRoute(source: LocationId, target: LocationId) {
  const current = travelOrigin.value
  return Boolean(isMyTurn.value && current && ((source === current && legalDestinations.value.has(target)) || (target === current && legalDestinations.value.has(source))))
}

function changeZoom(delta: number) {
  boardZoom.value = Math.max(1, Math.min(2.5, boardZoom.value + delta))
}

function selectTrayTab(tabId: string) {
  if (activeTrayTab.value === tabId && trayState.value !== 'collapsed') {
    trayState.value = 'collapsed'
    return
  }
  activeTrayTab.value = tabId
  trayState.value = 'peek'
}

function cycleTrayState() {
  trayState.value = trayState.value === 'collapsed' ? 'peek' : trayState.value === 'peek' ? 'expanded' : 'collapsed'
}

function displayedSkillValue(skill: typeof skillNames[number]) {
  const investigator = displayedInvestigator.value
  const player = displayedPlayer.value
  if (!investigator || !player) return 0
  const improvements = {
    lore: player.loreImprovement,
    influence: player.influenceImprovement,
    observation: player.observationImprovement,
    strength: player.strengthImprovement,
    will: player.willImprovement,
  }
  return investigator.skills[skill] + improvements[skill]
}

function toggleReserveAsset(assetId: string) {
  const decision = privateAssetDecision.value
  if (!decision || !decision.optionIds.includes(assetId)) return
  if (selectedReserveAssetIds.value.includes(assetId)) {
    if (assetId === 'bank-loan' && selectedReserveValue.value > (decision.selectionBudget ?? 0)) return
    selectedReserveAssetIds.value = selectedReserveAssetIds.value.filter((id) => id !== assetId)
    return
  }
  if (decision.kind === 'discard_reserve_card') {
    selectedReserveAssetIds.value = [assetId]
    return
  }
  const nextValue = selectedReserveValue.value + (assetById[assetId]?.value ?? 0)
  if (nextValue <= (decision.selectionBudget ?? 0) + (selectedReserveAssetIds.value.includes('bank-loan') ? 2 : 0)) selectedReserveAssetIds.value = [...selectedReserveAssetIds.value, assetId]
}

function resolveAssetDecision() {
  const decision = privateAssetDecision.value
  if (!decision) return
  game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: selectedReserveAssetIds.value })
}

function resolveRerollDecision() {
  const decision = privateRerollDecision.value
  if (!decision) return
  game.send({
    type: 'RESOLVE_DECISION',
    decisionId: decision.id,
    selectedOptionIds: selectedRerollOptionId.value ? [selectedRerollOptionId.value] : []
  })
}

function toggleConditionRecovery(conditionId: string) {
  if (!privateConditionRecoveryDecision.value?.optionIds.includes(conditionId)) return
  selectedConditionRecoveryIds.value = selectedConditionRecoveryIds.value.includes(conditionId)
    ? selectedConditionRecoveryIds.value.filter(id => id !== conditionId)
    : [...selectedConditionRecoveryIds.value, conditionId]
}

function resolveConditionRecovery() {
  const decision = privateConditionRecoveryDecision.value
  if (decision) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: selectedConditionRecoveryIds.value })
}

function resolveOmenChoice(optionId: string) {
  const decision = privateOmenDecision.value
  if (decision?.optionIds.includes(optionId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [optionId] })
}

function resolveWorldFightsBackChoice(optionId: string) {
  const decision = privateWorldFightsBackDecision.value
  if (decision?.optionIds.includes(optionId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [optionId] })
}

function resolveDebtTradeChoice(optionId: string) {
  const decision = privateDebtTradeDecision.value
  if (decision?.optionIds.includes(optionId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [optionId] })
}

function resolveDesperateTimesChoice(optionId: string) {
  const decision = privateDesperateTimesDecision.value
  if (decision?.optionIds.includes(optionId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [optionId] })
}

function resolveThatWhichConsumesChoice(gateId: string) {
  const decision = privateThatWhichConsumesDecision.value
  if (decision?.optionIds.includes(gateId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [gateId] })
}

function resolveHeatWaveChoice(optionId: string) {
  const decision = privateHeatWaveDecision.value
  if (decision?.optionIds.includes(optionId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [optionId] })
}

function resolveBloodFlowsChoice(monsterInstanceId: string) {
  const decision = privateBloodFlowsDecision.value
  if (decision?.optionIds.includes(monsterInstanceId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [monsterInstanceId] })
}

function resolveTideOfDespairChoice(optionId: string) {
  const decision = privateTideOfDespairDecision.value
  if (decision?.optionIds.includes(optionId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [optionId] })
}

function resolveUnexpectedBetrayalChoice(assetId: string) {
  const decision = privateUnexpectedBetrayalDecision.value
  if (decision?.optionIds.includes(assetId)) game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: [assetId] })
}

function worldFightsBackOptionLabel(optionId: string): string {
  if (optionId === 'recover_health') return 'Recover 2 Health'
  if (optionId === 'recover_sanity') return 'Recover 2 Sanity'
  if (optionId === 'skip') return 'Skip'
  const instance = game.monsters.value.find(monster => monster.id === optionId.slice('monster:'.length))
  return `Discard ${monsterById[instance?.monsterId ?? '']?.name ?? 'Monster'}`
}

async function copyInvite() {
  await window.navigator.clipboard.writeText(window.location.href)
}
</script>

<template>
  <main class="shell" :class="{ 'playing-shell': game.phase.value !== 'lobby' && game.status.value === 'connected' }">
    <header v-if="game.phase.value === 'lobby' || game.status.value !== 'connected'" class="masthead">
      <div>
        <p class="eyebrow">Cooperative mystery · authoritative multiplayer</p>
        <h1>Eldritch Horror</h1>
      </div>
      <span class="status" :class="game.status.value">{{ game.status.value }}</span>
    </header>

    <section v-if="game.status.value === 'idle' || game.status.value === 'disconnected'" class="panel entry">
      <div>
        <p class="chapter">Enter the investigation</p>
        <h2>Gather your team before the omen advances.</h2>
        <p class="muted">Create a room, or open a shared room link and join with a second browser.</p>
      </div>
      <label>Display name<input v-model="displayName" maxlength="32" placeholder="Ada" @keyup.enter="createGame"></label>
      <button class="primary" @click="createGame">Create game</button>
      <div class="divider"><span>or join a room</span></div>
      <label>Room code<input v-model="joinCode" placeholder="Room ID" @keyup.enter="joinGame"></label>
      <button class="secondary" :disabled="!joinCode.trim()" @click="joinGame">Join game</button>
      <p v-if="game.errorMessage.value" class="error" role="alert">{{ game.errorMessage.value }}</p>
      <p v-if="attemptedReconnect" class="muted">The previous seat expired; join again to continue.</p>
    </section>

    <section v-else-if="game.status.value === 'connecting'" class="panel loading">
      <span class="sigil">✦</span><p>Opening the gate…</p>
    </section>

    <template v-else>
      <section v-if="game.phase.value === 'lobby'" class="room-bar">
        <div><span>Room</span><strong>{{ game.roomId.value }}</strong></div>
        <button class="copy" @click="copyInvite">Copy invite link</button>
      </section>

      <p v-if="game.errorMessage.value" class="error" role="alert">{{ game.errorMessage.value }}</p>

      <template v-if="game.phase.value === 'lobby'">
      <section class="lobby-grid">
        <div class="panel">
          <p class="chapter">Investigator roster</p>
          <h2>Choose your investigator</h2>
          <p class="muted roster-intro">Each investigator begins at their own location with the printed Health and Sanity shown here. Abilities are included for reference while their rule effects are developed.</p>
          <div class="investigators">
            <button
              v-for="investigator in baseGameInvestigators"
              :key="investigator.id"
              :class="{ selected: me?.investigatorId === investigator.id, taken: isTakenByAnother(investigator.id) }"
              :disabled="isTakenByAnother(investigator.id)"
              :aria-pressed="me?.investigatorId === investigator.id"
              @click="selectInvestigator(investigator.id)"
            >
              <span class="investigator-head">
                <span><strong>{{ investigator.name }}</strong><small>{{ investigator.occupation }}</small></span>
                <span v-if="selectedByInvestigator.get(investigator.id)" class="selection-mark">{{ me?.investigatorId === investigator.id ? 'Selected' : `Taken · ${selectedByInvestigator.get(investigator.id)?.displayName}` }}</span>
              </span>
              <span class="role">{{ investigator.role }}</span>
              <span class="vitals"><b>♥ {{ investigator.health }}</b><b>✦ {{ investigator.sanity }}</b><span>Starts: {{ locationById[investigator.startingLocationId].name }}</span></span>
              <span class="skills">
                <span v-for="skill in skillNames" :key="skill"><small>{{ skill.slice(0, 3) }}</small><b>{{ investigator.skills[skill] }}</b></span>
              </span>
              <span class="loadout"><small>Begins with</small>{{ investigator.startingEquipment.join(' · ') }}</span>
              <span class="ability"><b>Action</b>{{ investigator.actionAbility }}</span>
              <span class="ability"><b>Passive</b>{{ investigator.passiveAbility }}</span>
            </button>
          </div>
          <button v-if="me?.isHost" class="primary start" :disabled="game.players.value.length < 2 || game.players.value.some(p => !p.investigatorId) || !game.ancientOneId.value" @click="game.send({ type: 'START_GAME' })">Start game</button>
          <p v-else class="muted">Waiting for the host to begin.</p>
        </div>
        <aside class="panel roster">
          <p class="chapter">Ancient One</p>
          <div class="ancient-ones">
            <button
              v-for="ancientOne in baseGameAncientOnes"
              :key="ancientOne.id"
              :class="{ selected: game.ancientOneId.value === ancientOne.id }"
              :disabled="!me?.isHost"
              :aria-pressed="game.ancientOneId.value === ancientOne.id"
              @click="selectAncientOne(ancientOne.id)"
            >
              <img :src="ancientOne.imageUrl" alt="" loading="lazy">
              <span><strong>{{ ancientOne.name }}</strong><small>Doom {{ ancientOne.startingDoom }}</small></span>
            </button>
          </div>
          <p v-if="!game.ancientOneId.value" class="ancient-help">{{ me?.isHost ? 'Choose the threat for this game.' : 'Waiting for the host to choose.' }}</p>
          <p class="chapter">Players · {{ game.players.value.length }}/4</p>
          <article v-for="player in game.players.value" :key="player.id">
            <span class="presence" :class="{ online: player.connected }"></span>
            <div><strong>{{ player.displayName }} <small v-if="player.isHost">HOST</small></strong><p>{{ player.investigatorId ? investigatorById[player.investigatorId]?.name : 'Choosing…' }}</p></div>
          </article>
        </aside>
      </section>
      </template>

      <section v-else class="game-shell" :class="`tray-${trayState}`">
        <header class="game-hud">
          <div class="game-hud__brand"><span class="sigil-small">✦</span><strong>Eldritch Horror</strong></div>
          <div class="game-hud__turn"><span>{{ game.phase.value }} phase · Round {{ game.turnNumber.value }}</span><strong>{{ isMyTurn ? `Your action · ${game.actionsRemaining.value} remaining` : `${game.players.value.find(p => p.id === game.activePlayerId.value)?.displayName ?? 'Lead investigator'} resolving` }}</strong></div>
          <div class="game-hud__room"><span class="presence online"></span><code>{{ game.roomId.value }}</code><button class="hud-button" @click="copyInvite">Invite</button></div>
        </header>
        <p v-if="game.errorMessage.value" class="error game-error" role="alert">{{ game.errorMessage.value }}</p>
        <div class="game-workspace" :class="{ 'dock-expanded': dockExpanded }">
        <div class="board-stage">
          <div class="doom-display">Doom {{ game.doom.value }} · Omen {{ ['Green', 'Blue', 'Red', 'Blue'][game.omen.value] }}</div>
          <TradePanel />
          <DefeatPanel />
    <EncounterChoicePanel />
    <InvestigatorActionPanel />
          <section v-if="game.phase.value === 'encounter'" class="encounter-panel" aria-label="Location encounter">
            <div><strong>Encounter phase</strong><small v-if="isMyEncounter">{{ myEncounterMonsters.length ? 'Fight each Monster on your space before taking another encounter.' : 'Choose a location deck. Many card effects remain unsupported.' }}</small><small v-else>Waiting for the active investigator.</small></div>
            <template v-if="isMyEncounter && myEncounterMonsters.length"><button v-for="monster in myEncounterMonsters" :key="monster.id" :disabled="game.encounteredMonsterInstanceIds.value.includes(monster.id)" @click="game.send({ type: 'FIGHT_MONSTER', monsterInstanceId: monster.id })">{{ monsterById[monster.monsterId]?.name ?? monster.monsterId }} · {{ monster.damage }} damage{{ game.encounteredMonsterInstanceIds.value.includes(monster.id) ? ' · fought' : '' }}</button></template>
            <template v-if="isMyEncounter && !myEncounterMonsters.length"><button v-for="deck in encounterDecks" :key="deck.id" @click="game.send({ type: 'RESOLVE_LOCATION_ENCOUNTER', deck: deck.id })">{{ deck.label }}</button></template>
            <template v-if="isMyEncounter && !myEncounterMonsters.length"><button v-for="(clue, index) in researchClues" :key="clue.id" @click="game.send({ type: 'RESOLVE_RESEARCH_ENCOUNTER', clueId: clue.id })">Research Clue {{ index + 1 }}</button></template>
            <img v-if="latestEncounterCard" :src="latestEncounterCard.imageUrl" :alt="`${game.currentLocationEncounterCardId.value ? 'Active' : 'Last resolved'} encounter: ${latestEncounterCard.id}`" />
          </section>
          <section v-if="game.phase.value === 'mythos'" class="encounter-panel mythos-panel" aria-label="Mythos resolution">
            <div><strong>Mythos phase</strong><small v-if="currentMythosCard">{{ currentMythosCard.title }} · {{ game.currentMythosIconIndex.value }}/{{ currentMythosCard.icons.length }} icons resolved</small><small v-else>{{ game.investigatorLifecycle.value.replacementWindow ? 'Card resolved. Finish any investigator replacements.' : 'Waiting for the Lead Investigator to reveal the next card.' }}</small></div>
            <img v-if="currentMythosCard" :src="currentMythosCard.imageUrl" :alt="`Revealed Mythos card: ${currentMythosCard.title}`" />
            <template v-if="game.activePlayerId.value === game.playerId.value"><button v-if="game.investigatorLifecycle.value.replacementWindow" @click="game.send({ type: 'BEGIN_NEXT_ROUND' })">Begin next round</button><button v-else :disabled="Boolean(game.pendingDecision.value)" @click="game.send({ type: 'ADVANCE_MYTHOS' })">{{ currentMythosCard && game.currentMythosIconIndex.value >= currentMythosCard.icons.length ? 'Resolve card text' : 'Resolve next printed icon' }}</button></template>
            <small v-if="currentMythosCard && game.currentMythosIconIndex.value >= currentMythosCard.icons.length && currentMythosCard.effectModelStatus !== 'typed'">This card's printed effect is not implemented yet.</small>
          </section>
          <section v-if="me?.delayed" class="travel-planner" aria-label="Delayed investigator">
            <strong>You are Delayed</strong><small>Your next action turn is spent standing up.</small>
            <button v-if="isMyTurn" @click="game.send({ type: 'END_ACTIONS' })">Stand up and end actions</button>
          </section>
          <section v-if="travelRoute.length" class="travel-planner" aria-label="Planned travel" aria-live="polite">
            <strong>{{ me?.locationId ? locationById[me.locationId as LocationId]?.name : '' }} → {{ travelRoute.map(id => locationById[id].name).join(' → ') }}</strong>
            <small>1 action · {{ travelTicketsUsed.train }} train / {{ travelTicketsUsed.ship }} ship tickets. Select another highlighted space to extend.</small>
            <div><button @click="travelRoute.pop()">Undo</button><button @click="travelRoute = []">Cancel</button><button :disabled="!isMyTurn" @click="confirmTravel">Confirm travel</button></div>
          </section>
          <section v-if="privateRerollDecision && game.activeTest.value" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="test-title">
            <p class="chapter">Skill test</p>
            <h2 id="test-title">{{ game.activeTest.value.skill }} test</h2>
            <p>{{ privateRerollDecision.prompt }}</p>
            <div class="test-dice" role="group" aria-label="Rolled dice">
              <span
                v-for="(die, index) in game.activeTest.value.dice"
                :key="index"
                :class="{ success: die >= game.activeTest.value.successThreshold }"
              >{{ die }}</span>
            </div>
            <div class="test-dice reroll-sources" role="group" aria-label="Reroll source and die">
              <button v-for="optionId in privateRerollDecision.optionIds" :key="optionId"
                :class="{ selected: selectedRerollOptionId === optionId }"
                :aria-pressed="selectedRerollOptionId === optionId"
                @click="selectedRerollOptionId = selectedRerollOptionId === optionId ? undefined : optionId"
              >{{ privateRerollDecision.optionLabels?.[optionId] ?? optionId }}</button>
            </div>
            <strong>{{ game.activeTest.value.successes }} {{ game.activeTest.value.successes === 1 ? 'success' : 'successes' }}</strong>
            <button class="primary" @click="resolveRerollDecision">{{ selectedRerollOptionId?.startsWith('asset-increment:') ? 'Use selected die modifier' : selectedRerollOptionId ? 'Use selected reroll' : 'Keep result' }}</button>
          </section>
          <section v-if="privateConditionRecoveryDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="condition-recovery-title">
            <p class="chapter">Rest recovery</p>
            <h2 id="condition-recovery-title">Treat your Conditions</h2>
            <p>{{ privateConditionRecoveryDecision.prompt }}</p>
            <div class="test-dice" role="group" aria-label="Conditions to treat">
              <button v-for="conditionId in privateConditionRecoveryDecision.optionIds" :key="conditionId"
                :class="{ selected: selectedConditionRecoveryIds.includes(conditionId) }"
                :aria-pressed="selectedConditionRecoveryIds.includes(conditionId)"
                @click="toggleConditionRecovery(conditionId)">{{ conditionById[conditionId]?.name }}</button>
            </div>
            <button class="primary" @click="resolveConditionRecovery">{{ selectedConditionRecoveryIds.length ? 'Roll selected Conditions' : 'Skip recovery rolls' }}</button>
          </section>
          <section v-if="privateOmenDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="omen-choice-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="omen-choice-title">Omen of Good Fortune</h2>
            <p>{{ privateOmenDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Omen track spaces">
              <button v-for="optionId in privateOmenDecision.optionIds" :key="optionId"
                :aria-label="optionId === 'stay' ? 'Leave Omen where it is' : `Move Omen to ${['Green', 'Blue (first)', 'Red', 'Blue (second)'][Number(optionId.slice(5))]}`"
                @click="resolveOmenChoice(optionId)">{{ optionId === 'stay' ? 'Stay' : `${Number(optionId.slice(5)) + 1}: ${['Green', 'Blue', 'Red', 'Blue'][Number(optionId.slice(5))]}` }}</button>
            </div>
          </section>
          <section v-if="privateWorldFightsBackDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="world-fights-back-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="world-fights-back-title">The World Fights Back</h2>
            <p>{{ privateWorldFightsBackDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Mythos choices">
              <button v-for="optionId in privateWorldFightsBackDecision.optionIds" :key="optionId"
                @click="resolveWorldFightsBackChoice(optionId)">{{ worldFightsBackOptionLabel(optionId) }}</button>
            </div>
          </section>
          <section v-if="privateDebtTradeDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="debt-trade-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="debt-trade-title">Everyone Has a Price</h2>
            <p>{{ privateDebtTradeDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Debt exchange choices">
              <button v-for="optionId in privateDebtTradeDecision.optionIds" :key="optionId"
                @click="resolveDebtTradeChoice(optionId)">{{ optionId === 'skip' ? 'Skip' : `Gain Debt to discard ${conditionById[optionId]?.name ?? 'Condition'}` }}</button>
            </div>
          </section>
          <section v-if="privateDesperateTimesDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="desperate-times-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="desperate-times-title">Desperate Times</h2>
            <p>{{ privateDesperateTimesDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Desperate Times choices">
              <button v-for="optionId in privateDesperateTimesDecision.optionIds" :key="optionId"
                @click="resolveDesperateTimesChoice(optionId)">{{ optionId === 'gain_dark_pact' ? 'Gain a Dark Pact' : 'Advance Doom by 2' }}</button>
            </div>
          </section>
          <section v-if="privateThatWhichConsumesDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="that-which-consumes-title">
            <p class="chapter">Group Mythos choice</p>
            <h2 id="that-which-consumes-title">That Which Consumes</h2>
            <p>{{ privateThatWhichConsumesDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Active Gates">
              <button v-for="gateId in privateThatWhichConsumesDecision.optionIds" :key="gateId"
                @click="resolveThatWhichConsumesChoice(gateId)">Discard {{ gateById[gateId]?.name ?? gateId }} Gate · {{ gateById[gateId]?.omenSymbol ?? 'unknown' }}</button>
            </div>
          </section>
          <section v-if="privateHeatWaveDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="heat-wave-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="heat-wave-title">Heat Wave Singes the Globe</h2>
            <p>{{ privateHeatWaveDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Heat Wave choices">
              <button v-for="optionId in privateHeatWaveDecision.optionIds" :key="optionId"
                @click="resolveHeatWaveChoice(optionId)">{{ optionId === 'become_delayed' ? 'Become Delayed' : 'Lose 3 Health' }}</button>
            </div>
          </section>
          <section v-if="privateBloodFlowsDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="blood-flows-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="blood-flows-title">Blood Flows</h2>
            <p>{{ privateBloodFlowsDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Monsters to discard">
              <button v-for="monsterInstanceId in privateBloodFlowsDecision.optionIds" :key="monsterInstanceId"
                @click="resolveBloodFlowsChoice(monsterInstanceId)">Discard {{ monsterById[game.monsters.value.find(monster => monster.id === monsterInstanceId)?.monsterId ?? '']?.name ?? 'Monster' }}</button>
            </div>
          </section>
          <section v-if="privateTideOfDespairDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="tide-of-despair-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="tide-of-despair-title">Tide of Despair</h2>
            <p>{{ privateTideOfDespairDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Tide of Despair choices">
              <button v-for="optionId in privateTideOfDespairDecision.optionIds" :key="optionId"
                @click="resolveTideOfDespairChoice(optionId)">{{ optionId === 'discard_blessed' ? 'Discard Blessed' : 'Lose 2 Health and 2 Sanity' }}</button>
            </div>
          </section>
          <section v-if="privateUnexpectedBetrayalDecision" class="test-dialog" role="dialog" aria-modal="true" aria-labelledby="unexpected-betrayal-title">
            <p class="chapter">Mythos choice</p>
            <h2 id="unexpected-betrayal-title">Unexpected Betrayal</h2>
            <p>{{ privateUnexpectedBetrayalDecision.prompt }}</p>
            <div class="test-dice omen-choices" role="group" aria-label="Ally Assets to discard">
              <button v-for="assetId in privateUnexpectedBetrayalDecision.optionIds" :key="assetId"
                @click="resolveUnexpectedBetrayalChoice(assetId)">Discard {{ assetById[assetId]?.name ?? assetId }}</button>
            </div>
          </section>
          <div v-if="game.gameResult.value" class="game-result" role="status">
            <span class="chapter">Game complete</span>
            <strong>{{ game.gameResult.value === 'investigators_win' ? 'Investigators win' : 'Investigators lose' }}</strong>
          </div>
          <aside v-if="activeMystery" class="active-mystery" aria-label="Active Mystery">
            <div><span class="chapter">Active Mystery</span><strong>{{ activeMystery.name }}</strong><small>{{ game.mysteryProgress.value }}/{{ game.mysteryTarget.value }} progress · {{ game.completedMysteryIds.value.length }} solved</small></div>
          </aside>
          <aside class="reserve-shelf" :class="{ collapsed: !reserveExpanded }" aria-label="Reserve market">
            <header><div><span class="chapter">Market</span><strong>Reserve</strong></div><button :aria-label="reserveExpanded ? 'Collapse reserve' : 'Expand reserve'" :aria-expanded="reserveExpanded" @click="reserveExpanded = !reserveExpanded">{{ reserveExpanded ? '‹' : '›' }}</button></header>
            <template v-if="reserveExpanded">
              <div class="reserve-grid">
                <button v-for="assetId in game.reserveAssetIds.value" :key="assetId" class="reserve-card" :class="{ selected: selectedReserveAssetIds.includes(assetId) }" :disabled="!privateAssetDecision" @click="toggleReserveAsset(assetId)">
                  <img :src="assetById[assetId]?.imageUrl" :alt="assetById[assetId]?.name"><span>{{ assetById[assetId]?.value }}</span>
                </button>
                <div v-for="slot in Math.max(0, 4 - game.reserveAssetIds.value.length)" :key="`empty-${slot}`" class="reserve-slot"><span>{{ slot }}</span><small>Empty</small></div>
              </div>
              <div v-if="privateAssetDecision" class="reserve-decision"><small>{{ privateAssetDecision.prompt }}</small><b v-if="privateAssetDecision.kind === 'select_acquired_cards'">{{ selectedReserveValue }}/{{ (privateAssetDecision.selectionBudget ?? 0) + (selectedReserveAssetIds.includes('bank-loan') ? 2 : 0) }} value</b><button @click="resolveAssetDecision">{{ privateAssetDecision.kind === 'select_acquired_cards' ? (selectedReserveAssetIds.some(id => id !== 'bank-loan') ? 'Buy selected' : 'Buy nothing') : (selectedReserveAssetIds.length ? 'Discard selected' : 'Keep all') }}</button></div>
              <button class="bank-loan" :disabled="!privateAssetDecision?.optionIds.includes('bank-loan')" :aria-pressed="selectedReserveAssetIds.includes('bank-loan')" @click="toggleReserveAsset('bank-loan')"><span>Bank loan</span><small>{{ selectedReserveAssetIds.includes('bank-loan') ? 'Debt selected · +2 successes' : 'Gain Debt for +2 successes' }}</small></button>
            </template>
          </aside>
          <div class="board-tools"><div class="route-legend" aria-label="Route legend"><span class="train">Train</span><span class="ship">Ship</span><span class="uncharted">Uncharted</span></div><div class="zoom-controls" aria-label="Map zoom controls"><button :disabled="boardZoom <= 1" aria-label="Zoom out" @click="changeZoom(-.5)">−</button><button @click="boardZoom = 1">{{ boardZoom }}×</button><button :disabled="boardZoom >= 2.5" aria-label="Zoom in" @click="changeZoom(.5)">+</button></div></div>
          <svg class="board" :viewBox="boardViewBox" role="graphics-document" aria-labelledby="board-title">
            <title id="board-title">Interactive Eldritch Horror world map</title>
            <image href="/map/eldritch-board.webp" :width="baseGameBoardDimensions.width" :height="baseGameBoardDimensions.height" aria-hidden="true" pointer-events="none"/>
            <line v-for="route in baseGameRoutes" :key="`${route.source}-${route.target}`" :x1="locationById[route.source].x" :y1="locationById[route.source].y" :x2="locationById[route.target].x" :y2="locationById[route.target].y" class="route" :class="[route.type, { legal: isLegalRoute(route.source, route.target) }]"/>
            <g v-for="locationItem in baseGameLocations" :key="locationItem.id" class="location" :class="[locationItem.type, { available: legalDestinations.has(locationItem.id) && isMyTurn, inspected: inspectedLocationId === locationItem.id }]" role="button" tabindex="0" :aria-label="`${locationItem.name}, ${locationItem.type}${legalDestinations.has(locationItem.id) && isMyTurn ? ', legal destination' : ''}`" @mouseenter="inspectedLocationId = locationItem.id" @focus="inspectedLocationId = locationItem.id" @click="selectLocation(locationItem.id)" @keyup.enter="selectLocation(locationItem.id)">
              <title>{{ locationItem.name }} · {{ locationItem.type }} space</title>
              <circle :cx="locationItem.x" :cy="locationItem.y" :r="locationItem.name.length > 3 ? 34 : 24"/>
            </g>
            <g v-for="(clue, index) in game.boardClues.value" :key="clue.id" class="board-clue" :transform="`translate(${(locationById[clue.locationId as LocationId]?.x ?? 0) + 40 + (game.boardClues.value.slice(0, index).filter(other => other.locationId === clue.locationId).length % 3) * 11}, ${(locationById[clue.locationId as LocationId]?.y ?? 0) + 28})`" aria-hidden="true" pointer-events="none">
              <image href="/tokens/clues/back.webp" x="-19" y="-19" width="38" height="38" />
            </g>
            <g v-for="(player, index) in game.players.value" :key="player.id" class="token" :transform="`translate(${locationById[player.locationId as LocationId]?.x + index * 26 - 13 || 0}, ${locationById[player.locationId as LocationId]?.y - 44 || 0})`">
              <circle r="20"/><text y="7">{{ player.displayName.slice(0, 1).toUpperCase() }}</text>
            </g>
          </svg>
          <div class="location-inspector" aria-live="polite">
            <template v-if="inspectedLocation"><div><span class="chapter">{{ inspectedLocation.type }} space</span><strong>{{ inspectedLocation.name }}</strong></div><p>{{ inspectedRoutes.length }} connections · {{ [...new Set(inspectedRoutes.map(route => route.type))].join(', ') }}<span v-if="inspectedClueCount"> · {{ inspectedClueCount }} Clue{{ inspectedClueCount === 1 ? '' : 's' }}</span></p><button v-if="legalDestinations.has(inspectedLocation.id) && isMyTurn" class="move-here" @click="move(inspectedLocation.id)">Move here</button><button class="inspector-close" aria-label="Close location details" @click="inspectedLocationId = undefined">×</button></template>
            <p v-else>Focus or hover a location to inspect its connections.</p>
          </div>
          <div class="action-controls"><button :disabled="!canUseNormalActions || game.performedActions.value.includes('rest')" @click="game.send({ type: 'REST' })">Rest</button><button :disabled="!canUseNormalActions || game.performedActions.value.includes('prepare_travel')" @click="game.send({ type: 'PREPARE_TRAVEL', ticketType: 'train' })">+ Train</button><button :disabled="!canUseNormalActions || game.performedActions.value.includes('prepare_travel')" @click="game.send({ type: 'PREPARE_TRAVEL', ticketType: 'ship' })">+ Ship</button><button :disabled="!canUseNormalActions || game.performedActions.value.includes('acquire_assets')" @click="game.send({ type: 'ACQUIRE_ASSETS' })">Acquire Assets</button><button v-for="localAction in localConditionActions" :key="`${localAction.ownerId}-${localAction.id}`" :disabled="!isMyTurn" @click="game.send({ type: 'USE_CONDITION_ACTION', targetPlayerId: localAction.ownerId, conditionKind: localAction.kind })">Resolve {{ localAction.name }} · {{ localAction.owner }}</button><button class="end-turn" :disabled="!isMyTurn" @click="game.send({ type: 'END_ACTIONS' })">End actions</button></div>
        </div>
        <aside class="investigator-dock" aria-label="Investigator information">
          <button class="dock-toggle" :aria-label="dockExpanded ? 'Close investigator details' : 'Open investigator details'" :aria-expanded="dockExpanded" @click="dockExpanded = !dockExpanded">{{ dockExpanded ? '×' : 'ℹ' }}</button>
          <nav class="party-tabs" aria-label="Party investigators">
            <button v-for="player in game.players.value" :key="player.id" :class="{ active: displayedPlayer?.id === player.id }" :aria-label="`Show ${player.displayName}`" :aria-pressed="displayedPlayer?.id === player.id" @click="selectedPlayerId = player.id; dockExpanded = true">
              <span class="party-initial">{{ player.displayName.slice(0, 1).toUpperCase() }}</span><span class="presence" :class="{ online: player.connected }"></span>
            </button>
          </nav>
          <div v-if="dockExpanded && displayedPlayer" class="investigator-sheet">
            <p class="chapter">{{ displayedPlayer.id === game.playerId.value ? 'Your investigator' : 'Party investigator' }}</p>
            <h2>{{ displayedInvestigator?.name }}</h2>
            <p class="investigator-role">{{ displayedInvestigator?.occupation }} · {{ displayedInvestigator?.role }}</p>
            <div class="dock-vitals"><div><small>Health</small><strong class="health">♥ {{ displayedPlayer.health }}</strong></div><div><small>Sanity</small><strong class="sanity">✦ {{ displayedPlayer.sanity }}</strong></div></div>
            <dl class="investigator-facts"><div><dt>Location</dt><dd>{{ locationById[displayedPlayer.locationId as LocationId]?.name }}</dd></div><div><dt>Clues</dt><dd>{{ displayedPlayer.clues }}</dd></div><div><dt>Tickets</dt><dd>Train {{ displayedPlayer.trainTickets }} · Ship {{ displayedPlayer.shipTickets }}</dd></div><div><dt>Turn</dt><dd>{{ displayedPlayer.id === game.activePlayerId.value ? 'Active' : 'Waiting' }}</dd></div><div><dt>Status</dt><dd>{{ displayedPlayer.connected ? 'Connected' : 'Away' }}</dd></div></dl>
            <template v-if="displayedInvestigator"><div class="dock-skills"><span v-for="skill in skillNames" :key="skill"><small>{{ skill.slice(0, 3) }}</small><b>{{ displayedSkillValue(skill) }}</b></span></div><p class="dock-ability"><b>Action</b>{{ displayedInvestigator.actionAbility }}</p><p class="dock-ability"><b>Passive</b>{{ displayedInvestigator.passiveAbility }}</p></template>
          </div>
        </aside>
        </div>
        <footer class="player-tray" :class="`tray-${trayState}`">
          <nav class="tray-tabs" aria-label="Player cards and game information">
            <button v-for="tab in trayTabs" :key="tab.id" :class="{ active: activeTrayTab === tab.id && trayState !== 'collapsed' }" :aria-expanded="activeTrayTab === tab.id && trayState !== 'collapsed'" @click="selectTrayTab(tab.id)"><span>{{ tab.icon }}</span>{{ tab.label }}<small>{{ tab.id === 'assets' ? ownedAssets.length : tab.id === 'artifacts' ? ownedArtifacts.length : tab.id === 'conditions' ? ownedConditions.length : 0 }}</small></button>
            <button class="tray-resize" :aria-label="trayState === 'expanded' ? 'Collapse tray' : 'Expand tray'" @click="cycleTrayState">{{ trayState === 'collapsed' ? '⌃' : trayState === 'peek' ? '⌃' : '⌄' }}</button>
          </nav>
          <div v-if="trayState !== 'collapsed'" class="tray-content">
            <div v-if="activeTrayTab === 'assets' && ownedAssets.length" class="owned-assets"><article v-for="asset in ownedAssets" :key="asset.id"><img :src="asset.imageUrl" :alt="asset.name"><div><p class="chapter">Value {{ asset.value }} · {{ asset.traits.join(', ') }}</p><h3>{{ asset.name }}</h3><p>{{ asset.effectText }}</p></div></article></div>
            <div v-else-if="activeTrayTab === 'artifacts' && ownedArtifacts.length" class="owned-assets"><article v-for="artifact in ownedArtifacts" :key="artifact.id"><img :src="artifact.imageUrl" :alt="artifact.name"><div><p class="chapter">{{ artifact.traits.join(', ') }} · {{ artifact.id === 'artifact_ttka_halot' ? 'Action available' : 'Effects pending' }}</p><h3>{{ artifact.name }}</h3><p>{{ artifact.effectText }}</p><button v-if="artifact.id === 'artifact_ttka_halot'" :disabled="!canUseNormalActions || game.usedArtifactActionIds.value.includes(artifact.id)" @click="game.send({ type: 'USE_ARTIFACT_ACTION', artifactId: 'artifact_ttka_halot' })">Use T'tka Halot · 1 action</button></div></article></div>
            <div v-else-if="activeTrayTab === 'conditions' && ownedConditions.length" class="owned-assets"><article v-for="condition in ownedConditions" :key="condition.id"><img :src="condition.frontImageUrl" :alt="condition.name"><div><p class="chapter">{{ condition.trait }}</p><h3>{{ condition.name }}</h3><p>{{ condition.frontText }}</p></div></article></div>
            <div v-else><p class="chapter">{{ trayTabs.find(tab => tab.id === activeTrayTab)?.label }}</p><h3>{{ activeTrayTab === 'log' ? 'No recorded events yet' : `No ${activeTrayTab} in your public game state` }}</h3><p>{{ activeTrayTab === 'log' ? 'Authoritative game events will appear here as the rules engine grows.' : 'This area shows only server-synchronized cards and tokens.' }}</p></div>
          </div>
        </footer>
      </section>
    </template>
  </main>
</template>

<style>
:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #07171c; color: #edf0df; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: radial-gradient(circle at 20% 0%, #173942 0, #07171c 42rem); }
button, input { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .42; }
.shell { width: min(1160px, calc(100% - 32px)); margin: auto; padding: 32px 0 64px; }
.masthead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #31505a; padding-bottom: 20px; }
h1 { margin: 3px 0 0; font: 700 clamp(2rem, 5vw, 4.2rem)/.9 Georgia, serif; letter-spacing: -.04em; }
h2 { font: 600 clamp(1.6rem, 3vw, 2.5rem)/1.05 Georgia, serif; margin: 8px 0 18px; }
.eyebrow, .chapter { color: #d5aa63; text-transform: uppercase; letter-spacing: .18em; font-size: .72rem; font-weight: 800; margin: 0; }
.status { text-transform: uppercase; font-size: .68rem; letter-spacing: .12em; border: 1px solid #48636a; border-radius: 100px; padding: 8px 12px; }
.status.connected { color: #9bd49b; border-color: #4c7656; }
.panel { background: linear-gradient(145deg, rgba(26,51,57,.94), rgba(11,29,34,.98)); border: 1px solid #36535b; border-radius: 18px; box-shadow: 0 20px 55px #0006; padding: clamp(22px, 4vw, 40px); }
.entry { max-width: 660px; margin: 70px auto; display: grid; gap: 15px; }
label { display: grid; gap: 7px; color: #b8c8c5; font-size: .82rem; }
input { width: 100%; color: #f6f2df; background: #07171c; border: 1px solid #47636a; border-radius: 9px; padding: 13px 14px; outline: none; }
input:focus { border-color: #d5aa63; box-shadow: 0 0 0 3px #d5aa6322; }
.primary, .secondary, .copy { border: 0; border-radius: 9px; padding: 12px 17px; font-weight: 800; }
.primary { color: #142127; background: #d5aa63; }
.secondary, .copy { color: #edf0df; background: #29464e; }
.divider { display: flex; align-items: center; gap: 12px; color: #718a8d; font-size: .75rem; text-transform: uppercase; letter-spacing: .12em; }
.divider::before, .divider::after { content: ''; height: 1px; flex: 1; background: #314d54; }
.muted { color: #93a7a7; line-height: 1.6; }
.loading { max-width: 400px; text-align: center; margin: 120px auto; }.sigil { color: #d5aa63; font-size: 2.5rem; }
.room-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; background: #10272d; border: 1px solid #31505a; padding: 14px 18px; border-radius: 12px; }
.room-bar div { display: flex; gap: 12px; align-items: center; }.room-bar span { color: #8da1a3; }.room-bar strong { font-family: ui-monospace, monospace; }
.error { color: #ffd2c8; background: #6b292955; border: 1px solid #9c4f48; padding: 12px 16px; border-radius: 10px; }
.lobby-grid, .game-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 18px; }
.roster-intro { margin: -8px 0 22px; }
.investigators { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.investigators button { display: flex; flex-direction: column; gap: 12px; text-align: left; color: #e9eadc; background: #0c2228; border: 1px solid #3b5961; border-radius: 12px; padding: 18px; }
.investigators button:hover:not(:disabled) { border-color: #7a969a; transform: translateY(-1px); }
.investigators button.selected { border-color: #d5aa63; box-shadow: inset 0 0 0 1px #d5aa63, 0 8px 24px #0004; }
.investigators button.taken { opacity: .58; }
.investigator-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.investigator-head > span:first-child { display: grid; gap: 3px; }
.investigator-head strong { font: 600 1.18rem Georgia, serif; color: #f1eedc; }
.investigator-head small, .loadout small { color: #91a7a8; }
.selection-mark { flex: none; color: #d5aa63; border: 1px solid #806b45; border-radius: 999px; padding: 4px 7px; font-size: .58rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.role { color: #d5aa63; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
.vitals { display: flex; align-items: center; gap: 13px; color: #bdd0cc; font-size: .75rem; }
.vitals b:first-child { color: #e49c8c; }.vitals b:nth-child(2) { color: #8fcbd7; }.vitals span { margin-left: auto; }
.skills { display: grid; grid-template-columns: repeat(5, 1fr); border-block: 1px solid #29454c; padding: 10px 0; }
.skills span { display: grid; place-items: center; gap: 3px; border-right: 1px solid #29454c; }.skills span:last-child { border: 0; }
.skills small { color: #80989a; font-size: .58rem; text-transform: uppercase; }.skills b { color: #e8e7d8; }
.loadout { min-height: 42px; color: #c6d0ca; font-size: .75rem; line-height: 1.45; }.loadout small { display: block; text-transform: uppercase; font-size: .56rem; letter-spacing: .08em; }
.ability { color: #aebfbc; font-size: .72rem; line-height: 1.45; }.ability b { color: #d5aa63; margin-right: 6px; text-transform: uppercase; font-size: .58rem; letter-spacing: .06em; }
.start { margin-top: 24px; width: 100%; }.roster { padding: 24px; }.roster article { display: flex; align-items: center; gap: 12px; padding: 15px 0; border-bottom: 1px solid #2b474e; }.roster p { margin: 4px 0 0; color: #91a7a8; text-transform: capitalize; }.roster small { color: #d5aa63; font-size: .58rem; letter-spacing: .1em; }
.ancient-ones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0 16px; }.ancient-ones button { position: relative; min-height: 94px; overflow: hidden; padding: 0; color: #eee9d5; background: #08191e; border: 1px solid #355159; border-radius: 9px; text-align: left; }.ancient-ones button.selected { border-color: #e4bd6d; box-shadow: 0 0 0 2px #d5aa6338; }.ancient-ones button:disabled { cursor: default; opacity: .78; }.ancient-ones img { width: 100%; height: 64px; display: block; object-fit: cover; object-position: 18% 22%; filter: brightness(.72) saturate(.8); }.ancient-ones button.selected img { filter: brightness(.95) saturate(1); }.ancient-ones span { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 7px; }.ancient-ones strong { font: 600 .68rem Georgia, serif; }.ancient-ones small { white-space: nowrap; }.roster .ancient-help { margin: -7px 0 18px; font-size: .7rem; text-transform: none; }
.presence { width: 9px; height: 9px; border-radius: 50%; background: #6a7374; }.presence.online { background: #7fcb8a; box-shadow: 0 0 10px #7fcb8a; }
.roster .resource-line { color: #c8b77e; font-size: .72rem; }
.board-wrap { padding: 20px; }.turn { display: flex; justify-content: space-between; padding: 6px 8px 18px; }.turn span { color: #91a7a8; }.turn strong { color: #d5aa63; }
.board-tools { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: -8px 6px 10px; }.route-legend { display: flex; gap: 15px; color: #aebcba; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; }.route-legend span::before { content: ''; display: inline-block; width: 20px; height: 3px; margin-right: 6px; vertical-align: middle; background: currentColor; }.route-legend .train { color: #d9a84e; }.route-legend .ship { color: #7dc2db; }.route-legend .uncharted { color: #9aa8a0; }.zoom-controls { display: flex; overflow: hidden; border: 1px solid #45616a; border-radius: 7px; }.zoom-controls button { min-width: 34px; color: #d8e2df; background: #17343b; border: 0; border-right: 1px solid #45616a; padding: 5px 8px; font-size: .72rem; }.zoom-controls button:last-child { border: 0; }
.board { width: 100%; background: #071b22; border: 1px solid #45616a; border-radius: 20px; }.route { stroke-width: 6; opacity: .12; pointer-events: none; transition: opacity .2s, stroke-width .2s; }.route.train { stroke: #d9a84e; }.route.ship { stroke: #72bbd7; }.route.uncharted { stroke: #e0d7a5; stroke-dasharray: 12 15; }.route.legal { opacity: 1; stroke-width: 11; filter: drop-shadow(0 0 9px currentColor); animation: route-flow 1.1s linear infinite; }.location { outline: none; cursor: default; }.location circle { fill: transparent; stroke: transparent; stroke-width: 6; transition: fill .2s, filter .2s, stroke .2s; }.location.available { cursor: pointer; }.location.available circle, .location.available:focus circle { fill: #d5aa6344; stroke: #fff0bd; filter: drop-shadow(0 0 14px #d5aa63); animation: destination-pulse 1.5s ease-in-out infinite; }.location.inspected circle { fill: #ffffff24; stroke: #fff; filter: drop-shadow(0 0 10px #fff8); }.token { transition: transform .55s cubic-bezier(.2,.8,.2,1); }.token circle { fill: #ebd17d; stroke: #07171c; stroke-width: 5; filter: drop-shadow(0 5px 7px #000); }.token text { fill: #07171c; text-anchor: middle; font-size: 18px; font-weight: 900; stroke: none; }
.location-inspector { min-height: 58px; display: flex; align-items: center; gap: 18px; margin: 10px 2px 0; padding: 10px 14px; background: #091d22; border: 1px solid #29464e; border-radius: 10px; }.location-inspector div { display: grid; min-width: 150px; }.location-inspector strong { font: 600 1.05rem Georgia, serif; }.location-inspector p { flex: 1; margin: 0; color: #91a7a8; font-size: .75rem; text-transform: capitalize; }.move-here { color: #142127; background: #d5aa63; border: 0; border-radius: 7px; padding: 8px 12px; font-weight: 800; }
@keyframes destination-pulse { 50% { filter: drop-shadow(0 0 10px #ffe6a0); } } @keyframes route-flow { to { stroke-dashoffset: -18; } }
.board-wrap > button { width: 100%; margin-top: 12px; }
.playing-shell { position: fixed; inset: 0; width: 100%; height: 100dvh; padding: 0; overflow: hidden; background: #061216; }
.playing-shell > .error { position: fixed; z-index: 20; top: 66px; left: 50%; width: min(620px, calc(100% - 32px)); margin: 0; transform: translateX(-50%); }
.game-shell { display: grid; grid-template-rows: 54px minmax(0, 1fr) 48px; height: 100%; }.game-shell.tray-peek { grid-template-rows: 54px minmax(0, 1fr) 190px; }.game-shell.tray-expanded { grid-template-rows: 54px minmax(0, 1fr) min(48vh, 480px); }
.game-hud { z-index: 5; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; padding: 0 14px; background: linear-gradient(180deg, #17323a, #0c2228); border-bottom: 1px solid #3d5960; box-shadow: 0 5px 18px #0008; }
.game-hud__brand, .game-hud__room, .game-hud__turn { display: flex; align-items: center; gap: 10px; }.game-hud__brand strong { font: 600 1rem Georgia, serif; }.sigil-small { color: #d5aa63; }.game-hud__turn { flex-direction: column; gap: 1px; text-align: center; }.game-hud__turn span { color: #91a7a8; font-size: .62rem; text-transform: uppercase; letter-spacing: .12em; }.game-hud__turn strong { color: #e9ce8b; font-size: .8rem; }.game-hud__room { justify-content: flex-end; }.game-hud__room code { color: #91a7a8; font-size: .68rem; }.hud-button { color: #e8e8dc; background: #29464e; border: 1px solid #47646c; border-radius: 7px; padding: 6px 10px; font-size: .7rem; font-weight: 800; }
.game-workspace { position: relative; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 58px; }
.board-stage { position: relative; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; padding: 10px; background: radial-gradient(circle at 50% 45%, #18333a, #050f12 75%); }
.doom-display { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 5; background: #07171cf2; padding: 8px; border-radius: 8px; color: #d5aa63; }
.travel-planner { position: absolute; z-index: 7; top: 70px; left: 50%; transform: translateX(-50%); width: min(480px, calc(100% - 32px)); display: grid; gap: 9px; padding: 14px; background: #07171cf2; border: 1px solid #d5aa63; border-radius: 10px; box-shadow: 0 10px 30px #0009; }.travel-planner small { color: #c9d5d1; }.travel-planner div { display: flex; gap: 8px; }.travel-planner button { padding: 8px 12px; border: 1px solid #647e86; border-radius: 6px; color: #edf0df; background: #29464e; }.travel-planner button:last-child { background: #d5aa63; color: #142127; }
.encounter-panel { position: absolute; z-index: 7; top: 70px; left: 18px; width: min(300px, calc(100% - 36px)); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px; color: #edf0df; background: #07171cf2; border: 1px solid #d5aa63; border-radius: 10px; box-shadow: 0 10px 30px #0009; }.encounter-panel div { width: 100%; display: grid; gap: 4px; }.encounter-panel small { color: #c9d5d1; }.encounter-panel button { padding: 8px 12px; border: 1px solid #647e86; border-radius: 6px; color: #edf0df; background: #29464e; cursor: pointer; }.encounter-panel img { width: 90px; max-height: 130px; object-fit: contain; }.game-error { position: absolute; z-index: 12; top: 58px; left: 50%; transform: translateX(-50%); max-width: min(600px, calc(100vw - 24px)); padding: 8px 12px; background: #36191dec; border: 1px solid #ad6268; border-radius: 8px; }
.mythos-panel { width: min(350px, calc(100% - 36px)); }.mythos-panel img { width: 160px; max-height: 250px; }
.board-stage .board { display: block; width: 100%; height: 100%; max-height: 100%; border-radius: 12px; }
.active-mystery { position: absolute; z-index: 5; top: 60px; right: 18px; min-width: 180px; padding: 10px 12px; color: #edf0df; background: #07171cee; border: 1px solid #6e5a36; border-radius: 10px; box-shadow: 0 8px 28px #0009; backdrop-filter: blur(10px); }.active-mystery div { display: grid; gap: 3px; }.active-mystery strong { font: 600 .78rem/1.15 Georgia, serif; }.active-mystery small { color: #91a7a8; font-size: .6rem; }
.game-result { position: absolute; z-index: 8; top: 18px; left: 50%; min-width: 220px; display: grid; gap: 3px; padding: 11px 22px; transform: translateX(-50%); color: #f7efd8; background: #1b1510ee; border: 1px solid #d5aa63; border-radius: 10px; box-shadow: 0 10px 35px #000b, 0 0 24px #d5aa6330; text-align: center; backdrop-filter: blur(10px); }.game-result strong { color: #e9ce8b; font: 600 1.1rem Georgia, serif; }
.test-dialog { position: absolute; z-index: 10; left: 50%; top: 50%; width: min(430px, calc(100% - 32px)); display: grid; gap: 14px; padding: 24px; transform: translate(-50%, -50%); color: #edf0df; background: #07171cf2; border: 1px solid #d5aa63; border-radius: 14px; box-shadow: 0 24px 80px #000d, 0 0 30px #d5aa6328; backdrop-filter: blur(14px); }.test-dialog h2, .test-dialog p { margin: 0; }.test-dialog > strong { color: #d5aa63; text-align: center; }.test-dice { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }.test-dice button { width: 50px; height: 50px; color: #e5e9dc; background: #122a30; border: 1px solid #58727a; border-radius: 9px; font-size: 1.25rem; font-weight: 900; }.test-dice button.success { color: #d9f2c5; border-color: #7aa46c; }.test-dice button.selected { color: #142127; background: #d5aa63; border-color: #f5dda7; box-shadow: 0 0 0 3px #d5aa6340; }
.omen-choices button { width: auto; min-width: 90px; padding: 0 10px; font-size: .9rem; }
.board-stage .board-tools { position: absolute; z-index: 4; top: 18px; left: 18px; right: 18px; margin: 0; pointer-events: none; }.board-stage .board-tools > * { pointer-events: auto; }.board-stage .route-legend { padding: 7px 10px; border: 1px solid #45616a; border-radius: 8px; background: #07171cdd; backdrop-filter: blur(8px); }
.board-stage .location-inspector { position: absolute; z-index: 4; left: 18px; bottom: 18px; width: min(520px, calc(100% - 150px)); margin: 0; background: #07171cee; box-shadow: 0 8px 28px #0009; backdrop-filter: blur(10px); }
.reserve-shelf { position: absolute; z-index: 5; top: 66px; left: 18px; width: clamp(150px, 16vw, 220px); max-height: calc(100% - 155px); overflow: auto; padding: 12px; background: #07171ce8; border: 1px solid #49636a; border-radius: 12px; box-shadow: 0 12px 34px #000a; backdrop-filter: blur(10px); }.reserve-shelf header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.reserve-shelf header > div { display: grid; gap: 2px; }.reserve-shelf header strong { font: 600 1rem Georgia, serif; }.reserve-shelf header button { width: 28px; height: 28px; color: #d5aa63; background: #17343b; border: 1px solid #48636a; border-radius: 7px; }.reserve-shelf.collapsed { width: 48px; padding: 8px; overflow: hidden; }.reserve-shelf.collapsed header > div { display: none; }.reserve-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-top: 12px; }.reserve-slot { aspect-ratio: 3 / 4; display: grid; place-items: center; align-content: center; gap: 3px; color: #71898b; background: #0a2025; border: 1px dashed #50686d; border-radius: 7px; }.reserve-slot span { color: #d5aa63; font: 600 1rem Georgia, serif; }.reserve-slot small { font-size: .54rem; text-transform: uppercase; letter-spacing: .08em; }.bank-loan { width: 100%; display: grid; gap: 2px; margin-top: 8px; padding: 8px; text-align: left; color: #b7c4c1; background: #172a2c; border: 1px solid #5e6c65; border-radius: 7px; }.bank-loan span { color: #d5aa63; font-size: .68rem; font-weight: 800; text-transform: uppercase; }.bank-loan small { font-size: .55rem; }
.reserve-card { position: relative; aspect-ratio: 3 / 4; overflow: hidden; padding: 0; background: #0a2025; border: 2px solid transparent; border-radius: 7px; }.reserve-card img { width: 100%; height: 100%; object-fit: cover; display: block; }.reserve-card > span { position: absolute; right: 4px; bottom: 4px; display: grid; place-items: center; width: 20px; height: 20px; color: #142127; background: #d5aa63; border-radius: 50%; font-size: .7rem; font-weight: 900; }.reserve-card.selected { border-color: #f3c870; box-shadow: 0 0 0 2px #f3c87055; }.reserve-decision { display: grid; gap: 6px; margin-top: 9px; padding: 8px; color: #c9d5d1; background: #122a30; border: 1px solid #49636a; border-radius: 7px; font-size: .62rem; line-height: 1.35; }.reserve-decision b { color: #d5aa63; }.reserve-decision button { padding: 7px; color: #142127; background: #d5aa63; border: 0; border-radius: 5px; font-size: .62rem; font-weight: 900; }
.inspector-close { align-self: flex-start; color: #91a7a8; background: transparent; border: 0; padding: 0 2px; font-size: 1.2rem; }
.action-controls { position: absolute; z-index: 5; right: 18px; bottom: 18px; display: flex; gap: 6px; padding: 5px; background: #07171ce8; border: 1px solid #45616a; border-radius: 11px; box-shadow: 0 8px 24px #0008; backdrop-filter: blur(8px); }.action-controls button { color: #d7dfda; background: #29464e; border: 0; border-radius: 7px; padding: 9px 11px; font-size: .68rem; font-weight: 800; }.action-controls .end-turn { color: #142127; background: #d5aa63; }
.investigator-dock { position: relative; min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); overflow: hidden; background: linear-gradient(145deg, #142e35, #091a1f); border-left: 1px solid #3a565e; transition: width .2s; }.investigator-dock.collapsed { grid-template-columns: 1fr; }.dock-toggle { position: absolute; z-index: 2; top: 8px; left: -1px; width: 25px; height: 30px; color: #d5aa63; background: #17343b; border: 1px solid #48636a; border-left: 0; border-radius: 0 7px 7px 0; font-size: 1.2rem; }.party-tabs { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 48px 7px 10px; background: #07191e; border-right: 1px solid #29464e; }.party-tabs button { position: relative; width: 38px; height: 38px; padding: 0; color: #dce4df; background: #1b3941; border: 1px solid #49636a; border-radius: 50%; font-weight: 900; }.party-tabs button.active { color: #18272c; background: #d5aa63; border-color: #f3d797; box-shadow: 0 0 0 3px #d5aa6325; }.party-tabs .presence { position: absolute; right: -1px; bottom: 0; border: 2px solid #07191e; }.investigator-dock.collapsed .party-tabs { border-right: 0; }.investigator-sheet { min-width: 0; overflow-y: auto; padding: 28px 16px 20px; }.investigator-sheet h2 { margin: 5px 0 2px; font-size: 1.35rem; }.investigator-role { min-height: 35px; margin: 0; color: #8da1a3; font-size: .68rem; line-height: 1.4; }.dock-vitals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0; }.dock-vitals div { display: grid; gap: 3px; padding: 10px; background: #07191e; border: 1px solid #29464e; border-radius: 8px; }.dock-vitals small, .investigator-facts dt { color: #82999b; font-size: .58rem; text-transform: uppercase; letter-spacing: .08em; }.dock-vitals strong { font-size: 1rem; }.dock-vitals .health { color: #e9a292; }.dock-vitals .sanity { color: #8fd1de; }.investigator-facts { display: grid; gap: 8px; margin: 0 0 14px; }.investigator-facts div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #29464e; padding-bottom: 7px; }.investigator-facts dd { margin: 0; color: #d8ded8; font-size: .68rem; text-align: right; }.dock-skills { display: grid; grid-template-columns: repeat(5, 1fr); margin: 12px 0; }.dock-skills span { display: grid; place-items: center; gap: 3px; border-right: 1px solid #29464e; }.dock-skills span:last-child { border: 0; }.dock-skills small { color: #82999b; font-size: .52rem; text-transform: uppercase; }.dock-skills b { font-size: .75rem; }.dock-ability { margin: 8px 0 0; color: #9eb0ad; font-size: .63rem; line-height: 1.45; }.dock-ability b { display: block; color: #d5aa63; font-size: .55rem; text-transform: uppercase; letter-spacing: .08em; }
.player-tray { z-index: 6; min-height: 0; overflow: hidden; background: linear-gradient(180deg, #10282f, #07171c); border-top: 1px solid #3d5960; box-shadow: 0 -8px 24px #0007; }.tray-tabs { height: 47px; display: flex; align-items: stretch; overflow-x: auto; padding-left: 8px; }.tray-tabs button { flex: none; display: flex; align-items: center; gap: 7px; color: #9db0af; background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 0 12px; font-size: .7rem; font-weight: 800; }.tray-tabs button > span { color: #d5aa63; }.tray-tabs button small { min-width: 17px; color: #819697; background: #07171c; border-radius: 999px; padding: 2px 5px; font-size: .52rem; }.tray-tabs button.active { color: #f0eddb; background: #17343b; border-bottom-color: #d5aa63; }.tray-tabs .tray-resize { width: 44px; margin-left: auto; justify-content: center; color: #d5aa63; border-left: 1px solid #29464e; font-size: 1rem; }.tray-content { height: calc(100% - 47px); overflow: auto; padding: 18px 24px; border-top: 1px solid #213c43; }.tray-content h3 { margin: 5px 0; font: 600 1.05rem Georgia, serif; }.tray-content p:last-child { max-width: 620px; margin: 0; color: #8fa3a4; font-size: .72rem; line-height: 1.5; }
.investigator-dock { position: relative; z-index: 10; display: block; overflow: visible; min-width: 58px; background: #07191e; border-left: 1px solid #3a565e; }.investigator-dock .party-tabs { position: relative; z-index: 2; height: 100%; border-right: 0; }.investigator-dock .dock-toggle { position: absolute; z-index: 3; top: 8px; left: 50%; width: 38px; height: 32px; transform: translateX(-50%); border: 1px solid #48636a; border-radius: 8px; font-size: .9rem; }.investigator-dock .investigator-sheet { position: absolute; z-index: 1; top: 0; right: 57px; bottom: 0; width: 286px; overflow-y: auto; padding: 28px 18px 20px; background: linear-gradient(145deg, #142e35, #091a1f); border-left: 1px solid #3a565e; box-shadow: -14px 0 34px #000b; animation: investigator-drawer-in .18s ease-out; }.investigator-dock .party-tabs button.active { box-shadow: 0 0 0 3px #d5aa6325, 0 0 16px #d5aa6344; }
@media (min-width: 1001px) { .game-workspace.dock-expanded .action-controls { right: 304px; max-width: calc(100% - 322px); overflow-x: auto; } }
.owned-assets { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; }.owned-assets article { flex: 0 0 min(360px, 80vw); display: grid; grid-template-columns: 90px 1fr; gap: 12px; padding: 10px; background: #10272d; border: 1px solid #36535b; border-radius: 10px; }.owned-assets img { width: 90px; border-radius: 5px; }.owned-assets h3 { margin: 4px 0 7px; }.owned-assets p:last-child { color: #b7c4c1; }
@keyframes investigator-drawer-in { from { opacity: 0; transform: translateX(18px); } }
@media (max-width: 1000px) {
  .game-workspace { grid-template-columns: minmax(0, 1fr); }
  .investigator-dock { position: absolute; inset: 0 0 0 auto; width: 58px; min-width: 58px; }.investigator-dock .investigator-sheet { width: min(300px, calc(100vw - 78px)); }
  .board-stage { padding-right: 62px; }
}
@media (max-width: 800px) {
  .lobby-grid, .game-grid { grid-template-columns: 1fr; }.investigators { grid-template-columns: 1fr; }.masthead { align-items: flex-end; }.room-bar { align-items: flex-start; gap: 12px; flex-direction: column; }.copy { width: 100%; }
  .game-hud { grid-template-columns: 1fr auto; }.game-hud__brand { display: none; }.game-hud__turn { align-items: flex-start; text-align: left; }.game-hud__room code, .route-legend { display: none; }
  .board-stage .location-inspector { width: calc(100% - 105px); left: 10px; bottom: 10px; padding: 9px 10px; gap: 9px; }.board-stage .location-inspector div { min-width: 95px; }.board-stage .location-inspector p { display: none; }.action-controls { right: 68px; bottom: 10px; max-width: calc(100% - 78px); overflow-x: auto; }.action-controls button { padding: 8px; white-space: nowrap; }.board-stage .board-tools { top: 10px; left: 10px; right: 80px; justify-content: flex-end; }
  .tray-tabs button { padding: 0 9px; }.tray-tabs button small { display: none; }.tray-tabs .archive-tab { margin-left: 0; }.tray-tabs .tray-resize { margin-left: auto; }
  .reserve-shelf { top: 52px; left: 10px; width: 138px; max-height: calc(100% - 115px); padding: 9px; }.reserve-shelf header strong { font-size: .85rem; }.reserve-grid { gap: 5px; margin-top: 8px; }.bank-loan { padding: 6px; }
}
@media (max-width: 600px) {
  .board-stage { padding: 4px 62px 4px 4px; }.game-shell.tray-peek { grid-template-rows: 54px minmax(0, 1fr) 170px; }.game-shell.tray-expanded { grid-template-rows: 54px minmax(0, 1fr) 55vh; }
  .tray-tabs button { width: 43px; justify-content: center; overflow: hidden; color: transparent; gap: 0; padding: 0; }.tray-tabs button > span { color: #d5aa63; font-size: .9rem; }.tray-tabs .tray-resize { width: 43px; color: #d5aa63; }.tray-content { padding: 15px; }
}
.test-dialog { max-height: calc(100% - 32px); overflow-y: auto; }
.test-dice > span { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid #58727a; border-radius: 9px; font-size: 1.25rem; }
.test-dice > span.success { color: #d9f2c5; border-color: #7aa46c; }
.reroll-sources button { width: auto; height: auto; min-height: 40px; flex: 1 1 160px; padding: 8px; font-size: .85rem; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .route.legal, .location.available circle { animation: none; }.token { transition: none; } }
</style>
