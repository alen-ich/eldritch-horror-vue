import assert from 'node:assert/strict';
import { createLatestConnectionRequest } from '../../web/app/game/latest-connection-request.js';

function unexpected(): never { assert.fail('Unexpected callback'); }

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('latest connection request', () => {
  for (const oldFirst of [true, false]) {
    it(`only attaches latest room, old completes ${oldFirst ? 'first' : 'last'}`, async () => {
      const requests = createLatestConnectionRequest();
      const old = deferred<string>(), latest = deferred<string>();
      const attached: string[] = [], discarded: string[] = [];
      const accept = (room: string) => { attached.push(room); };
      const discard = (room: string) => { discarded.push(room); };
      const a = requests.run(() => old.promise, accept, unexpected, discard);
      const b = requests.run(() => latest.promise, accept, unexpected, discard);
      if (oldFirst) { old.resolve('old'); assert.equal(await a, false); latest.resolve('latest'); }
      else { latest.resolve('latest'); assert.equal(await b, true); old.resolve('old'); }
      assert.equal(await a, false); assert.equal(await b, true);
      assert.deepEqual(attached, ['latest']); assert.deepEqual(discarded, ['old']);
    });
  }

  it('ignores stale failure without clearing current credentials or reporting error', async () => {
    const requests = createLatestConnectionRequest(), old = deferred<string>();
    let token = 'saved', error = '';
    const a = requests.run(() => old.promise, unexpected, () => { token = ''; error = 'failed'; }, unexpected);
    await requests.run(async () => 'new-token', value => { token = value; }, unexpected, unexpected);
    old.reject(new Error('old reconnect failed'));
    assert.equal(await a, false); assert.equal(token, 'new-token'); assert.equal(error, '');
  });

  for (const throws of [true, false]) {
    it(`disposes stale success after latest failure, containing cleanup ${throws ? 'throw' : 'rejection'}`, async () => {
      const requests = createLatestConnectionRequest(), old = deferred<string>();
      let error = '', discarded = 0;
      const a = requests.run(() => old.promise, unexpected, unexpected, () => {
        discarded++;
        if (throws) throw new Error('cleanup');
        return Promise.reject(new Error('cleanup'));
      });
      assert.equal(await requests.run(async () => { throw new Error('latest'); }, unexpected,
        reason => { error = (reason as Error).message; }, unexpected), false);
      old.resolve('old'); assert.equal(await a, false);
      assert.equal(error, 'latest'); assert.equal(discarded, 1);
    });
  }

  it('handles synchronous connection failure as current failure', async () => {
    let error = '';
    assert.equal(await createLatestConnectionRequest().run<string>(() => { throw new Error('sync'); }, unexpected,
      reason => { error = (reason as Error).message; }, unexpected), false);
    assert.equal(error, 'sync');
  });
});

