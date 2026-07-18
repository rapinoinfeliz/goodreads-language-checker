'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const localValues = {};
const syncValues = {};

function storageArea(values) {
  return {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(update) {
      Object.assign(values, update);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    }
  };
}

global.chrome = {
  storage: {
    local: storageArea(localValues),
    sync: storageArea(syncValues)
  }
};

require('../shared.js');

test('saves and retrieves the extension language setting', async () => {
  assert.equal((await GRPT.Settings.getLanguage()).code, 'por');
  await GRPT.Settings.setLanguage('spa');
  assert.equal((await GRPT.Settings.getLanguage()).code, 'spa');
  assert.equal(syncValues[GRPT.Settings.KEY].languageCode, 'spa');
});

test('isolates cached results by language', async () => {
  await GRPT.Cache.setWork('999', {
    editions: [{ title: 'Portuguese edition', url: 'https://www.goodreads.com/book/show/101' }]
  }, 'por');
  await GRPT.Cache.setWork('999', {
    editions: [{ title: 'Spanish edition', url: 'https://www.goodreads.com/book/show/303' }]
  }, 'spa');

  const portuguese = await GRPT.Cache.getWork('999', 'por');
  const spanish = await GRPT.Cache.getWork('999', 'spa');
  assert.equal(portuguese.editions[0].bookId, '101');
  assert.equal(spanish.editions[0].bookId, '303');
});
