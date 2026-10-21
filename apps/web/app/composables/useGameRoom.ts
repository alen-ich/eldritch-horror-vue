import { Client, type Room } from '@colyseus/sdk'
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
const playerId = ref('')
const roomId = ref('')
const status = ref<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
const errorMessage = ref('')

export function useGameRoom() {
  const config = useRuntimeConfig()
  const client = new Client(config.public.colyseusUrl)

  function syncState(state: ClientGameState) {
    if (!state.players) return
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
      pendingDecision.value = undefined
    } else if (pendingDecision.value?.id !== state.pendingDecision.id || !('optionIds' in pendingDecision.value)) {
      pendingDecision.value = {
        ...state.pendingDecision,
        kind: state.pendingDecision.kind as PendingDecisionKind,
        visibility: state.pendingDecision.visibility as PendingDecision['visibility'],
        continuation: (state.pendingDecision.continuation || undefined) as PendingDecision['continuation']
      }
    }
    players.value = [...state.players.values()].map((player) => ({
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
    room.value = nextRoom
    roomId.value = nextRoom.roomId
    status.value = 'connected'
    localStorage.setItem(storageKey, nextRoom.reconnectionToken)
    nextRoom.onStateChange(syncState)
    nextRoom.onMessage<CommandErrorMessage>(commandErrorMessageType, (message) => { errorMessage.value = message.message })
    nextRoom.onMessage<PendingDecision>(pendingDecisionMessageType, (decision) => { pendingDecision.value = decision })
    nextRoom.onMessage<string>('seat-token', (token) => {
      localStorage.setItem(`eldritch-seat-${nextRoom.roomId}`, token)
    })
    nextRoom.send('request-seat-token')
    nextRoom.onDrop(() => { status.value = 'connecting' })
    nextRoom.onReconnect(() => { status.value = 'connected' })
    nextRoom.onLeave(() => { status.value = 'disconnected' })
    if (nextRoom.state) syncState(nextRoom.state)
  }

  async function createGame(displayName: string) {
    status.value = 'connecting'
    errorMessage.value = ''
    try {
      attach(await client.create<ClientGameState>('game', { displayName }))
    } catch (error) {
      handleConnectionError(error)
    }
  }

  async function joinGame(targetRoomId: string, displayName: string) {
    status.value = 'connecting'
    errorMessage.value = ''
    try {
      const resumeToken = localStorage.getItem(`eldritch-seat-${targetRoomId}`) ?? undefined
      attach(await client.joinById<ClientGameState>(targetRoomId, { displayName, resumeToken }))
    } catch (error) {
      handleConnectionError(error)
    }
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
    status.value = 'connecting'
    try {
      attach(await client.reconnect<ClientGameState>(token))
      return true
    } catch {
      localStorage.removeItem(storageKey)
      status.value = 'idle'
      return false
    }
  }

  function send(command: GameCommand) {
    errorMessage.value = ''
    room.value?.send(commandMessageType, {
      expectedStateVersion: stateVersion.value,
      command
    })
  }

  return {
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
