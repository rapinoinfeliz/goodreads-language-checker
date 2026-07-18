'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

global.chrome = {
  storage: {
    local: {
      async get() { return {}; },
      async set() { throw new Error('quota exceeded'); },
      async remove() {}
    },
    sync: {
      async get() { return {}; },
      async set() {}
    }
  }
};

require('../shared.js');

test('a cache quota failure never breaks a successful lookup', async () => {
  const originalWarn = console.warn;
  let warning = '';
  console.warn = (...parts) => { warning = parts.join(' '); };
  try {
    await assert.doesNotReject(() => GRPT.Cache.setWork('999', {
      editions: [{ title: 'Portuguese edition', url: 'https://www.goodreads.com/book/show/101' }]
    }, 'por'));
  } finally {
    console.warn = originalWarn;
  }
  assert.match(warning, /Could not persist lookup cache/);
});
