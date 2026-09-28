<script setup lang="ts">
import { baseGameAncientOnes, baseGameAssets, baseGameBoardDimensions, baseGameInvestigators, baseGameLocations, baseGameMap, baseGameMysteries, baseGameRoutes, skillNames } from '@eldritch/content'
import type { AssetCardData } from '@eldritch/content'
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
const trayTabs = [
  { id: 'assets', label: 'Assets', icon: '◆' },
  { id: 'spells', label: 'Spells', icon: '✦' },
  { id: 'conditions', label: 'Conditions', icon: '◈' },
  { id: 'tasks', label: 'Tasks', icon: '✓' },
  { id: 'log', label: 'Log', icon: '≡' },
] as const
const game = useGameRoom()

const locationById = Object.fromEntries(baseGameLocations.map((location) => [location.id, location])) as Record<LocationId, typeof baseGameLocations[number]>
const investigatorById = Object.fromEntries(baseGameInvestigators.map((investigator) => [investigator.id, investigator]))
const assetById = Object.fromEntries(baseGameAssets.map((asset) => [asset.id, asset]))
const me = computed(() => game.players.value.find((player) => player.id === game.playerId.value))
const displayedPlayer = computed(() => game.players.value.find((player) => player.id === selectedPlayerId.value) ?? me.value ?? game.players.value[0])
const displayedInvestigator = computed(() => displayedPlayer.value?.investigatorId ? investigatorById[displayedPlayer.value.investigatorId] : undefined)
const activeMystery = computed(() => baseGameMysteries.find((mystery) => mystery.id === game.activeMysteryId.value))
const selectedByInvestigator = computed(() => new Map(game.players.value
  .filter((player) => player.investigatorId)
  .map((player) => [player.investigatorId, player])))
