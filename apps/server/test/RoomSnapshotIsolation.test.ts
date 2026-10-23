import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import type { GameCommand } from '@eldritch/protocol';

const webRequire = createRequire(new URL('../../web/package.json', import.meta.url));
const sourceUrl = new URL('../../web/app/composables/useGameRoom.ts', import.meta.url);
const sourceRequire = createRequire(sourceUrl);
const { transpileModule, ModuleKind, ScriptTarget } = webRequire('typescript');
const vue = webRequire('vue');

function room(id: string, state: object) {
  const callbacks = new Map<string, (value: unknown) => void>();
  const sent: { type: string; payload: unknown }[] = [];
  return { roomId: id, sessionId: id, reconnectionToken: id, state,
    callbacks, reconnection: { enabled: true },
    onStateChange: (callback: (value: unknown) => void) => callbacks.set('state', callback),
    onMessage: (type: string, callback: (value: unknown) => void) => callbacks.set(type, callback),
    onDrop: (callback: () => void) => callbacks.set('drop', callback),
    onReconnect: (callback: () => void) => callbacks.set('reconnect', callback),
    onLeave: (callback: () => void) => callbacks.set('leave', callback),
    sent, send(type: string, payload?: unknown) { sent.push({ type, payload }); }, leave: async () => {},
  };
}

interface Game {
  createGame(name: string): Promise<void>;
  joinGame(id: string, name: string): Promise<void>;
  reconnect(): Promise<boolean>;
  send(command: GameCommand): void;
  status: { value: string };
  activeExpeditionLocationId: { value: string };
  expeditionDiscardIds: { value: string[] };
  otherWorldDiscardIds: { value: string[] };
  researchDiscardIds: { value: string[] };
  locationDiscardIdsByDeck: { value: Record<string, string[]> };
  playerId: { value: string }; roomId: { value: string }; errorMessage: { value: string };
  activeTest: { value?: { id: string } }; stateVersion: { value: number };
  [key: string]: unknown;
}

function harness() {
  let next: ReturnType<typeof room> | Error | Promise<ReturnType<typeof room>>;
  const reconnectTokens: string[] = [];
  class Client {
    async create() { if (next instanceof Error) throw next; return next; }
    async joinById() { return this.create(); }
    async reconnect(token: string) { reconnectTokens.push(token); return this.create(); }
  }
  const storage = new Map<string, string>();
  const module = { exports: {} as { useGameRoom: () => Game } };
  const code = transpileModule(readFileSync(sourceUrl, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ESNext } }).outputText;
  runInNewContext(code, {
    module, exports: module.exports,
    require: (id: string) => id === '@colyseus/sdk' ? { Client } : sourceRequire(id),
    ...vue, queueMicrotask, useRuntimeConfig: () => ({ public: { colyseusUrl: 'unused' } }),
    localStorage: {
      setItem(key: string, value: string) { storage.set(key, value); },
      getItem(key: string): string | null { return storage.get(key) ?? null; },
      removeItem(key: string) { storage.delete(key); },
    },
  });
  const game = module.exports.useGameRoom();
  return { game, storage, reconnectTokens, connect: async (value: typeof next, method: 'create' | 'join' | 'reconnect' = 'create') => {
    next = value;
    if (method === 'join') await game.joinGame('target', 'Player');
    else if (method === 'reconnect') await game.reconnect();
    else await game.createGame('Player');
  } };
}

