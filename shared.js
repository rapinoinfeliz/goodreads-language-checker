/**
 * Goodreads Edition Language Checker — shared.js
 *
 * Shared functions for the content script and popup. This file intentionally
 * avoids modules to remain compatible with Manifest V3 content_scripts.
 */
(function (root) {
  'use strict';

  const GOODREADS_ORIGIN = 'https://www.goodreads.com';
  const CACHE_KEY = 'grpt_cache_v4';
  const CACHE_VERSION = 4;
  const SETTINGS_KEY = 'grpt_settings_v1';
  const DEFAULT_LANGUAGE_CODE = 'por';
  const FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const NOT_FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const PARTIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_CACHE_ENTRIES = 150;
  const MAX_BOOK_MAPPINGS = 300;
  const MAX_CACHE_BYTES = 4 * 1024 * 1024;
  const DEFAULT_MAX_PAGES = 1;

  let memoryCache = null;
  let cacheLoadPromise = null;
  let cacheGeneration = 0;

  const LANGUAGES = Object.freeze([
    ['afr', 'Afrikaans', '🇿🇦'],
    ['sqi', 'Albanian', '🇦🇱'],
    ['ger', 'German', '🇩🇪'],
    ['ara', 'Arabic', '🇸🇦'],
    ['hye', 'Armenian', '🇦🇲'],
    ['aze', 'Azerbaijani', '🇦🇿'],
    ['eus', 'Basque', '🇪🇸'],
    ['ben', 'Bengali', '🇧🇩'],
    ['bel', 'Belarusian', '🇧🇾'],
    ['nob', 'Bokmål, Norwegian; Norwegian Bokmål', '🇳🇴'],
    ['bul', 'Bulgarian', '🇧🇬'],
    ['cat', 'Catalan; Valencian', '🇪🇸'],
    ['zho', 'Chinese', '🇨🇳'],
    ['kor', 'Korean', '🇰🇷'],
    ['scr', 'Croatian', '🇭🇷'],
    ['kur', 'Kurdish', '🇮🇶'],
    ['dan', 'Danish', '🇩🇰'],
    ['slo', 'Slovak', '🇸🇰'],
    ['slv', 'Slovenian', '🇸🇮'],
    ['spa', 'Spanish', '🇪🇸'],
    ['est', 'Estonian', '🇪🇪'],
    ['fin', 'Finnish', '🇫🇮'],
    ['fre', 'French', '🇫🇷'],
    ['glg', 'Galician', '🇪🇸'],
    ['kat', 'Georgian', '🇬🇪'],
    ['gre', 'Greek, Modern (1453-)', '🇬🇷'],
    ['heb', 'Hebrew', '🇮🇱'],
    ['hin', 'Hindi', '🇮🇳'],
    ['nl', 'Dutch', '🇳🇱'],
    ['hun', 'Hungarian', '🇭🇺'],
    ['ind', 'Indonesian', '🇮🇩'],
    ['eng', 'English', '🇬🇧'],
    ['isl', 'Icelandic', '🇮🇸'],
    ['ita', 'Italian', '🇮🇹'],
    ['jpn', 'Japanese', '🇯🇵'],
    ['lav', 'Latvian', '🇱🇻'],
    ['lit', 'Lithuanian', '🇱🇹'],
    ['mkd', 'Macedonian', '🇲🇰'],
    ['msa', 'Malay', '🇲🇾'],
    ['mon', 'Mongolian', '🇲🇳'],
    ['mul', 'Multiple languages', '🌐'],
    ['nor', 'Norwegian', '🇳🇴'],
    ['nno', 'Norwegian Nynorsk; Nynorsk, Norwegian', '🇳🇴'],
    ['per', 'Persian', '🇮🇷'],
    ['pol', 'Polish', '🇵🇱'],
    ['por', 'Portuguese', '🇧🇷'],
    ['rum', 'Romanian', '🇷🇴'],
    ['rus', 'Russian', '🇷🇺'],
    ['srp', 'Serbian', '🇷🇸'],
    ['sin', 'Sinhala; Sinhalese', '🇱🇰'],
    ['swe', 'Swedish', '🇸🇪'],
    ['tha', 'Thai', '🇹🇭'],
    ['tam', 'Tamil', '🇮🇳'],
    ['cze', 'Czech', '🇨🇿'],
    ['tur', 'Turkish', '🇹🇷'],
    ['ukr', 'Ukrainian', '🇺🇦'],
    ['urd', 'Urdu', '🇵🇰'],
    ['vie', 'Vietnamese', '🇻🇳']
  ].map(([code, goodreadsName, flag]) => {
    const label = {
      nob: 'Norwegian Bokmål',
      cat: 'Catalan',
      gre: 'Greek',
      nno: 'Norwegian Nynorsk',
      sin: 'Sinhala'
    }[code] || goodreadsName;
    const matchNames = {
      nob: ['Norwegian Bokmål', 'Bokmål'],
      cat: ['Catalan', 'Valencian'],
      gre: ['Greek'],
      nno: ['Norwegian Nynorsk', 'Nynorsk'],
      sin: ['Sinhala', 'Sinhalese']
    }[code] || [];
    return Object.freeze({
      code,
      goodreadsName,
      label,
      matchNames: Object.freeze([goodreadsName, ...matchNames]),
      flag
    });
  }));

  function normalizeLanguage(value) {
    const code = typeof value === 'object' ? value?.code : value;
    return LANGUAGES.find((language) => language.code === String(code || '').toLowerCase())
      || LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE_CODE);
  }

  function getSettingsStorage() {
    return root.chrome?.storage?.sync || root.chrome?.storage?.local || null;
  }

  async function getLanguage() {
    const storage = getSettingsStorage();
    if (!storage) return normalizeLanguage(DEFAULT_LANGUAGE_CODE);
    try {
      const result = await storage.get(SETTINGS_KEY);
      return normalizeLanguage(result?.[SETTINGS_KEY]?.languageCode);
    } catch {
      return normalizeLanguage(DEFAULT_LANGUAGE_CODE);
    }
  }

  async function setLanguage(languageCode) {
    const language = normalizeLanguage(languageCode);
    const storage = getSettingsStorage();
    if (storage) await storage.set({ [SETTINGS_KEY]: { languageCode: language.code } });
    return language;
  }

  function toAbsoluteGoodreadsUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, GOODREADS_ORIGIN);
      if (url.origin !== GOODREADS_ORIGIN) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function toSafeCoverUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, GOODREADS_ORIGIN);
      const allowedHost = url.hostname === 'www.goodreads.com'
        || url.hostname.endsWith('.gr-assets.com')
        || url.hostname === 'gr-assets.com';
      if (url.protocol !== 'https:' || !allowedHost) return null;
      url.pathname = url.pathname.replace(/_S[XY]\d+_/g, '_SX100_');
      return url.href;
    } catch {
      return null;
    }
  }

  function extractBookId(value) {
    const match = String(value || '').match(/\/book\/show\/(\d+)/);
    return match ? match[1] : null;
  }

  function extractWorkIdFromHtml(html) {
    const source = String(html || '');
    const routeMatch = source.match(/\/work\/(?:editions|quotes)\/(\d+)/i);
    if (routeMatch) return routeMatch[1];

    const directMatch = source.match(/\/work\/(\d+)/i);
    if (directMatch) return directMatch[1];

    const namedMatch = source.match(/(?:work[_-]?id|legacyWorkId)["'\s:=\\]+(\d+)/i);
    return namedMatch ? namedMatch[1] : null;
  }

  function extractWorkId(doc, html) {
    if (doc?.querySelectorAll) {
      const selectors = [
        'a[href*="/work/editions/"]',
        'a[href*="/work/quotes/"]',
        'a[href*="/work/"]'
      ];
      for (const selector of selectors) {
        for (const link of doc.querySelectorAll(selector)) {
          const workId = extractWorkIdFromHtml(link.getAttribute('href') || link.href);
          if (workId) return workId;
        }
      }
    }

    const source = html ?? doc?.documentElement?.innerHTML ?? '';
    return extractWorkIdFromHtml(source);
  }

  function extractISBN13FromText(text) {
    const compact = String(text || '').replace(/[\u2010-\u2015-]/g, '');
    const labeled = compact.match(/ISBN\s*13?\s*:?\s*(97[89]\d{10})/i);
    if (labeled && isValidISBN13(labeled[1])) return labeled[1];

    const candidates = compact.match(/\b97[89]\d{10}\b/g) || [];
    return candidates.find(isValidISBN13) || null;
  }

  function isValidISBN13(isbn) {
    if (!/^\d{13}$/.test(String(isbn || ''))) return false;
    const digits = String(isbn).split('').map(Number);
    const sum = digits.slice(0, 12).reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3),
      0
    );
    return (10 - (sum % 10)) % 10 === digits[12];
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function hasTargetLanguage(doc, html, language) {
    const select = doc?.querySelector?.('select[name="filter_by_language"]');
    if (select) {
      return [...select.querySelectorAll('option')].some((option) => {
        const value = (option.getAttribute('value') || '').toLowerCase();
        const text = option.textContent.trim().toLowerCase();
        return value === language.code || text === language.goodreadsName.toLowerCase();
      });
    }

    const selectMatch = String(html || '').match(/<select[^>]*name=["']filter_by_language["'][^>]*>[\s\S]*?<\/select>/i)
      || String(html || '').match(/filter_by_language[\s\S]*?<\/select>/i);
    if (!selectMatch) return false;
    const codePattern = new RegExp(`value=["']${escapeRegExp(language.code)}["']`, 'i');
    const namePattern = new RegExp(`>\\s*${escapeRegExp(language.goodreadsName)}\\s*<`, 'i');
    return codePattern.test(selectMatch[0]) || namePattern.test(selectMatch[0]);
  }

  function isTargetLanguageEdition(element, language) {
    const expectedNames = language.matchNames.map((name) => name.toLowerCase());
    for (const title of element.querySelectorAll('.dataTitle')) {
      if (!title.textContent.trim().toLowerCase().includes('edition language')) continue;
      const value = title.nextElementSibling || title.parentElement?.querySelector('.dataValue');
      return expectedNames.includes(value?.textContent.trim().toLowerCase());
    }

    const alternatives = language.matchNames.map(escapeRegExp).join('|');
    const pattern = new RegExp(`Edition language:\\s*(?:${alternatives})(?:\\s|$)`, 'i');
    return pattern.test(element.textContent || '');
  }

  function extractISBN13(element) {
    const specific = element.querySelector('.isbn13, [itemprop="isbn"], .isbn');
    const fromSpecific = extractISBN13FromText(specific?.textContent || '');
    if (fromSpecific) return fromSpecific;

    const dataValue = element.getAttribute('data-isbn13') || element.getAttribute('data-isbn');
    if (isValidISBN13(dataValue)) return dataValue;
    return extractISBN13FromText(element.textContent || '');
  }

  function extractEditionData(elementList, editionData) {
    const titleLink = editionData.querySelector('.editionTitle, .bookTitle, a[href*="/book/show/"]')
      || editionData.querySelector('a');
    const title = titleLink?.textContent.trim() || '';
    const url = toAbsoluteGoodreadsUrl(titleLink?.getAttribute('href'));
    const bookId = extractBookId(url);
    const isbn13 = extractISBN13(editionData);
    const image = elementList.querySelector('img[src], img[data-src]');
    const cover = toSafeCoverUrl(image?.getAttribute('src') || image?.getAttribute('data-src'));
    const directRows = [...editionData.children].filter((child) => child.classList?.contains('dataRow'));
    let meta = directRows[1]?.textContent.trim().replace(/\s+/g, ' ') || '';
    if (meta.length > 120) meta = `${meta.slice(0, 120)}…`;

    if (!title && !isbn13) return null;
    return sanitizeEdition({
      bookId,
      title: title || 'Untitled edition',
      isbn13,
      cover,
      meta,
      url
    });
  }

  function sanitizeEdition(value) {
    if (!value || typeof value !== 'object') return null;
    const title = String(value.title || '').trim().slice(0, 500);
    const isbn13 = isValidISBN13(value.isbn13) ? String(value.isbn13) : null;
    if (!title && !isbn13) return null;
    return {
      bookId: extractBookId(value.url) || (/^\d+$/.test(String(value.bookId || '')) ? String(value.bookId) : null),
      title: title || 'Untitled edition',
      isbn13,
      cover: toSafeCoverUrl(value.cover),
      meta: String(value.meta || '').trim().slice(0, 300),
      url: toAbsoluteGoodreadsUrl(value.url)
    };
  }

  function decodeHtmlText(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseEditionsWithRegex(html, options = {}) {
    const language = normalizeLanguage(options.languageCode || options.language);
    const alternatives = language.matchNames.map(escapeRegExp).join('|');
    const editionLanguagePattern = new RegExp(
      `Edition language:[\\s\\S]*?(?:${alternatives})(?:\\s|<|$)`,
      'i'
    );
    const editions = [];
    const blocks = String(html || '').match(/<div[^>]*class=["'][^"']*\belementList\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]*class=["'][^"']*\belementList\b|$)/gi) || [];

    for (const block of blocks) {
      if (!editionLanguagePattern.test(block)) continue;
      const linkMatch = block.match(/<a[^>]*class=["'][^"']*\bbookTitle\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
        || block.match(/<a[^>]*href=["']([^"']*\/book\/show\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const url = toAbsoluteGoodreadsUrl(linkMatch[1]);
      const edition = sanitizeEdition({
        bookId: extractBookId(url),
        title: decodeHtmlText(linkMatch[2]),
        isbn13: extractISBN13FromText(decodeHtmlText(block)),
        cover: block.match(/<img[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1] || null,
        meta: '',
        url
      });
      if (edition) editions.push(edition);
    }
    return deduplicateEditions(editions);
  }

  function deduplicateEditions(editions) {
    const seen = new Set();
    const result = [];
    for (const raw of editions) {
      const edition = sanitizeEdition(raw);
      if (!edition) continue;
      const key = edition.bookId || edition.isbn13 || `${edition.title}|${edition.meta}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(edition);
    }
    return result;
  }

  function getNextPageUrl(doc) {
    const relNext = doc.querySelector('a[rel="next"]');
    if (relNext) return validateEditionsPageUrl(relNext.getAttribute('href'));

    for (const link of doc.querySelectorAll('a[href*="/work/editions/"][href*="page="]')) {
      const label = link.textContent.trim().toLowerCase();
      if (label === 'next »' || label === 'next' || label === '»') {
        return validateEditionsPageUrl(link.getAttribute('href'));
      }
    }
    return null;
  }

  function validateEditionsPageUrl(value) {
    const absolute = toAbsoluteGoodreadsUrl(value);
    if (!absolute) return null;
    const url = new URL(absolute);
    return /^\/work\/editions\/\d+/.test(url.pathname) ? url.href : null;
  }

  function getNextPageUrlWithRegex(html) {
    const links = String(html || '').matchAll(/<a[^>]*href=["']([^"']*\/work\/editions\/[^"']*page=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const link of links) {
      const label = decodeHtmlText(link[2]).toLowerCase();
      if (label === 'next »' || label === 'next' || label === '»') {
        return validateEditionsPageUrl(link[1].replace(/&amp;/gi, '&'));
      }
    }
    return null;
  }

  function parseEditionsPage(html, options = {}) {
    const language = normalizeLanguage(options.languageCode || options.language);
    if (typeof DOMParser === 'undefined') {
      if (!/<select[^>]*name=["']filter_by_language["']/i.test(String(html || ''))) {
        throw new Error('Goodreads returned an editions page in an unexpected format.');
      }
      const hasLanguage = hasTargetLanguage(null, html, language);
      return {
        editions: hasLanguage ? parseEditionsWithRegex(html, { language }) : [],
        hasLanguage,
        nextPageUrl: hasLanguage ? getNextPageUrlWithRegex(html) : null
      };
    }

    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    if (!doc.querySelector('select[name="filter_by_language"]')) {
      throw new Error('Goodreads returned an editions page in an unexpected format.');
    }
    const hasLanguage = hasTargetLanguage(doc, html, language);
    if (!hasLanguage) return { editions: [], hasLanguage: false, nextPageUrl: null };

    const editions = [];
    for (const elementList of doc.querySelectorAll('.elementList')) {
      const editionData = elementList.querySelector('.editionData');
      if (!editionData || !isTargetLanguageEdition(editionData, language)) continue;
      const edition = extractEditionData(elementList, editionData);
      if (edition) editions.push(edition);
    }

    return {
      editions: deduplicateEditions(editions.length ? editions : parseEditionsWithRegex(html, { language })),
      hasLanguage: true,
      nextPageUrl: getNextPageUrl(doc)
    };
  }

  function buildEditionsUrl(workId, languageCode = DEFAULT_LANGUAGE_CODE) {
    if (!/^\d+$/.test(String(workId || ''))) return null;
    const url = new URL(`/work/editions/${workId}`, GOODREADS_ORIGIN);
    url.searchParams.set('utf8', '✓');
    url.searchParams.set('sort', 'num_ratings');
    url.searchParams.set('filter_by_format', '');
    url.searchParams.set('filter_by_language', normalizeLanguage(languageCode).code);
    return url.href;
  }

  async function fetchAllEditions(workId, options = {}) {
    const language = normalizeLanguage(options.languageCode || options.language);
    const fetcher = options.fetcher || fetch;
    const maxPages = Math.max(1, Math.min(Number(options.maxPages) || DEFAULT_MAX_PAGES, 50));
    const firstUrl = buildEditionsUrl(workId, language.code);
    if (!firstUrl) throw new Error('Invalid work_id.');

    const visited = new Set();
    const editions = [];
    let nextUrl = firstUrl;
    let pagesFetched = 0;
    let partial = false;

    while (nextUrl && pagesFetched < maxPages && !visited.has(nextUrl)) {
      visited.add(nextUrl);
      let response;
      try {
        response = await fetcher(nextUrl, {
          credentials: 'include',
          signal: options.signal,
          headers: { Accept: 'text/html' }
        });
      } catch (error) {
        if (pagesFetched > 0 && editions.length > 0 && error?.name !== 'AbortError') {
          partial = true;
          break;
        }
        throw error;
      }

      if (!response.ok) {
        if (pagesFetched > 0 && editions.length > 0) {
          partial = true;
          break;
        }
        throw new Error(`Goodreads returned status ${response.status}.`);
      }

      let parsed;
      try {
        parsed = parseEditionsPage(await response.text(), { language });
      } catch (error) {
        if (pagesFetched > 0 && editions.length > 0) {
          partial = true;
          break;
        }
        throw error;
      }
      pagesFetched += 1;
      if (pagesFetched === 1 && !parsed.hasLanguage) break;
      editions.push(...parsed.editions);
      nextUrl = parsed.nextPageUrl;
    }

    if (nextUrl && pagesFetched >= maxPages) partial = true;
    return {
      editions: deduplicateEditions(editions),
      editionsPageUrl: firstUrl,
      pagesFetched,
      partial
    };
  }

  function emptyCache() {
    return { version: CACHE_VERSION, entries: {}, bookToWork: {} };
  }

  function normalizeCache(value) {
    if (!value || value.version !== CACHE_VERSION || typeof value.entries !== 'object') {
      return emptyCache();
    }
    return {
      version: CACHE_VERSION,
      entries: value.entries || {},
      bookToWork: value.bookToWork && typeof value.bookToWork === 'object' ? value.bookToWork : {}
    };
  }

  async function readCache() {
    if (memoryCache) return memoryCache;
    if (cacheLoadPromise) return cacheLoadPromise;
    if (!root.chrome?.storage?.local) {
      memoryCache = emptyCache();
      return memoryCache;
    }
    const generation = cacheGeneration;
    cacheLoadPromise = (async () => {
      try {
        const result = await root.chrome.storage.local.get(CACHE_KEY);
        if (generation === cacheGeneration) memoryCache = normalizeCache(result?.[CACHE_KEY]);
      } catch {
        if (generation === cacheGeneration) memoryCache = emptyCache();
      } finally {
        cacheLoadPromise = null;
      }
      return memoryCache || emptyCache();
    })();
    return cacheLoadPromise;
  }

  async function writeCache(cache) {
    memoryCache = cache;
    if (!root.chrome?.storage?.local) return false;
    try {
      await root.chrome.storage.local.set({ [CACHE_KEY]: cache });
      return true;
    } catch (error) {
      console.warn('[Goodreads Edition Checker] Could not persist lookup cache:', error);
      return false;
    }
  }

  function isFreshEntry(entry) {
    if (!entry || !['found', 'not-found'].includes(entry.status)) return false;
    const age = Date.now() - Number(entry.updatedAt || 0);
    const ttl = entry.partial
      ? PARTIAL_TTL_MS
      : entry.status === 'found' ? FOUND_TTL_MS : NOT_FOUND_TTL_MS;
    return age >= 0 && age <= ttl;
  }

  function sanitizeCacheEntry(entry) {
    if (!isFreshEntry(entry)) return null;
    const editions = deduplicateEditions(Array.isArray(entry.editions) ? entry.editions : []);
    if (entry.status === 'found' && editions.length === 0) return null;
    return {
      status: entry.status,
      editions,
      partial: Boolean(entry.partial),
      updatedAt: Number(entry.updatedAt)
    };
  }

  function getWorkCacheKey(workId, languageCode) {
    return `${normalizeLanguage(languageCode).code}:${workId}`;
  }

  function getFreshWorkFromCache(cache, workId, languageCode) {
    if (!/^\d+$/.test(String(workId || ''))) return null;
    return sanitizeCacheEntry(cache.entries[getWorkCacheKey(String(workId), languageCode)]);
  }

  function pruneCacheEntries(entries) {
    const ordered = Object.entries(entries)
      .filter(([, entry]) => isFreshEntry(entry))
      .sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0));
    const kept = [];
    let approximateBytes = 0;
    for (const [key, entry] of ordered) {
      if (kept.length >= MAX_CACHE_ENTRIES) break;
      const entryBytes = JSON.stringify({ [key]: entry }).length * 2;
      if (approximateBytes + entryBytes > MAX_CACHE_BYTES) continue;
      kept.push([key, entry]);
      approximateBytes += entryBytes;
    }
    return Object.fromEntries(kept);
  }

  async function getCachedWork(workId, languageCode = DEFAULT_LANGUAGE_CODE) {
    const cache = await readCache();
    return getFreshWorkFromCache(cache, workId, languageCode);
  }

  async function setCachedWork(workId, data, languageCode = DEFAULT_LANGUAGE_CODE) {
    if (!/^\d+$/.test(String(workId || ''))) return;
    const status = data?.editions?.length ? 'found' : 'not-found';
    const cache = await readCache();
    cache.entries[getWorkCacheKey(String(workId), languageCode)] = {
      status,
      editions: status === 'found' ? deduplicateEditions(data.editions) : [],
      partial: Boolean(data?.partial),
      updatedAt: Date.now()
    };

    cache.entries = pruneCacheEntries(cache.entries);
    await writeCache(cache);
  }

  async function getWorkIdForBook(bookId) {
    if (!/^\d+$/.test(String(bookId || ''))) return null;
    const cache = await readCache();
    return getFreshWorkIdFromCache(cache, bookId);
  }

  function getFreshWorkIdFromCache(cache, bookId) {
    const mapping = cache.bookToWork[String(bookId)];
    if (!mapping || !/^\d+$/.test(String(mapping.workId || ''))) return null;
    if (Date.now() - Number(mapping.updatedAt || 0) > FOUND_TTL_MS) return null;
    return String(mapping.workId);
  }

  async function resolveCachedBook(bookId, languageCode = DEFAULT_LANGUAGE_CODE, knownWorkId = null) {
    if (!/^\d+$/.test(String(bookId || ''))) return { workId: null, cachedResult: null };
    const cache = await readCache();
    const workId = /^\d+$/.test(String(knownWorkId || ''))
      ? String(knownWorkId)
      : getFreshWorkIdFromCache(cache, bookId);
    return {
      workId,
      cachedResult: workId ? getFreshWorkFromCache(cache, workId, languageCode) : null
    };
  }

  async function setWorkIdForBook(bookId, workId) {
    if (!/^\d+$/.test(String(bookId || '')) || !/^\d+$/.test(String(workId || ''))) return;
    const cache = await readCache();
    cache.bookToWork[String(bookId)] = { workId: String(workId), updatedAt: Date.now() };
    cache.bookToWork = Object.fromEntries(
      Object.entries(cache.bookToWork)
        .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
        .slice(0, MAX_BOOK_MAPPINGS)
    );
    await writeCache(cache);
  }

  async function setCachedLookup(bookId, workId, data, languageCode = DEFAULT_LANGUAGE_CODE) {
    if (!/^\d+$/.test(String(bookId || '')) || !/^\d+$/.test(String(workId || ''))) return;
    const cache = await readCache();
    const now = Date.now();
    const editions = deduplicateEditions(Array.isArray(data?.editions) ? data.editions : []);
    const status = editions.length ? 'found' : 'not-found';

    cache.entries[getWorkCacheKey(String(workId), languageCode)] = {
      status,
      editions: status === 'found' ? editions : [],
      partial: Boolean(data?.partial),
      updatedAt: now
    };
    cache.entries = pruneCacheEntries(cache.entries);

    const relatedBookIds = new Set([
      String(bookId),
      ...editions.map((edition) => edition.bookId).filter((value) => /^\d+$/.test(String(value || '')))
    ]);
    for (const relatedBookId of relatedBookIds) {
      cache.bookToWork[relatedBookId] = { workId: String(workId), updatedAt: now };
    }
    cache.bookToWork = Object.fromEntries(
      Object.entries(cache.bookToWork)
        .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
        .slice(0, MAX_BOOK_MAPPINGS)
    );
    await writeCache(cache);
  }

  async function warmCache() {
    await readCache();
  }

  async function clearCache() {
    cacheGeneration += 1;
    memoryCache = emptyCache();
    cacheLoadPromise = null;
    if (root.chrome?.storage?.local) {
      await root.chrome.storage.local.remove([CACHE_KEY, 'grpt_cache_v3', 'grpt_cache_v2']);
    }
  }

  root.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName && areaName !== 'local') return;
    if (!Object.prototype.hasOwnProperty.call(changes || {}, CACHE_KEY)) return;
    cacheGeneration += 1;
    memoryCache = normalizeCache(changes[CACHE_KEY]?.newValue);
    cacheLoadPromise = null;
  });

  root.GRPT = Object.freeze({
    GOODREADS_ORIGIN,
    Settings: Object.freeze({
      DEFAULT_LANGUAGE_CODE,
      KEY: SETTINGS_KEY,
      LANGUAGES,
      getLanguage,
      normalizeLanguage,
      setLanguage
    }),
    Cache: Object.freeze({
      clear: clearCache,
      getWork: getCachedWork,
      getWorkIdForBook,
      resolveBook: resolveCachedBook,
      setLookup: setCachedLookup,
      setWork: setCachedWork,
      setWorkIdForBook,
      warm: warmCache
    }),
    buildEditionsUrl,
    deduplicateEditions,
    extractBookId,
    extractISBN13FromText,
    extractWorkId,
    extractWorkIdFromHtml,
    fetchAllEditions,
    isValidISBN13,
    parseEditionsPage,
    parseEditionsWithRegex,
    sanitizeEdition,
    toAbsoluteGoodreadsUrl
  });
})(globalThis);
