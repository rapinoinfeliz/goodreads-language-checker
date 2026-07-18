'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../shared.js');

const fixtureDir = path.join(__dirname, 'fixtures');
const fixture = (name) => fs.readFileSync(path.join(fixtureDir, name), 'utf8');

test('extracts work_id from current and legacy routes', () => {
  assert.equal(GRPT.extractWorkIdFromHtml('<a href="/work/quotes/245494">quotes</a>'), '245494');
  assert.equal(GRPT.extractWorkIdFromHtml('<a href="/work/editions/999-title">editions</a>'), '999');
  assert.equal(GRPT.extractWorkIdFromHtml('{"work_id": 12345}'), '12345');
});

test('validates checksum and extracts ISBN-13', () => {
  assert.equal(GRPT.isValidISBN13('9788563560292'), true);
  assert.equal(GRPT.isValidISBN13('9788563560293'), false);
  assert.equal(GRPT.extractISBN13FromText('ISBN: 978-8563560292'), '9788563560292');
});

test('returns no editions when Portuguese is unavailable', () => {
  const parsed = GRPT.parseEditionsPage(fixture('no-portuguese.html'));
  assert.equal(parsed.hasLanguage, false);
  assert.deepEqual(parsed.editions, []);
});

test('rejects login or challenge pages instead of creating a false negative', () => {
  assert.throws(
    () => GRPT.parseEditionsPage('<html><body>Sign in to continue</body></html>'),
    /unexpected format/
  );
});

test('fallback keeps only explicitly Portuguese blocks', () => {
  const parsed = GRPT.parseEditionsPage(fixture('mixed-languages.html'));
  assert.equal(parsed.editions.length, 1);
  assert.equal(parsed.editions[0].bookId, '405');
  assert.equal(parsed.editions[0].isbn13, '9789726115991');
});

test('uses the selected language in the URL and parser', () => {
  const url = new URL(GRPT.buildEditionsUrl('999', 'spa'));
  assert.equal(url.searchParams.get('filter_by_language'), 'spa');

  const parsed = GRPT.parseEditionsPage(fixture('spanish-page.html'), { languageCode: 'spa' });
  assert.equal(parsed.hasLanguage, true);
  assert.equal(parsed.editions.length, 1);
  assert.equal(parsed.editions[0].bookId, '303');
});

test('accepts Goodreads display-name aliases', () => {
  const html = `
    <select name="filter_by_language"><option value="gre" selected>Greek, Modern (1453-)</option></select>
    <div class="elementList"><div class="editionData">
      <div class="dataRow"><a class="bookTitle" href="/book/show/707-greek">Greek edition</a></div>
      <div class="dataRow"><div class="dataTitle">Edition language:</div><div class="dataValue">Greek</div></div>
    </div></div>`;
  const parsed = GRPT.parseEditionsPage(html, { languageCode: 'gre' });
  assert.equal(parsed.editions.length, 1);
  assert.equal(parsed.editions[0].bookId, '707');
});

test('keeps Portuguese as the default language', () => {
  assert.equal(GRPT.Settings.normalizeLanguage('invalid-code').code, 'por');
  assert.equal(new URL(GRPT.buildEditionsUrl('999')).searchParams.get('filter_by_language'), 'por');
});

test('follows pagination and aggregates editions without duplicates', async () => {
  const first = fixture('portuguese-page-1.html');
  const second = fixture('portuguese-page-2.html');
  const requested = [];
  const fetcher = async (url) => {
    requested.push(url);
    return {
      ok: true,
      status: 200,
      text: async () => url.includes('page=2') ? second : first
    };
  };

  const result = await GRPT.fetchAllEditions('999', { fetcher, maxPages: 5 });
  assert.equal(requested.length, 2);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.partial, false);
  assert.deepEqual(result.editions.map((edition) => edition.bookId), ['101', '202']);
});

test('the default limit checks only the first page', async () => {
  const first = fixture('portuguese-page-1.html');
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { ok: true, status: 200, text: async () => first };
  };

  const result = await GRPT.fetchAllEditions('999', { fetcher });
  assert.equal(calls, 1);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.editions.length, 1);
  assert.equal(result.partial, true);
});

test('estimates a conservative minimum from visible pagination without extra requests', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => `
    <div class="elementList"><div class="editionData">
      <a class="bookTitle" href="/book/show/${700 + index}">Edition ${index + 1}</a>
      <div>Edition language: Portuguese</div>
    </div></div>`).join('');
  const html = `<select name="filter_by_language"><option value="por">Portuguese</option></select>
    ${rows}
    <a href="/reviews?page=999">Unrelated pagination</a>
    <a href="/work/editions/999?page=2">2</a>
    <a href="/work/editions/999?page=3">3</a>
    <a href="/work/editions/999?page=4">4</a>
    <a href="/work/editions/999?page=5" rel="next">next »</a>`;
  let calls = 0;
  const result = await GRPT.fetchAllEditions('999', {
    fetcher: async () => {
      calls += 1;
      return { ok: true, status: 200, text: async () => html };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.editions.length, 10);
  assert.equal(result.totalPages, 5);
  assert.equal(result.minimumEditionCount, 40);
  assert.equal(result.partial, true);
  assert.equal(result.editionCountIsExact, false);
});

test('uses the exact Goodreads edition total when the results summary provides it', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => `
    <div class="elementList"><div class="editionData">
      <a class="bookTitle" href="/book/show/${900 + index}">Edition ${index + 1}</a>
      <div>Edition language: Portuguese</div>
    </div></div>`).join('');
  const html = `<select name="filter_by_language"><option value="por">Portuguese</option></select>
    <div class="showingPages"><span>Showing 1-10 of 209</span></div>
    ${rows}
    <a href="/work/editions/2207778?page=21" rel="next">next »</a>`;
  let calls = 0;
  const result = await GRPT.fetchAllEditions('2207778', {
    fetcher: async () => {
      calls += 1;
      return { ok: true, status: 200, text: async () => html };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.totalPages, 21);
  assert.equal(result.minimumEditionCount, 209);
  assert.equal(result.editionCountIsExact, true);
});

test('marks results as partial when a later page fails', async () => {
  const first = fixture('portuguese-page-1.html');
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 2) throw new Error('network');
    return { ok: true, status: 200, text: async () => first };
  };

  const result = await GRPT.fetchAllEditions('999', { fetcher });
  assert.equal(result.editions.length, 1);
  assert.equal(result.partial, true);
});

test('fetch forwards the selected language', async () => {
  const requested = [];
  const fetcher = async (url) => {
    requested.push(url);
    return { ok: true, status: 200, text: async () => fixture('spanish-page.html') };
  };
  const result = await GRPT.fetchAllEditions('999', { fetcher, languageCode: 'spa' });
  assert.equal(requested.length, 1);
  assert.match(requested[0], /filter_by_language=spa/);
  assert.equal(result.editions[0].bookId, '303');
});
