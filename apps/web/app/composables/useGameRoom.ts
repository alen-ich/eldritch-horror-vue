import { Client, type Room } from '@colyseus/sdk'
import { createPrivateDecisionInbox } from '../game/private-decision-inbox'
import { retireRoom } from '../game/retire-room'
import { replaceAttachedRoom } from '../game/replace-attached-room'
import { currentRoomCallback } from '../game/current-room-callback'
import { createLatestConnectionRequest } from '../game/latest-connection-request'
import {
  commandErrorMessageType,
  commandMessageType,
  pendingDecisionMessageType,
  type CommandErrorMessage,
  type ActiveTest,
  type TradeOffer,
  type GameCommand,
  type PendingDecision,
  type PendingDecisionKind,
  type PendingDecisionSummary
} from '@eldritch/protocol'

interface ClientPlayerState {
  id: string
  sessionId: string
  displayName: string
  connected: boolean
  delayed: boolean
  defeated: boolean
  eliminated: boolean
  investigatorId: string
  locationId: string
  health: number
  sanity: number
  maxHealth: number
  maxSanity: number
  trainTickets: number
  shipTickets: number
  assetIds: string
  artifactIds: string
  castableSpellIds: string
  spellIds: string
  conditionIds: string
  clues: number
  loreImprovement: number
  influenceImprovement: number
  observationImprovement: number
  strengthImprovement: number
  willImprovement: number
  isHost: boolean
}

interface ClientGameState {
  activeExpeditionLocationId?: string
  expeditionDiscardIds?: string
  otherWorldDiscardIds?: string
  researchDiscardIds?: string
  locationDiscardIdsByDeck?: string
  spellSupplyTopId?: string
  activeGateIds?: string
  monsters?: string
  encounteredMonsterInstanceIds?: string
  investigatorLifecycle?: string
  doom?: number
  omen?: number
  tradeOffer?: string
  stateVersion?: number
  phase?: string
  ancientOneId?: string
  currentMythosCardId?: string
  currentMythosIconIndex?: number
  activeMysteryId?: string
  lastLocationEncounterCardId?: string
  currentLocationEncounterCardId?: string
  mysteryProgress?: number
  mysteryTarget?: number
  completedMysteryIds?: string
  gameResult?: string
  activePlayerId?: string
  turnNumber?: number
  actionsRemaining?: number
  performedActions?: string
  usedConditionActionIds?: string
  usedArtifactActionIds?: string
  reserveAssetIds?: string
  assetDiscardIds?: string
  boardClues?: string
  activeTest?: {
    id: string
    playerId: string
    skill: string
    modifier: number
    dicePool: number
    dice: string
    successes: number
    successThreshold: number
    continuation: string
  }
  pendingDecision?: {
    id: string
    kind: string
    playerId: string
    visibility: string
    prompt: string
    optionCount: number
    minSelections: number
    maxSelections: number
    selectionBudget: number
    continuation: string
  }
  players?: Map<string, ClientPlayerState>
}

