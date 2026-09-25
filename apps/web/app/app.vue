<script setup lang="ts">
import { baseGameLocations, baseGameMap, baseGameRoutes } from '@eldritch/content'
import type { InvestigatorId, LocationId } from '@eldritch/protocol'

const displayName = ref('')
const joinCode = ref('')
const attemptedReconnect = ref(false)
const game = useGameRoom()

const locationById = Object.fromEntries(baseGameLocations.map((location) => [location.id, location])) as Record<LocationId, typeof baseGameLocations[number]>
const me = computed(() => game.players.value.find((player) => player.id === game.playerId.value))
const isMyTurn = computed(() => game.activePlayerId.value === game.playerId.value)
const legalDestinations = computed(() => new Set(
  me.value?.locationId
    ? baseGameMap.adjacentLocationIds[me.value.locationId as LocationId] ?? []
    : []
))

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

function move(destinationId: LocationId) {
  if (isMyTurn.value && legalDestinations.value.has(destinationId)) game.send({ type: 'MOVE', destinationId })
}

async function copyInvite() {
  await window.navigator.clipboard.writeText(window.location.href)
}
</script>

<template>
  <main class="shell">
    <header class="masthead">
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
      <section class="room-bar">
        <div><span>Room</span><strong>{{ game.roomId.value }}</strong></div>
        <button class="copy" @click="copyInvite">Copy invite link</button>
      </section>

      <p v-if="game.errorMessage.value" class="error" role="alert">{{ game.errorMessage.value }}</p>

      <section v-if="game.phase.value === 'lobby'" class="lobby-grid">
        <div class="panel">
          <p class="chapter">Investigator roster</p>
          <h2>Choose your investigator</h2>
          <div class="investigators">
            <button :class="{ selected: me?.investigatorId === 'amanda_sharpe' }" @click="selectInvestigator('amanda_sharpe')">
              <strong>Amanda Sharpe</strong><span>The Student</span>
            </button>
            <button :class="{ selected: me?.investigatorId === 'trish_scarborough' }" @click="selectInvestigator('trish_scarborough')">
              <strong>Trish Scarborough</strong><span>The Spy</span>
            </button>
          </div>
          <button v-if="me?.isHost" class="primary start" :disabled="game.players.value.length < 2 || game.players.value.some(p => !p.investigatorId)" @click="game.send({ type: 'START_GAME' })">Start game</button>
          <p v-else class="muted">Waiting for the host to begin.</p>
        </div>
        <aside class="panel roster">
          <p class="chapter">Players · {{ game.players.value.length }}/4</p>
          <article v-for="player in game.players.value" :key="player.id">
            <span class="presence" :class="{ online: player.connected }"></span>
            <div><strong>{{ player.displayName }} <small v-if="player.isHost">HOST</small></strong><p>{{ player.investigatorId ? player.investigatorId.replace('_', ' ') : 'Choosing…' }}</p></div>
          </article>
        </aside>
      </section>

      <section v-else class="game-grid">
        <div class="panel board-wrap">
          <div class="turn"><span>Turn {{ game.turnNumber.value }}</span><strong>{{ isMyTurn ? 'Your action' : `${game.players.value.find(p => p.id === game.activePlayerId.value)?.displayName}'s action` }}</strong></div>
          <div class="route-legend" aria-label="Route legend"><span class="train">Train</span><span class="ship">Ship</span><span class="uncharted">Uncharted</span></div>
          <svg class="board" viewBox="0 0 680 460" role="img" aria-label="Base-game world map routes">
            <defs><radialGradient id="sea"><stop stop-color="#234c58"/><stop offset="1" stop-color="#0c242b"/></radialGradient></defs>
            <rect width="680" height="460" rx="20" fill="url(#sea)"/>
            <line v-for="route in baseGameRoutes" :key="`${route.source}-${route.target}`" :x1="locationById[route.source].x" :y1="locationById[route.source].y" :x2="locationById[route.target].x" :y2="locationById[route.target].y" class="route" :class="route.type"/>
            <g v-for="locationItem in baseGameLocations" :key="locationItem.id" class="location" :class="[locationItem.type, { available: legalDestinations.has(locationItem.id) && isMyTurn }]" role="button" :tabindex="legalDestinations.has(locationItem.id) && isMyTurn ? 0 : -1" @click="move(locationItem.id)" @keyup.enter="move(locationItem.id)">
              <circle :cx="locationItem.x" :cy="locationItem.y" :r="locationItem.name.length > 3 ? 14 : 10"/>
              <text :x="locationItem.x" :y="locationItem.y + (locationItem.name.length > 3 ? 25 : 4)" :class="{ numbered: locationItem.name.length <= 3 }">{{ locationItem.name }}</text>
            </g>
            <g v-for="(player, index) in game.players.value" :key="player.id" class="token" :transform="`translate(${locationById[player.locationId as LocationId]?.x + index * 12 - 6 || 0}, ${locationById[player.locationId as LocationId]?.y - 20 || 0})`">
              <circle r="9"/><text y="3">{{ player.displayName.slice(0, 1).toUpperCase() }}</text>
            </g>
          </svg>
          <button class="secondary" :disabled="!isMyTurn" @click="game.send({ type: 'END_TURN' })">End turn</button>
        </div>
        <aside class="panel roster"><p class="chapter">Investigators</p><article v-for="player in game.players.value" :key="player.id"><span class="presence" :class="{ online: player.connected }"></span><div><strong>{{ player.displayName }}</strong><p>{{ player.investigatorId.replace('_', ' ') }} · {{ player.locationId }}</p></div></article></aside>
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
.investigators { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.investigators button { text-align: left; color: #e9eadc; background: #0c2228; border: 1px solid #3b5961; border-radius: 12px; padding: 20px; }
.investigators button.selected { border-color: #d5aa63; box-shadow: inset 0 0 0 1px #d5aa63; }.investigators span { display: block; color: #91a7a8; margin-top: 6px; }
.start { margin-top: 24px; width: 100%; }.roster { padding: 24px; }.roster article { display: flex; align-items: center; gap: 12px; padding: 15px 0; border-bottom: 1px solid #2b474e; }.roster p { margin: 4px 0 0; color: #91a7a8; text-transform: capitalize; }.roster small { color: #d5aa63; font-size: .58rem; letter-spacing: .1em; }
.presence { width: 9px; height: 9px; border-radius: 50%; background: #6a7374; }.presence.online { background: #7fcb8a; box-shadow: 0 0 10px #7fcb8a; }
.board-wrap { padding: 20px; }.turn { display: flex; justify-content: space-between; padding: 6px 8px 18px; }.turn span { color: #91a7a8; }.turn strong { color: #d5aa63; }
.route-legend { display: flex; justify-content: flex-end; gap: 15px; margin: -8px 6px 10px; color: #aebcba; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; }.route-legend span::before { content: ''; display: inline-block; width: 20px; height: 3px; margin-right: 6px; vertical-align: middle; background: currentColor; }.route-legend .train { color: #d9a84e; }.route-legend .ship { color: #7dc2db; }.route-legend .uncharted { color: #9aa8a0; }
.board { width: 100%; border: 1px solid #45616a; border-radius: 20px; }.route { stroke-width: 2.5; opacity: .72; }.route.train { stroke: #d9a84e; }.route.ship { stroke: #72bbd7; }.route.uncharted { stroke: #84958d; stroke-dasharray: 4 5; }.location { outline: none; cursor: default; }.location circle { fill: #132f36; stroke: #d5aa63; stroke-width: 2; }.location.sea circle { stroke: #72bbd7; }.location.wilderness circle { stroke: #9ab486; }.location.available { cursor: pointer; }.location.available circle, .location.available:focus circle { fill: #d5aa63; stroke: #fff0bd; filter: drop-shadow(0 0 5px #d5aa63); }.location text { fill: #f0eddb; text-anchor: middle; font-size: 9px; font-weight: 700; pointer-events: none; paint-order: stroke; stroke: #07171c; stroke-width: 3px; stroke-linejoin: round; }.location text.numbered { font-size: 8px; stroke-width: 2px; }.token circle { fill: #ebd17d; stroke: #07171c; stroke-width: 2; }.token text { fill: #07171c; text-anchor: middle; font-size: 8px; font-weight: 900; stroke: none; }
.board-wrap > button { width: 100%; margin-top: 12px; }
@media (max-width: 800px) { .lobby-grid, .game-grid { grid-template-columns: 1fr; }.investigators { grid-template-columns: 1fr; }.masthead { align-items: flex-end; }.room-bar { align-items: flex-start; gap: 12px; flex-direction: column; }.copy { width: 100%; } }
</style>
