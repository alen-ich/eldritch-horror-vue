import { Client, type Room } from '@colyseus/sdk'
import {
  commandErrorMessageType,
  commandMessageType,
  type CommandErrorMessage,
  type GameCommand
} from '@eldritch/protocol'

interface ClientPlayerState {
  id: string
  sessionId: string
  displayName: string
  connected: boolean
  investigatorId: string
  locationId: string
  health: number
  sanity: number
  maxHealth: number
  maxSanity: number
  trainTickets: number
  shipTickets: number
  isHost: boolean
}

interface ClientGameState {
  stateVersion?: number
  phase?: string
  activePlayerId?: string
  turnNumber?: number
  actionsRemaining?: number
  performedActions?: string
  players?: Map<string, ClientPlayerState>
}

const storageKey = 'eldritch-reconnection-token'
const room = shallowRef<Room<unknown, ClientGameState>>()
const players = ref<ClientPlayerState[]>([])
const stateVersion = ref(0)
const phase = ref('lobby')
const activePlayerId = ref('')
const turnNumber = ref(0)
const actionsRemaining = ref(0)
const performedActions = ref<string[]>([])
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
    activePlayerId.value = state.activePlayerId ?? ''
    turnNumber.value = state.turnNumber ?? 0
    actionsRemaining.value = state.actionsRemaining ?? 0
    performedActions.value = state.performedActions ? state.performedActions.split(',') : []
    players.value = [...state.players.values()].map((player) => ({
      id: player.id,
      sessionId: player.sessionId,
      displayName: player.displayName,
      connected: player.connected,
      investigatorId: player.investigatorId,
      locationId: player.locationId,
      health: player.health,
      sanity: player.sanity,
      maxHealth: player.maxHealth,
      maxSanity: player.maxSanity,
      trainTickets: player.trainTickets,
      shipTickets: player.shipTickets,
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
    players: readonly(players), stateVersion: readonly(stateVersion), phase: readonly(phase), activePlayerId: readonly(activePlayerId),
    turnNumber: readonly(turnNumber), actionsRemaining: readonly(actionsRemaining), performedActions: readonly(performedActions), playerId: readonly(playerId), roomId: readonly(roomId),
    status: readonly(status), errorMessage: readonly(errorMessage), createGame, joinGame, reconnect, send
  }
}