const storageKey = 'eldritch-reconnection-token'
const room = shallowRef<Room<unknown, ClientGameState>>()
const players = ref<ClientPlayerState[]>([])
const stateVersion = ref(0)
const phase = ref('lobby')
const activeGateIds = ref<string[]>([])
const spellSupplyTopId = ref('')
const activeExpeditionLocationId = ref('')
const expeditionDiscardIds = ref<string[]>([])
const otherWorldDiscardIds = ref<string[]>([])
const researchDiscardIds = ref<string[]>([])
const locationDiscardIdsByDeck = ref<Record<string, string[]>>({})
const ancientOneId = ref('')
const currentMythosCardId = ref('')
const currentMythosIconIndex = ref(0)
const activeMysteryId = ref('')
const lastLocationEncounterCardId = ref('')
const currentLocationEncounterCardId = ref('')
const mysteryProgress = ref(0)
const mysteryTarget = ref(0)
const completedMysteryIds = ref<string[]>([])
const gameResult = ref('')
const doom = ref(0)
const omen = ref(0)
const activePlayerId = ref('')
const turnNumber = ref(0)
const actionsRemaining = ref(0)
const performedActions = ref<string[]>([])
const usedConditionActionIds = ref<string[]>([])
const usedArtifactActionIds = ref<string[]>([])
const reserveAssetIds = ref<string[]>([])
const assetDiscardIds = ref<string[]>([])
const boardClues = ref<{ id: string; locationId: string }[]>([])
const monsters = ref<{ id: string; monsterId: string; locationId: string; damage: number }[]>([])
const encounteredMonsterInstanceIds = ref<string[]>([])
const activeTest = ref<ActiveTest>()
const tradeOffer = ref<TradeOffer>()
const investigatorLifecycle = ref<{ pendingDefeat?: { playerId: string; cityIds: string[]; causes: ('health' | 'sanity')[] }; replacementWindow?: boolean; defeatedInvestigators?: { investigatorId: string }[]; awakened?: boolean }>({})
const pendingDecision = ref<PendingDecision | PendingDecisionSummary>()
const privateDecisionInbox = createPrivateDecisionInbox()
const playerId = ref('')
const roomId = ref('')
const status = ref<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
const errorMessage = ref('')
const connectionRequests = createLatestConnectionRequest()
let commandSnapshotReady = false
let attachedRoomActive = false