function populated(id: string) {
  return { players: new Map([[id, { id, sessionId: id, assetIds: '', artifactIds: '', spellIds: '', conditionIds: '' }]]),
    stateVersion: 42, phase: 'action', activePlayerId: id, activeGateIds: 'gate', doom: 7, omen: 2,
    ancientOneId: 'azathoth', currentMythosCardId: 'mythos', currentMythosIconIndex: 3,
    activeMysteryId: 'mystery', lastLocationEncounterCardId: 'last', currentLocationEncounterCardId: 'current',
    mysteryProgress: 2, mysteryTarget: 4, completedMysteryIds: 'completed', gameResult: 'won',
    turnNumber: 9, actionsRemaining: 2, performedActions: 'rest', usedConditionActionIds: 'condition',
    usedArtifactActionIds: 'artifact', reserveAssetIds: 'reserve', assetDiscardIds: 'discard',
    encounteredMonsterInstanceIds: 'monster',
    tradeOffer: JSON.stringify({ id: 'private-trade' }), investigatorLifecycle: JSON.stringify({ awakened: true }),
    activeTest: { id: 'old-test', dice: '5', skill: 'lore', continuation: 'test_reroll' },
    boardClues: '[{"id":"old-clue","locationId":"rome"}]', monsters: '[{"id":"monster","monsterId":"cultist","locationId":"rome","damage":1}]', spellSupplyTopId: 'old-spell',
  };
}

function snapshot(game: Game) {
  return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(game)
    .filter(([key, value]) => typeof value !== 'function' && !['status', 'errorMessage', 'roomId'].includes(key))
    .map(([key, value]) => [key, (value as { value: unknown }).value]))));
}