const isMyTurn = computed(() => game.phase.value === 'action' && game.activePlayerId.value === game.playerId.value)
const legalDestinations = computed(() => new Set(
  me.value?.locationId
    ? baseGameMap.adjacentLocationIds[me.value.locationId as LocationId] ?? []
    : []
))
const inspectedLocation = computed(() => inspectedLocationId.value ? locationById[inspectedLocationId.value] : undefined)
const myAssetIds = computed(() => me.value?.assetIds ? me.value.assetIds.split(',') : [])
const ownedAssets = computed(() => myAssetIds.value.map((id) => assetById[id]).filter((asset): asset is AssetCardData => Boolean(asset)))
const privateAssetDecision = computed(() => {
  const decision = game.pendingDecision.value
  return decision && decision.playerId === game.playerId.value && 'optionIds' in decision
    && (decision.kind === 'select_acquired_cards' || decision.kind === 'discard_reserve_card') ? decision : undefined
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
  if (isMyTurn.value && legalDestinations.value.has(destinationId)) game.send({ type: 'TRAVEL', destinationIds: [destinationId] })
}

function selectLocation(destinationId: LocationId) {
  inspectedLocationId.value = destinationId
  move(destinationId)
}

function isLegalRoute(source: LocationId, target: LocationId) {
  const current = me.value?.locationId
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

function toggleReserveAsset(assetId: string) {
  const decision = privateAssetDecision.value
  if (!decision || !decision.optionIds.includes(assetId)) return
  if (selectedReserveAssetIds.value.includes(assetId)) {
    selectedReserveAssetIds.value = selectedReserveAssetIds.value.filter((id) => id !== assetId)
    return
  }
  if (decision.kind === 'discard_reserve_card') {
    selectedReserveAssetIds.value = [assetId]
    return
  }
  const nextValue = selectedReserveValue.value + (assetById[assetId]?.value ?? 0)
  if (nextValue <= (decision.selectionBudget ?? 0)) selectedReserveAssetIds.value = [...selectedReserveAssetIds.value, assetId]
}

function resolveAssetDecision() {
  const decision = privateAssetDecision.value
  if (!decision) return
  game.send({ type: 'RESOLVE_DECISION', decisionId: decision.id, selectedOptionIds: selectedReserveAssetIds.value })
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
        <div class="game-workspace">
        <div class="board-stage">
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
              <div v-if="privateAssetDecision" class="reserve-decision"><small>{{ privateAssetDecision.prompt }}</small><b v-if="privateAssetDecision.kind === 'select_acquired_cards'">{{ selectedReserveValue }}/{{ privateAssetDecision.selectionBudget ?? 0 }} value</b><button @click="resolveAssetDecision">{{ privateAssetDecision.kind === 'select_acquired_cards' ? (selectedReserveAssetIds.length ? 'Buy selected' : 'Buy nothing') : (selectedReserveAssetIds.length ? 'Discard selected' : 'Keep all') }}</button></div>
              <button class="bank-loan" disabled><span>Bank loan</span><small>Not available in game state</small></button>
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
            <g v-for="(player, index) in game.players.value" :key="player.id" class="token" :transform="`translate(${locationById[player.locationId as LocationId]?.x + index * 26 - 13 || 0}, ${locationById[player.locationId as LocationId]?.y - 44 || 0})`">
              <circle r="20"/><text y="7">{{ player.displayName.slice(0, 1).toUpperCase() }}</text>
            </g>
          </svg>
          <div class="location-inspector" aria-live="polite">
            <template v-if="inspectedLocation"><div><span class="chapter">{{ inspectedLocation.type }} space</span><strong>{{ inspectedLocation.name }}</strong></div><p>{{ inspectedRoutes.length }} connections · {{ [...new Set(inspectedRoutes.map(route => route.type))].join(', ') }}</p><button v-if="legalDestinations.has(inspectedLocation.id) && isMyTurn" class="move-here" @click="move(inspectedLocation.id)">Move here</button><button class="inspector-close" aria-label="Close location details" @click="inspectedLocationId = undefined">×</button></template>
            <p v-else>Focus or hover a location to inspect its connections.</p>
          </div>
          <div class="action-controls"><button :disabled="!isMyTurn || game.performedActions.value.includes('rest')" @click="game.send({ type: 'REST' })">Rest</button><button :disabled="!isMyTurn || game.performedActions.value.includes('prepare_travel')" @click="game.send({ type: 'PREPARE_TRAVEL', ticketType: 'train' })">+ Train</button><button :disabled="!isMyTurn || game.performedActions.value.includes('prepare_travel')" @click="game.send({ type: 'PREPARE_TRAVEL', ticketType: 'ship' })">+ Ship</button><button :disabled="!isMyTurn || game.performedActions.value.includes('acquire_assets')" @click="game.send({ type: 'ACQUIRE_ASSETS' })">Acquire Assets</button><button class="end-turn" :disabled="!isMyTurn" @click="game.send({ type: 'END_ACTIONS' })">End actions</button></div>
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
            <dl class="investigator-facts"><div><dt>Location</dt><dd>{{ locationById[displayedPlayer.locationId as LocationId]?.name }}</dd></div><div><dt>Tickets</dt><dd>Train {{ displayedPlayer.trainTickets }} · Ship {{ displayedPlayer.shipTickets }}</dd></div><div><dt>Turn</dt><dd>{{ displayedPlayer.id === game.activePlayerId.value ? 'Active' : 'Waiting' }}</dd></div><div><dt>Status</dt><dd>{{ displayedPlayer.connected ? 'Connected' : 'Away' }}</dd></div></dl>
            <template v-if="displayedInvestigator"><div class="dock-skills"><span v-for="skill in skillNames" :key="skill"><small>{{ skill.slice(0, 3) }}</small><b>{{ displayedInvestigator.skills[skill] }}</b></span></div><p class="dock-ability"><b>Action</b>{{ displayedInvestigator.actionAbility }}</p><p class="dock-ability"><b>Passive</b>{{ displayedInvestigator.passiveAbility }}</p></template>
          </div>
        </aside>
        </div>
        <footer class="player-tray" :class="`tray-${trayState}`">
          <nav class="tray-tabs" aria-label="Player cards and game information">
            <button v-for="tab in trayTabs" :key="tab.id" :class="{ active: activeTrayTab === tab.id && trayState !== 'collapsed' }" :aria-expanded="activeTrayTab === tab.id && trayState !== 'collapsed'" @click="selectTrayTab(tab.id)"><span>{{ tab.icon }}</span>{{ tab.label }}<small>{{ tab.id === 'assets' ? ownedAssets.length : 0 }}</small></button>
            <button class="tray-resize" :aria-label="trayState === 'expanded' ? 'Collapse tray' : 'Expand tray'" @click="cycleTrayState">{{ trayState === 'collapsed' ? '⌃' : trayState === 'peek' ? '⌃' : '⌄' }}</button>
          </nav>
          <div v-if="trayState !== 'collapsed'" class="tray-content">
            <div v-if="activeTrayTab === 'assets' && ownedAssets.length" class="owned-assets"><article v-for="asset in ownedAssets" :key="asset.id"><img :src="asset.imageUrl" :alt="asset.name"><div><p class="chapter">Value {{ asset.value }} · {{ asset.traits.join(', ') }}</p><h3>{{ asset.name }}</h3><p>{{ asset.effectText }}</p></div></article></div>
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
.board-stage .board { display: block; width: 100%; height: 100%; max-height: 100%; border-radius: 12px; }
.active-mystery { position: absolute; z-index: 5; top: 60px; right: 18px; min-width: 180px; padding: 10px 12px; color: #edf0df; background: #07171cee; border: 1px solid #6e5a36; border-radius: 10px; box-shadow: 0 8px 28px #0009; backdrop-filter: blur(10px); }.active-mystery div { display: grid; gap: 3px; }.active-mystery strong { font: 600 .78rem/1.15 Georgia, serif; }.active-mystery small { color: #91a7a8; font-size: .6rem; }
.game-result { position: absolute; z-index: 8; top: 18px; left: 50%; min-width: 220px; display: grid; gap: 3px; padding: 11px 22px; transform: translateX(-50%); color: #f7efd8; background: #1b1510ee; border: 1px solid #d5aa63; border-radius: 10px; box-shadow: 0 10px 35px #000b, 0 0 24px #d5aa6330; text-align: center; backdrop-filter: blur(10px); }.game-result strong { color: #e9ce8b; font: 600 1.1rem Georgia, serif; }
.board-stage .board-tools { position: absolute; z-index: 4; top: 18px; left: 18px; right: 18px; margin: 0; pointer-events: none; }.board-stage .board-tools > * { pointer-events: auto; }.board-stage .route-legend { padding: 7px 10px; border: 1px solid #45616a; border-radius: 8px; background: #07171cdd; backdrop-filter: blur(8px); }
.board-stage .location-inspector { position: absolute; z-index: 4; left: 18px; bottom: 18px; width: min(520px, calc(100% - 150px)); margin: 0; background: #07171cee; box-shadow: 0 8px 28px #0009; backdrop-filter: blur(10px); }
.reserve-shelf { position: absolute; z-index: 5; top: 66px; left: 18px; width: clamp(150px, 16vw, 220px); max-height: calc(100% - 155px); overflow: auto; padding: 12px; background: #07171ce8; border: 1px solid #49636a; border-radius: 12px; box-shadow: 0 12px 34px #000a; backdrop-filter: blur(10px); }.reserve-shelf header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.reserve-shelf header > div { display: grid; gap: 2px; }.reserve-shelf header strong { font: 600 1rem Georgia, serif; }.reserve-shelf header button { width: 28px; height: 28px; color: #d5aa63; background: #17343b; border: 1px solid #48636a; border-radius: 7px; }.reserve-shelf.collapsed { width: 48px; padding: 8px; overflow: hidden; }.reserve-shelf.collapsed header > div { display: none; }.reserve-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-top: 12px; }.reserve-slot { aspect-ratio: 3 / 4; display: grid; place-items: center; align-content: center; gap: 3px; color: #71898b; background: #0a2025; border: 1px dashed #50686d; border-radius: 7px; }.reserve-slot span { color: #d5aa63; font: 600 1rem Georgia, serif; }.reserve-slot small { font-size: .54rem; text-transform: uppercase; letter-spacing: .08em; }.bank-loan { width: 100%; display: grid; gap: 2px; margin-top: 8px; padding: 8px; text-align: left; color: #b7c4c1; background: #172a2c; border: 1px solid #5e6c65; border-radius: 7px; }.bank-loan span { color: #d5aa63; font-size: .68rem; font-weight: 800; text-transform: uppercase; }.bank-loan small { font-size: .55rem; }
.reserve-card { position: relative; aspect-ratio: 3 / 4; overflow: hidden; padding: 0; background: #0a2025; border: 2px solid transparent; border-radius: 7px; }.reserve-card img { width: 100%; height: 100%; object-fit: cover; display: block; }.reserve-card > span { position: absolute; right: 4px; bottom: 4px; display: grid; place-items: center; width: 20px; height: 20px; color: #142127; background: #d5aa63; border-radius: 50%; font-size: .7rem; font-weight: 900; }.reserve-card.selected { border-color: #f3c870; box-shadow: 0 0 0 2px #f3c87055; }.reserve-decision { display: grid; gap: 6px; margin-top: 9px; padding: 8px; color: #c9d5d1; background: #122a30; border: 1px solid #49636a; border-radius: 7px; font-size: .62rem; line-height: 1.35; }.reserve-decision b { color: #d5aa63; }.reserve-decision button { padding: 7px; color: #142127; background: #d5aa63; border: 0; border-radius: 5px; font-size: .62rem; font-weight: 900; }
.inspector-close { align-self: flex-start; color: #91a7a8; background: transparent; border: 0; padding: 0 2px; font-size: 1.2rem; }
.action-controls { position: absolute; z-index: 5; right: 18px; bottom: 18px; display: flex; gap: 6px; padding: 5px; background: #07171ce8; border: 1px solid #45616a; border-radius: 11px; box-shadow: 0 8px 24px #0008; backdrop-filter: blur(8px); }.action-controls button { color: #d7dfda; background: #29464e; border: 0; border-radius: 7px; padding: 9px 11px; font-size: .68rem; font-weight: 800; }.action-controls .end-turn { color: #142127; background: #d5aa63; }
.investigator-dock { position: relative; min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); overflow: hidden; background: linear-gradient(145deg, #142e35, #091a1f); border-left: 1px solid #3a565e; transition: width .2s; }.investigator-dock.collapsed { grid-template-columns: 1fr; }.dock-toggle { position: absolute; z-index: 2; top: 8px; left: -1px; width: 25px; height: 30px; color: #d5aa63; background: #17343b; border: 1px solid #48636a; border-left: 0; border-radius: 0 7px 7px 0; font-size: 1.2rem; }.party-tabs { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 48px 7px 10px; background: #07191e; border-right: 1px solid #29464e; }.party-tabs button { position: relative; width: 38px; height: 38px; padding: 0; color: #dce4df; background: #1b3941; border: 1px solid #49636a; border-radius: 50%; font-weight: 900; }.party-tabs button.active { color: #18272c; background: #d5aa63; border-color: #f3d797; box-shadow: 0 0 0 3px #d5aa6325; }.party-tabs .presence { position: absolute; right: -1px; bottom: 0; border: 2px solid #07191e; }.investigator-dock.collapsed .party-tabs { border-right: 0; }.investigator-sheet { min-width: 0; overflow-y: auto; padding: 28px 16px 20px; }.investigator-sheet h2 { margin: 5px 0 2px; font-size: 1.35rem; }.investigator-role { min-height: 35px; margin: 0; color: #8da1a3; font-size: .68rem; line-height: 1.4; }.dock-vitals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0; }.dock-vitals div { display: grid; gap: 3px; padding: 10px; background: #07191e; border: 1px solid #29464e; border-radius: 8px; }.dock-vitals small, .investigator-facts dt { color: #82999b; font-size: .58rem; text-transform: uppercase; letter-spacing: .08em; }.dock-vitals strong { font-size: 1rem; }.dock-vitals .health { color: #e9a292; }.dock-vitals .sanity { color: #8fd1de; }.investigator-facts { display: grid; gap: 8px; margin: 0 0 14px; }.investigator-facts div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #29464e; padding-bottom: 7px; }.investigator-facts dd { margin: 0; color: #d8ded8; font-size: .68rem; text-align: right; }.dock-skills { display: grid; grid-template-columns: repeat(5, 1fr); margin: 12px 0; }.dock-skills span { display: grid; place-items: center; gap: 3px; border-right: 1px solid #29464e; }.dock-skills span:last-child { border: 0; }.dock-skills small { color: #82999b; font-size: .52rem; text-transform: uppercase; }.dock-skills b { font-size: .75rem; }.dock-ability { margin: 8px 0 0; color: #9eb0ad; font-size: .63rem; line-height: 1.45; }.dock-ability b { display: block; color: #d5aa63; font-size: .55rem; text-transform: uppercase; letter-spacing: .08em; }
.player-tray { z-index: 6; min-height: 0; overflow: hidden; background: linear-gradient(180deg, #10282f, #07171c); border-top: 1px solid #3d5960; box-shadow: 0 -8px 24px #0007; }.tray-tabs { height: 47px; display: flex; align-items: stretch; overflow-x: auto; padding-left: 8px; }.tray-tabs button { flex: none; display: flex; align-items: center; gap: 7px; color: #9db0af; background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 0 12px; font-size: .7rem; font-weight: 800; }.tray-tabs button > span { color: #d5aa63; }.tray-tabs button small { min-width: 17px; color: #819697; background: #07171c; border-radius: 999px; padding: 2px 5px; font-size: .52rem; }.tray-tabs button.active { color: #f0eddb; background: #17343b; border-bottom-color: #d5aa63; }.tray-tabs .tray-resize { width: 44px; margin-left: auto; justify-content: center; color: #d5aa63; border-left: 1px solid #29464e; font-size: 1rem; }.tray-content { height: calc(100% - 47px); overflow: auto; padding: 18px 24px; border-top: 1px solid #213c43; }.tray-content h3 { margin: 5px 0; font: 600 1.05rem Georgia, serif; }.tray-content p:last-child { max-width: 620px; margin: 0; color: #8fa3a4; font-size: .72rem; line-height: 1.5; }
.investigator-dock { position: relative; z-index: 10; display: block; overflow: visible; min-width: 58px; background: #07191e; border-left: 1px solid #3a565e; }.investigator-dock .party-tabs { position: relative; z-index: 2; height: 100%; border-right: 0; }.investigator-dock .dock-toggle { position: absolute; z-index: 3; top: 8px; left: 50%; width: 38px; height: 32px; transform: translateX(-50%); border: 1px solid #48636a; border-radius: 8px; font-size: .9rem; }.investigator-dock .investigator-sheet { position: absolute; z-index: 1; top: 0; right: 57px; bottom: 0; width: 286px; overflow-y: auto; padding: 28px 18px 20px; background: linear-gradient(145deg, #142e35, #091a1f); border-left: 1px solid #3a565e; box-shadow: -14px 0 34px #000b; animation: investigator-drawer-in .18s ease-out; }.investigator-dock .party-tabs button.active { box-shadow: 0 0 0 3px #d5aa6325, 0 0 16px #d5aa6344; }
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
@media (prefers-reduced-motion: reduce) { .route.legal, .location.available circle { animation: none; }.token { transition: none; } }
</style>
