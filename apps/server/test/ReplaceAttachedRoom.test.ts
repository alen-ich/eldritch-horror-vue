import assert from 'node:assert/strict';
import { replaceAttachedRoom } from '../../web/app/game/replace-attached-room.js';

describe('attached room replacement', () => {
  it('publishes new identity before releasing each previous connection', () => {
    const a = {}, b = {}, c = {};
    let current = a;
    const discarded: object[] = [];
    const identities: object[] = [];
    const replace = (next: object) => replaceAttachedRoom(current, next, value => { current = value; }, old => {
      identities.push(current);

      discarded.push(old);
    });
    replace(b); replace(c);
    assert.deepEqual(discarded, [a, b]);
    assert.equal(identities[0], b); assert.equal(identities[1], c);
    assert.equal(current, c);
  });
  it('does not release an initial or identical connection', () => {
    const next = {};
    let current: object | undefined;
    const publish = (value: object) => { current = value; };
    let disposed = 0; const discard = () => { disposed++; };
    replaceAttachedRoom(current, next, publish, discard);
    replaceAttachedRoom(current, next, publish, discard);
    assert.equal(current, next); assert.equal(disposed, 0);
  });
  for (const mode of ['throw', 'reject', 'pending']) {
    it(`contains ${mode} cleanup without delaying new identity`, async () => {
      const old = {}, next = {};
      let current = old; let disposed = 0;
      replaceAttachedRoom(old, next, value => { current = value; }, () => { disposed++;
        if (mode === 'throw') throw new Error('cleanup');
        if (mode === 'reject') return Promise.reject(new Error('cleanup'));
        return new Promise(() => {});
      });
      assert.equal(current, next); assert.equal(disposed, 1);
      await new Promise(resolve => setImmediate(resolve));
    });
  }
});