describe('room snapshot isolation (real composable)', () => {
  it('exposes Location discards and resets on replacement', async () => {
    const { game, connect } = harness();
    await connect(room('old', { ...populated('old'), locationDiscardIdsByDeck: '{"general":["encounter_general_02"]}' }));
    assert.deepEqual(Array.from(game.locationDiscardIdsByDeck.value.general!), ['encounter_general_02']);
    await connect(room('new', {}));
    assert.equal(Object.keys(game.locationDiscardIdsByDeck.value).length, 0);
  });
  it('exposes public Research discards and clears them on attachment replacement', async () => {
    const { game, connect } = harness();
    await connect(room('old', { ...populated('old'), researchDiscardIds: '["encounter_research_azathoth_02"]' }));
    assert.deepEqual(Array.from(game.researchDiscardIds.value), ['encounter_research_azathoth_02']);
    await connect(room('new', {}));
    assert.deepEqual(Array.from(game.researchDiscardIds.value), []);
  });
  it('exposes public Other World discards and clears them on attachment replacement', async () => {
    const { game, connect } = harness();
    await connect(room('old', { ...populated('old'), otherWorldDiscardIds: '["encounter_other_world_02"]' }));
    assert.deepEqual(Array.from(game.otherWorldDiscardIds?.value ?? []), ['encounter_other_world_02']);
    await connect(room('new', {}));
    assert.deepEqual(Array.from(game.otherWorldDiscardIds.value), []);
  });
  it('exposes the public Expedition site and clears it on attachment replacement', async () => {
    const { game, connect } = harness();
    await connect(room('old', { ...populated('old'), activeExpeditionLocationId: 'the_pyramids' }));
    assert.equal(game.activeExpeditionLocationId?.value, 'the_pyramids');
    await connect(room('new', {}));
    assert.equal(game.activeExpeditionLocationId.value, '');
  });

  it('exposes public Expedition discards and clears them on attachment replacement', async () => {
    const { game, connect } = harness();
    await connect(room('old', { ...populated('old'), expeditionDiscardIds: '["encounter_expedition_the_amazon_01"]' }));
    assert.deepEqual(Array.from(game.expeditionDiscardIds?.value ?? []), ['encounter_expedition_the_amazon_01']);
    await connect(room('new', {}));
    assert.deepEqual(Array.from(game.expeditionDiscardIds.value), []);
  });
  it('persists each rotated token after the SDK reconnect callback and uses it for explicit reconnect', async () => {
    const { storage, reconnectTokens, connect } = harness();
    const current = room('current', populated('current'));
    await connect(current);
    for (const token of ['current:rotation-1', 'current:rotation-2']) {
      current.callbacks.get('drop')!(undefined);
      current.callbacks.get('reconnect')!(undefined);
      // SDK 0.18.2 assigns the new token after invoking onReconnect.
      current.reconnectionToken = token;
      await Promise.resolve();
      assert.equal(storage.get('eldritch-reconnection-token'), token);
    }
    await connect(room('restored', populated('restored')), 'reconnect');
    assert.deepEqual(reconnectTokens, ['current:rotation-2']);
  });

  for (const succeeds of [true, false]) {
    it(`ignores deferred old token writes when a newer request ${succeeds ? 'succeeds' : 'fails'}`, async () => {
      const { storage, connect } = harness();
      const old = room('same', populated('same'));
      old.reconnectionToken = 'same:initial';
      await connect(old);
      old.callbacks.get('drop')!(undefined);
      old.callbacks.get('reconnect')!(undefined);
      old.reconnectionToken = 'same:obsolete-rotation';
      let resolve!: (value: ReturnType<typeof room>) => void;
      let reject!: (reason: Error) => void;
      const pending = connect(new Promise<ReturnType<typeof room>>((yes, no) => { resolve = yes; reject = no; }));
      await Promise.resolve();
      assert.equal(storage.get('eldritch-reconnection-token'), 'same:initial');
      const current = room('same', populated('same'));
      current.reconnectionToken = 'same:replacement';
      if (succeeds) resolve(current);
      else reject(new Error('replacement failed'));
      await pending;
      await Promise.resolve();
      assert.equal(storage.get('eldritch-reconnection-token'), succeeds ? 'same:replacement' : 'same:initial');
    });
  }

  for (const method of ['create', 'join', 'reconnect'] as const) {
    it(`revokes retained callbacks during and after a failed ${method} request`, async () => {
      const { game, storage, connect } = harness();
      const old = room('old', populated('old'));
      await connect(old);
      const before = snapshot(game);
      let reject!: (reason: Error) => void;
      const pending = connect(new Promise<ReturnType<typeof room>>((_resolve, fail) => { reject = fail; }), method);
      const obsoleteEvents = () => {
        old.callbacks.get('drop')!(undefined);
        old.callbacks.get('reconnect')!(undefined);
        old.callbacks.get('state')!({ ...populated('old'), stateVersion: 99 });
        old.callbacks.get('command-error')!({ message: 'obsolete error' });
        old.callbacks.get('seat-token')!('obsolete secret');
        old.callbacks.get('pending-decision')!({ id: 'obsolete-private', optionIds: ['secret'] });
      };
      obsoleteEvents();
      game.send({ type: 'REST' });
      assert.equal(game.status.value, 'connecting');
      assert.equal(game.errorMessage.value, '');
      assert.deepEqual(snapshot(game), before);
      assert.equal(storage.has('eldritch-seat-old'), false);
      assert.equal(storage.get('eldritch-reconnection-token'), 'old');
      assert.equal(old.sent.filter(message => message.type === 'command').length, 0);
      reject(new Error('latest request failed'));
      await pending;
      const failure = game.errorMessage.value;
      obsoleteEvents();
      game.send({ type: 'REST' });
      assert.equal(game.status.value, 'idle');
      assert.equal(game.errorMessage.value, failure);
      assert.deepEqual(snapshot(game), before);
      assert.equal(storage.has('eldritch-seat-old'), false);
      assert.equal(old.sent.filter(message => message.type === 'command').length, 0);
      const current = room('new', populated('new'));
      await connect(current);
      obsoleteEvents();
      assert.equal(game.status.value, 'connected');
      assert.equal(game.playerId.value, 'new');
      current.callbacks.get('state')!({ ...populated('new'), stateVersion: 43 });
      game.send({ type: 'REST' });
      assert.equal(current.sent.filter(message => message.type === 'command').length, 1);
      assert.equal(game.stateVersion.value, 43);
    });
  }

  it('keeps an attached room usable when explicit reconnect has no token', async () => {
    const { game, storage, connect } = harness();
    const current = room('current', populated('current'));
    await connect(current);
    storage.delete('eldritch-reconnection-token');
    assert.equal(await game.reconnect(), false);
    current.callbacks.get('state')!({ ...populated('current'), stateVersion: 43 });
    game.send({ type: 'REST' });
    assert.equal(game.status.value, 'connected');
    assert.equal(current.sent.filter(message => message.type === 'command').length, 1);
  });

  for (const version of [42, 0]) {
    it(`waits for fresh own-seat state after reconnect even at version ${version}`, async () => {
      const { game, connect } = harness();
      const current = room('current', { ...populated('current'), stateVersion: version });
      await connect(current);
      const commands = () => current.sent.filter(message => message.type === 'command');
      for (let cycle = 0; cycle < 2; cycle++) {
        current.callbacks.get('drop')!(undefined);
        current.callbacks.get('reconnect')!(undefined);
        current.callbacks.get('command-error')!({ message: 'awaiting synchronized state' });
        game.send({ type: 'REST' });
        assert.equal(commands().length, cycle);
        assert.equal(game.errorMessage.value, 'awaiting synchronized state');
        current.callbacks.get('pending-decision')!({ id: 'retained', optionIds: ['private'] });
        game.send({ type: 'REST' });
        assert.equal(commands().length, cycle);
        assert.equal(game.errorMessage.value, 'awaiting synchronized state');
        current.callbacks.get('state')!(populated('other'));
        game.send({ type: 'REST' });
        assert.equal(commands().length, cycle);
        current.callbacks.get('state')!({ ...populated('current'), stateVersion: version });
        assert.equal(commands().length, cycle);
        game.send({ type: 'REST' });
        assert.equal(commands().length, cycle + 1);
        assert.deepEqual(JSON.parse(JSON.stringify(commands()[cycle])), {
          type: 'command', payload: { expectedStateVersion: version, command: { type: 'REST' } },
        });
      }
    });
  }

  it('requires its own seat snapshot, permits version zero, and never replays blocked intents', async () => {
    const { game, connect } = harness();
    const current = room('current', {});
    await connect(current);
    const commands = () => current.sent.filter(message => message.type === 'command');
    current.callbacks.get('command-error')!({ message: 'waiting for state' });
    game.send({ type: 'REST' });
    assert.equal(commands().length, 0);
    assert.equal(game.errorMessage.value, 'waiting for state');
    current.callbacks.get('state')!(populated('other'));
    game.send({ type: 'REST' });
    assert.equal(commands().length, 0);
    assert.equal(game.errorMessage.value, 'waiting for state');
    current.callbacks.get('state')!({ ...populated('current'), stateVersion: 0, phase: 'lobby' });
    assert.equal(commands().length, 0);
    game.send({ type: 'SELECT_INVESTIGATOR', investigatorId: 'norman_withers' });
    assert.deepEqual(JSON.parse(JSON.stringify(commands())), [{ type: 'command', payload: {
      expectedStateVersion: 0, command: { type: 'SELECT_INVESTIGATOR', investigatorId: 'norman_withers' },
    } }]);
    assert.equal(game.errorMessage.value, '');
    current.callbacks.get('state')!(populated('other'));
    game.send({ type: 'REST' });
    assert.equal(commands().length, 1);
  });

  it('requires a replacement room own-seat snapshot despite obsolete state callbacks', async () => {
    const { game, connect } = harness();
    const old = room('old', populated('old'));
    await connect(old);
    const current = room('current', {});
    await connect(current);
    old.callbacks.get('state')!(populated('old'));
    game.send({ type: 'REST' });
    assert.equal(current.sent.filter(message => message.type === 'command').length, 0);
    current.callbacks.get('state')!(populated('current'));
    game.send({ type: 'REST' });
    assert.equal(current.sent.filter(message => message.type === 'command').length, 1);
  });

  it('blocks new commands during drop and leave, preserves errors, and resumes versioned sends without replay', async () => {
    const { game, connect } = harness();
    await connect(new Error('initial failure'));
    const initialError = game.errorMessage.value;
    game.send({ type: 'REST' });
    assert.equal(game.errorMessage.value, initialError);
    const current = room('current', populated('current'));
    await connect(current);
    const commands = () => current.sent.filter(message => message.type === 'command');
    current.callbacks.get('drop')!(undefined);
    current.callbacks.get('command-error')!({ message: 'connection error' });
    game.send({ type: 'REST' });
    assert.equal(commands().length, 0);
    assert.equal(game.errorMessage.value, 'connection error');
    current.callbacks.get('reconnect')!(undefined);
    current.callbacks.get('state')!({ ...populated('current'), stateVersion: 43 });
    game.send({ type: 'REST' });
    assert.deepEqual(JSON.parse(JSON.stringify(commands())), [{ type: 'command', payload: { expectedStateVersion: 43, command: { type: 'REST' } } }]);
    assert.equal(game.errorMessage.value, '');
    current.callbacks.get('leave')!(undefined);
    game.send({ type: 'REST' });
    assert.equal(commands().length, 1);
  });

  it('blocks pending and failed replacement sends and ignores obsolete reconnect callbacks', async () => {
    const { game, connect } = harness();
    const old = room('old', populated('old'));
    await connect(old);
    let resolve!: (value: ReturnType<typeof room>) => void;
    const pending = connect(new Promise<ReturnType<typeof room>>(done => { resolve = done; }));
    game.send({ type: 'REST' });
    assert.equal(old.sent.filter(message => message.type === 'command').length, 0);
    const current = room('current', populated('current'));
    resolve(current);
    await pending;
    current.callbacks.get('drop')!(undefined);
    old.callbacks.get('reconnect')!(undefined);
    game.send({ type: 'REST' });
    assert.equal(current.sent.filter(message => message.type === 'command').length, 0);
    await connect(new Error('unavailable'));
    const error = game.errorMessage.value;
    game.send({ type: 'REST' });
    assert.equal(current.sent.filter(message => message.type === 'command').length, 0);
    assert.equal(game.errorMessage.value, error);
  });

  it('clears every room-derived ref before first new snapshot and ignores old callbacks', async () => {
    const { game, connect } = harness();
    const defaults = snapshot(game);
    const summary = { id: 'reused', kind: 'select_rerolls', playerId: 'old', visibility: 'owner', prompt: 'Choose', minSelections: 0, maxSelections: 1, optionCount: 1 };
    const old = room('old', { ...populated('old'), pendingDecision: summary });
    await connect(old);
    assert.equal(game.errorMessage.value, '');
    assert.equal(game.playerId.value, 'old');
    assert.equal(game.activeTest.value?.id, 'old-test');
    old.callbacks.get('pending-decision')!({ ...summary, optionIds: ['private-old-option'] });
    assert.deepEqual((game.pendingDecision as { value: { optionIds: string[] } }).value.optionIds, ['private-old-option']);
    const next = room('new', {});
    await connect(next);
    assert.equal(game.roomId.value, 'new');
    assert.deepEqual(snapshot(game), defaults);
    old.callbacks.get('state')!(populated('old'));
    assert.deepEqual(snapshot(game), defaults);
    next.callbacks.get('state')!(populated('new'));
    assert.equal(game.playerId.value, 'new');
    assert.equal(game.stateVersion.value, 42);
    next.callbacks.get('state')!({ ...populated('new'), pendingDecision: summary });
    const decision = (game.pendingDecision as { value: { optionIds?: string[]; id: string } }).value;
    assert.equal(decision.id, 'reused');
    assert.equal(decision.optionIds, undefined);
  });

  it('preserves attached snapshot on failed replacement', async () => {
    const { game, connect } = harness();
    await connect(room('old', populated('old')));
    const before = snapshot(game);
    await connect(new Error('unavailable'));
    assert.deepEqual(snapshot(game), before);
    assert.equal(game.roomId.value, 'old');
  });
});



