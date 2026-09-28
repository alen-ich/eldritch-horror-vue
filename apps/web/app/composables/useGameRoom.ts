import { Client, type Room } from '@colyseus/sdk'
import {
  commandErrorMessageType,
  commandMessageType,
  pendingDecisionMessageType,
  type CommandErrorMessage,
  type ActiveTest,
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
  investigatorId: string
  locationId: string
  health: number
  sanity: number
  maxHealth: number
  maxSanity: number
  trainTickets: number
  shipTickets: number
  assetIds: string
  clues: number
  loreImprovement: number
  influenceImprovement: number
  observationImprovement: number
  strengthImprovement: number
  willImprovement: number
  isHost: boolean
}

interface ClientGameState {
  stateVersion?: number
  phase?: string
  ancientOneId?: string
  activeMysteryId?: string
  mysteryProgress?: number
  mysteryTarget?: number
  completedMysteryIds?: string
  gameResult?: string
  activePlayerId?: string
  turnNumber?: number
  actionsRemaining?: number
  performedActions?: string
  reserveAssetIds?: string
  assetDiscardIds?: string
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
const ancientOneId = ref('')
const activeMysteryId = ref('')
const mysteryProgress = ref(0)
const mysteryTarget = ref(0)
const completedMysteryIds = ref<string[]>([])
const gameResult = ref('')
const activePlayerId = ref('')
const turnNumber = ref(0)
const actionsRemaining = ref(0)
const performedActions = ref<string[]>([])
const reserveAssetIds = ref<string[]>([])
const assetDiscardIds = ref<string[]>([])
const activeTest = ref<ActiveTest>()
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
    stateVersion.value = state.stateVersion ?? 0
    phase.value = state.phase ?? 'lobby'
    ancientOneId.value = state.ancientOneId ?? ''
    activeMysteryId.value = state.activeMysteryId ?? ''
    mysteryProgress.value = state.mysteryProgress ?? 0
    mysteryTarget.value = state.mysteryTarget ?? 0
    completedMysteryIds.value = state.completedMysteryIds ? state.completedMysteryIds.split(',') : []
    gameResult.value = state.gameResult ?? ''
    activePlayerId.value = state.activePlayerId ?? ''
    turnNumber.value = state.turnNumber ?? 0
    actionsRemaining.value = state.actionsRemaining ?? 0
    performedActions.value = state.performedActions ? state.performedActions.split(',') : []
    reserveAssetIds.value = state.reserveAssetIds ? state.reserveAssetIds.split(',') : []
    assetDiscardIds.value = state.assetDiscardIds ? state.assetDiscardIds.split(',') : []
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
      investigatorId: player.investigatorId,
      locationId: player.locationId,
      health: player.health,
      sanity: player.sanity,
      maxHealth: player.maxHealth,
      maxSanity: player.maxSanity,
      trainTickets: player.trainTickets,
      shipTickets: player.shipTickets,
      assetIds: player.assetIds,
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
      attach(await client.joinById<ClientGameState>(targetRoomId, { displayName }))
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
    players: readonly(players), stateVersion: readonly(stateVersion), phase: readonly(phase), ancientOneId: readonly(ancientOneId), activeMysteryId: readonly(activeMysteryId), mysteryProgress: readonly(mysteryProgress), mysteryTarget: readonly(mysteryTarget), completedMysteryIds: readonly(completedMysteryIds), gameResult: readonly(gameResult), activePlayerId: readonly(activePlayerId),
    turnNumber: readonly(turnNumber), actionsRemaining: readonly(actionsRemaining), performedActions: readonly(performedActions), reserveAssetIds: readonly(reserveAssetIds), assetDiscardIds: readonly(assetDiscardIds), activeTest: readonly(activeTest), pendingDecision: readonly(pendingDecision), playerId: readonly(playerId), roomId: readonly(roomId),
    status: readonly(status), errorMessage: readonly(errorMessage), createGame, joinGame, reconnect, send
  }
}
