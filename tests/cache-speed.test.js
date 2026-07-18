'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const cacheKey = 'grpt_cache_v4';
let getCalls = 0;
let setCalls = 0;
const stored = {
  [cacheKey]: {
    version: 5,
    entries: {
      'por:999': {
        status: 'found',
        editions: [{
          bookId: '101',
          title: 'Portuguese edition',
          url: 'https://www.goodreads.com/book/show/101'
        }],
        partial: false,
        updatedAt: Date.now()
      }
    },
    bookToWork: {
      123: { workId: '999', updatedAt: Date.now() }
    }
  }
};

global.chrome = {
  storage: {
    local: {
      async get() {
        getCalls += 1;
        return stored;
      },
      async set(value) {
        setCalls += 1;
        Object.assign(stored, value);
      },
      async remove() {}
    },
    sync: {
      async get() { return {}; },
      async set() {}
    }
  }
};

require('../shared.js');

test('warms storage once and resolves subsequent books from memory', async () => {
  await GRPT.Cache.warm();
  const first = await GRPT.Cache.resolveBook('123', 'por');
  const second = await GRPT.Cache.resolveBook('123', 'por');

  assert.equal(getCalls, 1);
  assert.equal(first.workId, '999');
  assert.equal(first.cachedResult.status, 'found');
  assert.deepEqual(second, first);
});

test('stores a lookup and all related edition mappings in one write', async () => {
  await GRPT.Cache.setLookup('124', '1000', {
    editions: [{
      bookId: '456',
      title: 'Another Portuguese edition',
      url: 'https://www.goodreads.com/book/show/456'
    }]
  }, 'por');

  const relatedEdition = await GRPT.Cache.resolveBook('456', 'por');
  assert.equal(setCalls, 1);
  assert.equal(getCalls, 1);
  assert.equal(relatedEdition.workId, '1000');
  assert.equal(relatedEdition.cachedResult.editions[0].bookId, '456');
});
