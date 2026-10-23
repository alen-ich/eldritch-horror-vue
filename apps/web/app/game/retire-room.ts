import type { Room } from '@colyseus/sdk'

/** Permanently retire a Room; never use this for a temporary disconnect. */
export function retireRoom(room: Room): Promise<unknown> {
  room.reconnection.enabled = false
  // SDK 0.18.2 does not cancel an already scheduled retry when disabled.
  // Its timer calls this public method; retire the entry point as well.
  room.connection.reconnect = () => {}
  if (!room.connection.isOpen) {
    room.connection.close()
    return Promise.resolve()
  }
  return room.leave(true)
}
