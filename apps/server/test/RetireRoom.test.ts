import assert from 'node:assert/strict';
import { Room } from '@colyseus/sdk';
import { retireRoom } from '../../web/app/game/retire-room.js';

describe('SDK room retirement', () => {
  it('prevents a scheduled dropped-room reconnect after retirement', async () => {
    const room = new Room('game');
    let reconnects = 0;
    let sent = 0;
    // Keep the real SDK backoff and leave implementation; fake only transport I/O.
    room.connection = { isOpen: true, send: () => { sent++; }, reconnect: () => { reconnects++; } } as unknown as typeof room.connection;
    room.reconnectionToken = 'room:token';
    room.reconnection.minUptime = 0;
    room.reconnection.minDelay = 1;
    room.reconnection.maxDelay = 1;
    const internal = room as unknown as { handleReconnection(code: number): void };
    internal.handleReconnection(1006);
    void retireRoom(room);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(reconnects, 0);
    assert.equal(room.reconnection.enabled, false);
    assert.equal(sent, 1);
  });
  it('closes an in-flight reconnect socket instead of sending on it', async () => {
    const room = new Room('game');
    let closed = 0;
    room.connection = {
      isOpen: false,
      close: () => { closed++; },
      send: () => { throw new Error('socket is connecting'); },
      reconnect: () => { throw new Error('must not reconnect'); },
    } as unknown as typeof room.connection;
    await retireRoom(room);
    assert.equal(closed, 1);
    assert.equal(room.reconnection.enabled, false);
    room.connection.reconnect({ reconnectionToken: 'obsolete' });
  });
});