export function useGameRoom() {
  const config = useRuntimeConfig()
  const client = new Client(config.public.colyseusUrl)

  function syncState(state: ClientGameState) {
    activeExpeditionLocationId.value = state.activeExpeditionLocationId ?? ''
    expeditionDiscardIds.value = JSON.parse(state.expeditionDiscardIds ?? '[]') as string[]
    otherWorldDiscardIds.value = JSON.parse(state.otherWorldDiscardIds ?? '[]') as string[]
    researchDiscardIds.value = JSON.parse(state.researchDiscardIds ?? '[]') as string[]
    locationDiscardIdsByDeck.value = JSON.parse(state.locationDiscardIdsByDeck ?? '{}') as Record<string, string[]>
    spellSupplyTopId.value = state.spellSupplyTopId ?? ''
    investigatorLifecycle.value = JSON.parse(state.investigatorLifecycle ?? '{}')
    tradeOffer.value = state.tradeOffer ? JSON.parse(state.tradeOffer) as TradeOffer : undefined
    stateVersion.value = state.stateVersion ?? 0
    phase.value = state.phase ?? 'lobby'
    activeGateIds.value = state.activeGateIds ? state.activeGateIds.split(',') : []
    ancientOneId.value = state.ancientOneId ?? ''
    currentMythosCardId.value = state.currentMythosCardId ?? ''
    currentMythosIconIndex.value = state.currentMythosIconIndex ?? 0
    activeMysteryId.value = state.activeMysteryId ?? ''
    lastLocationEncounterCardId.value = state.lastLocationEncounterCardId ?? ''
    currentLocationEncounterCardId.value = state.currentLocationEncounterCardId ?? ''
    mysteryProgress.value = state.mysteryProgress ?? 0
    mysteryTarget.value = state.mysteryTarget ?? 0
    completedMysteryIds.value = state.completedMysteryIds ? state.completedMysteryIds.split(',') : []
    gameResult.value = state.gameResult ?? ''
    doom.value = state.doom ?? 0
    omen.value = state.omen ?? 0
    activePlayerId.value = state.activePlayerId ?? ''
    turnNumber.value = state.turnNumber ?? 0
    actionsRemaining.value = state.actionsRemaining ?? 0
    performedActions.value = state.performedActions ? state.performedActions.split(',') : []
    usedConditionActionIds.value = state.usedConditionActionIds ? state.usedConditionActionIds.split(',') : []
    usedArtifactActionIds.value = state.usedArtifactActionIds ? state.usedArtifactActionIds.split(',') : []
    reserveAssetIds.value = state.reserveAssetIds ? state.reserveAssetIds.split(',') : []
    assetDiscardIds.value = state.assetDiscardIds ? state.assetDiscardIds.split(',') : []
    boardClues.value = JSON.parse(state.boardClues ?? '[]') as { id: string; locationId: string }[]
    monsters.value = JSON.parse(state.monsters ?? '[]') as typeof monsters.value
    encounteredMonsterInstanceIds.value = state.encounteredMonsterInstanceIds ? state.encounteredMonsterInstanceIds.split(',') : []
    activeTest.value = state.activeTest ? {
      ...state.activeTest,
      skill: state.activeTest.skill as ActiveTest['skill'],
      dice: state.activeTest.dice ? state.activeTest.dice.split(',').map(Number) : [],
      continuation: state.activeTest.continuation as ActiveTest['continuation']
    } : undefined
    if (!state.pendingDecision) {
      pendingDecision.value = privateDecisionInbox.sync()
    } else {
      pendingDecision.value = privateDecisionInbox.sync({
        ...state.pendingDecision,
        kind: state.pendingDecision.kind as PendingDecisionKind,
        visibility: state.pendingDecision.visibility as PendingDecision['visibility'],
        continuation: (state.pendingDecision.continuation || undefined) as PendingDecision['continuation']
      })
    }
    players.value = [...(state.players?.values() ?? [])].map((player) => ({
      id: player.id,
      sessionId: player.sessionId,
      displayName: player.displayName,
      connected: player.connected,
      delayed: player.delayed,
      defeated: player.defeated,
      eliminated: player.eliminated,
      investigatorId: player.investigatorId,
      locationId: player.locationId,
      health: player.health,
      sanity: player.sanity,
      maxHealth: player.maxHealth,
      maxSanity: player.maxSanity,
      trainTickets: player.trainTickets,
      shipTickets: player.shipTickets,
      assetIds: player.assetIds,
      artifactIds: player.artifactIds,
      castableSpellIds: player.castableSpellIds ?? '',
      spellIds: player.spellIds ?? '',
      conditionIds: player.conditionIds,
      clues: player.clues,
      loreImprovement: player.loreImprovement,
      influenceImprovement: player.influenceImprovement,
      observationImprovement: player.observationImprovement,
      strengthImprovement: player.strengthImprovement,
      willImprovement: player.willImprovement,
      isHost: player.isHost
    }))
    playerId.value = players.value.find((player) => player.sessionId === room.value?.sessionId)?.id ?? ''
  }

  function attach(nextRoom: Room<unknown, ClientGameState>) {
    const currentCallback = <Args extends unknown[]>(callback: (...args: Args) => void) =>
      currentRoomCallback(() => attachedRoomActive && room.value === nextRoom, callback)
    attachedRoomActive = true
    privateDecisionInbox.clear()
    commandSnapshotReady = false
    pendingDecision.value = undefined
    replaceAttachedRoom(room.value, nextRoom, value => { room.value = value; syncState({}) }, discardRoom)
    roomId.value = nextRoom.roomId
    status.value = 'connected'
    localStorage.setItem(storageKey, nextRoom.reconnectionToken)
    nextRoom.onStateChange(currentCallback((state: ClientGameState) => {
      syncState(state)
      commandSnapshotReady = status.value === 'connected'
    }))
    nextRoom.onMessage<CommandErrorMessage>(commandErrorMessageType, currentCallback((message: CommandErrorMessage) => { errorMessage.value = message.message }))
    nextRoom.onMessage<PendingDecision>(pendingDecisionMessageType, currentCallback((decision: PendingDecision) => {
      privateDecisionInbox.receive(decision)
      // Show options only with their matching public snapshot/version. Otherwise
      // a fast click can submit the next choice with the previous state version.
      if (nextRoom.state) syncState(nextRoom.state)
    }))
    nextRoom.onMessage<string>('seat-token', currentCallback((token: string) => {
      localStorage.setItem(`eldritch-seat-${nextRoom.roomId}`, token)
    }))
    nextRoom.send('request-seat-token')
    nextRoom.onDrop(currentCallback(() => { commandSnapshotReady = false; status.value = 'connecting' }))
    nextRoom.onReconnect(currentCallback(() => {
      commandSnapshotReady = false
      status.value = 'connected'
      // SDK 0.18.2 assigns the rotated token after invoking this signal.
      queueMicrotask(currentCallback(() => {
        localStorage.setItem(storageKey, nextRoom.reconnectionToken)
      }))
    }))
    nextRoom.onLeave(currentCallback(() => { commandSnapshotReady = false; status.value = 'disconnected' }))
    if (nextRoom.state) {
      syncState(nextRoom.state)
      commandSnapshotReady = true
    }
  }

  async function createGame(displayName: string) {
    attachedRoomActive = false
    status.value = 'connecting'
    errorMessage.value = ''
    await connectionRequests.run(() => client.create<ClientGameState>('game', { displayName }), attach, handleConnectionError, discardRoom)
  }

  async function joinGame(targetRoomId: string, displayName: string) {
    attachedRoomActive = false
    status.value = 'connecting'
    errorMessage.value = ''
    await connectionRequests.run(() => {
      const resumeToken = localStorage.getItem(`eldritch-seat-${targetRoomId}`) ?? undefined
      return client.joinById<ClientGameState>(targetRoomId, { displayName, resumeToken })
    }, attach, handleConnectionError, discardRoom)
  }

  function discardRoom(obsoleteRoom: Room<unknown, ClientGameState>) {
    return retireRoom(obsoleteRoom)
  }

  function handleConnectionError(error: unknown) {
    status.value = 'idle'
    errorMessage.value = error instanceof Error
      ? `Could not reach the game server: ${error.message}`
      : 'Could not reach the game server.'
  }

  async function reconnect() {
    const token = localStorage.getItem(storageKey)
    if (!token) return false
    attachedRoomActive = false
    status.value = 'connecting'
    return connectionRequests.run(() => client.reconnect<ClientGameState>(token), attach, () => {
      localStorage.removeItem(storageKey)
      status.value = 'idle'
    }, discardRoom)
  }

  function send(command: GameCommand) {
    // A connected transport may still be waiting for its own-seat snapshot.
    if (!room.value || !attachedRoomActive || status.value !== 'connected' || !commandSnapshotReady || !playerId.value) return
    errorMessage.value = ''
    room.value?.send(commandMessageType, {
      expectedStateVersion: stateVersion.value,
      command
    })
  }

  return {
    activeExpeditionLocationId: readonly(activeExpeditionLocationId),
    expeditionDiscardIds: readonly(expeditionDiscardIds),
    otherWorldDiscardIds: readonly(otherWorldDiscardIds),
    researchDiscardIds: readonly(researchDiscardIds),
    locationDiscardIdsByDeck: readonly(locationDiscardIdsByDeck),
    spellSupplyTopId: readonly(spellSupplyTopId),
    activeGateIds: readonly(activeGateIds),
    investigatorLifecycle: readonly(investigatorLifecycle),
    usedArtifactActionIds: readonly(usedArtifactActionIds),
    doom: readonly(doom), omen: readonly(omen),
    tradeOffer: readonly(tradeOffer),
    players: readonly(players), stateVersion: readonly(stateVersion), phase: readonly(phase), ancientOneId: readonly(ancientOneId), currentMythosCardId: readonly(currentMythosCardId), currentMythosIconIndex: readonly(currentMythosIconIndex), activeMysteryId: readonly(activeMysteryId), lastLocationEncounterCardId: readonly(lastLocationEncounterCardId), currentLocationEncounterCardId: readonly(currentLocationEncounterCardId), mysteryProgress: readonly(mysteryProgress), mysteryTarget: readonly(mysteryTarget), completedMysteryIds: readonly(completedMysteryIds), gameResult: readonly(gameResult), activePlayerId: readonly(activePlayerId),
    turnNumber: readonly(turnNumber), actionsRemaining: readonly(actionsRemaining), performedActions: readonly(performedActions), usedConditionActionIds: readonly(usedConditionActionIds), reserveAssetIds: readonly(reserveAssetIds), assetDiscardIds: readonly(assetDiscardIds), boardClues: readonly(boardClues), monsters: readonly(monsters), encounteredMonsterInstanceIds: readonly(encounteredMonsterInstanceIds), activeTest: readonly(activeTest), pendingDecision: readonly(pendingDecision), playerId: readonly(playerId), roomId: readonly(roomId),
    status: readonly(status), errorMessage: readonly(errorMessage), createGame, joinGame, reconnect, send
  }
}
