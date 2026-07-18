/**
 * Goodreads Edition Language Checker — isolated content script.
 *
 * The panel lives in a Shadow DOM portal. The book-page pill and every cover
 * marker use local Shadow DOM hosts without leaking styles into Goodreads.
 */
(function () {
  'use strict';

  const COVER_HOVER_DELAY_MS = 700;
  const MIN_REQUEST_INTERVAL_MS = 1500;
  const REQUEST_TIMEOUT_MS = 30000;
  const MAX_MEMORY_BOOK_STATES = 200;

  const bookStates = new Map();
  const coverRecords = new Map();
  const coverTimers = new WeakMap();
  const coverPreflights = new WeakMap();
  const activeCoverImages = new WeakSet();
  const coverMountStates = new WeakMap();

  let requestQueue = Promise.resolve();
  let lastRequestStartedAt = 0;
  let mainInitTimer = null;
  let mainContext = null;
  let observedPathname = window.location.pathname;
  let panelContext = null;
  let selectedLanguage = GRPT.Settings.normalizeLanguage(GRPT.Settings.DEFAULT_LANGUAGE_CODE);

  const ui = createIsolatedUI();
  const cacheReady = GRPT.Cache.warm().catch(() => {});

  function createIsolatedUI() {
    const host = document.createElement('div');
    host.id = 'grpt-extension-root';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host, * { box-sizing: border-box; }
      button, a { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .layer { position: fixed; inset: 0; pointer-events: none; }

      .grpt-badge {
        position: relative; width: 100%; pointer-events: auto; display: inline-flex; align-items: center; justify-content: center;
        gap: 10px; max-width: 360px; min-height: 40px; padding: 8px 15px; color: #315c4f;
        background: #f3f7f5; border: 2px solid #b9d2c8; border-radius: 9999px !important;
        overflow: hidden; clip-path: inset(0 round 9999px); -webkit-clip-path: inset(0 round 9999px); isolation: isolate;
        box-shadow: 0 1px 2px rgba(31, 74, 59, .08); font: 500 15px/1.2 Lato, "Helvetica Neue", Arial, sans-serif;
        cursor: default; white-space: nowrap;
      }
      .grpt-badge:disabled { opacity: 1; }
      .grpt-badge.grpt-found, .grpt-badge.grpt-error { cursor: pointer; }
      .grpt-badge.grpt-found { color: #fff; background: #246b52; border-color: #246b52; box-shadow: 0 2px 5px rgba(36, 107, 82, .2); }
      .grpt-badge.grpt-found:hover { background: #1d5944; border-color: #1d5944; }
      .grpt-badge.grpt-not-found { color: #746c65; background: #f5f3f0; border-color: #d5cec7; box-shadow: none; }
      .grpt-badge.grpt-error { color: #814b12; background: #fff5e8; border-color: #e4bd8c; box-shadow: none; }
      .grpt-badge.grpt-error:hover { background: #fcebd5; }
      .grpt-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; color: currentColor; font-size: 20px; font-weight: 300; line-height: 1; }
      .grpt-badge .brazil-flag { width: 22px; height: 15px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.12); }
      .grpt-badge .language-flag { font-size: 20px; line-height: 1; }
      .grpt-count { min-width: 22px; padding: 2px 6px; color: currentColor; background: rgba(0,0,0,.13); border-radius: 11px; text-align: center; font-size: 10px; font-weight: 700; }
      .grpt-chevron { color: currentColor; opacity: .72; font-size: 18px; line-height: 1; }
      .main-spinner { width: 12px; height: 12px; border: 2px solid #c8c0b5; border-top-color: #6d6256; border-radius: 50%; animation: grpt-spin .8s linear infinite; }
      @keyframes grpt-spin { to { transform: rotate(360deg); } }
      .grpt-badge:focus-visible, .panel button:focus-visible, .panel a:focus-visible {
        outline: 3px solid #1f6feb; outline-offset: 2px;
      }

      .modal-backdrop {
        position: fixed; inset: 0; pointer-events: auto; display: flex; align-items: center;
        justify-content: center; padding: clamp(12px, 3vw, 28px); background: rgba(24, 20, 17, .46);
        -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: grpt-fade-in .16s ease-out;
      }
      .panel {
        --grpt-panel-width: 560px; position: relative; width: min(var(--grpt-panel-width), calc(100vw - 32px));
        max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);
        display: flex; flex-direction: column; overflow: hidden; resize: none; color: #2f2925;
        background: #fff; border: 1px solid rgba(70, 54, 44, .15); border-radius: 18px;
        box-shadow: 0 26px 80px rgba(27, 21, 17, .3), 0 4px 16px rgba(27, 21, 17, .14);
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        animation: grpt-panel-in .18s cubic-bezier(.2,.8,.2,1);
      }
      .panel:focus { outline: none; }
      .panel-header {
        flex: 0 0 auto; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center;
        gap: 12px; padding: 15px 16px 15px 18px; color: #fff;
        background: linear-gradient(135deg, #1d5944 0%, #246b52 55%, #2e765d 100%);
      }
      .panel-header-icon {
        width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.18); border-radius: 10px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      }
      .panel-header-icon .brazil-flag { width: 24px; height: 17px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.16); }
      .panel-header-icon .language-flag { font-size: 22px; line-height: 1; }
      .panel-language { position: relative; }
      .panel-language-button { width: 46px; gap: 4px; padding: 0 6px; cursor: pointer; }
      .panel-language-button:hover, .panel-language-button[aria-expanded="true"] { background: rgba(255,255,255,.22); }
      .panel-language-chevron { color: rgba(255,255,255,.72); font-size: 10px; line-height: 1; }
      .panel-language-picker {
        position: absolute; z-index: 3; top: calc(100% + 8px); left: 0; width: min(248px, calc(100vw - 48px));
        padding: 10px; color: #39312c; background: #fff; border: 1px solid #d9d0c8; border-radius: 11px;
        box-shadow: 0 12px 34px rgba(29, 23, 19, .24);
      }
      .panel-language-picker[hidden] { display: none; }
      .panel-language-label { display: block; margin: 0 0 6px; color: #756b63; font-size: 10px; font-weight: 650; }
      .panel-language-select {
        width: 100%; min-height: 36px; padding: 0 30px 0 10px; color: #302a26; background: #faf8f5;
        border: 1px solid #cfc5bd; border-radius: 8px; font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel-heading { min-width: 0; }
      .panel-title { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; font-weight: 720; letter-spacing: -.01em; }
      .panel-summary { margin: 2px 0 0; color: rgba(255,255,255,.76); font-size: 11px; }
      .panel-close {
        width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0;
        color: #fff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14);
        border-radius: 50%; cursor: pointer; font-size: 20px; line-height: 1;
      }
      .panel-close:hover { background: rgba(255,255,255,.18); }
      .edition-list {
        flex: 0 1 auto; min-height: 0; max-height: min(540px, calc(100vh - 150px)); margin: 0; padding: 0;
        overflow-y: auto; overscroll-behavior: contain;
        scrollbar-color: #c7bdb4 transparent; scrollbar-width: thin; list-style: none; background: #fff;
      }
      .edition { display: grid; grid-template-columns: 56px minmax(0,1fr); gap: 13px; padding: 13px 18px; border-bottom: 1px solid #eeeae6; transition: background .12s ease; }
      .edition:last-child { border-bottom: 0; }
      .edition:hover { background: #faf8f5; }
      .edition-cover { width: 56px; height: 82px; object-fit: cover; border-radius: 6px; background: #eeeae5; box-shadow: 0 2px 7px rgba(46, 37, 31, .16); }
      .edition-info { min-width: 0; }
      .edition-title { margin: 1px 0 6px; overflow: hidden; color: #302a26; font-size: 13px; font-weight: 680; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
      .edition-title a { color: inherit; text-decoration: none; }
      .edition-title a:hover { color: #1d5944; text-decoration: underline; text-underline-offset: 2px; }
      .edition-meta, .edition-isbn { margin: 3px 0 0; overflow: hidden; color: #756c65; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
      .edition-isbn { color: #92877e; font-variant-numeric: tabular-nums; }
      .panel-footer { flex: 0 0 auto; padding: 11px 16px 13px; text-align: center; background: #faf8f5; border-top: 1px solid #e9e3de; }
      .panel-footer a {
        display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 7px 14px;
        color: #315c4f; background: #fff; border: 1px solid #c9d8d2; border-radius: 999px;
        text-decoration: none; font-size: 11px; font-weight: 650; box-shadow: 0 1px 2px rgba(31,74,59,.06);
      }
      .panel-footer a:hover { color: #fff; background: #246b52; border-color: #246b52; }

      @keyframes grpt-fade-in { from { opacity: 0; } }
      @keyframes grpt-panel-in { from { opacity: 0; transform: translateY(8px) scale(.985); } }

      @media (max-width: 600px) {
        .modal-backdrop { align-items: flex-end; padding: 8px; }
        .panel {
          width: 100%; max-width: 100%; max-height: calc(100vh - 16px); border-radius: 16px;
        }
        .panel-header { padding: 13px 12px 13px 14px; }
        .panel-header-icon { width: 32px; height: 32px; border-radius: 9px; }
        .panel-language-button { width: 42px; }
        .edition { grid-template-columns: 46px minmax(0,1fr); gap: 11px; padding: 12px 14px; }
        .edition-cover { width: 46px; height: 68px; }
        .edition-list { max-height: calc(100vh - 132px); }
      }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
    `;
    shadow.appendChild(style);

    const modalLayer = makeLayer(shadow, 'modal-layer');
    return { host, shadow, modalLayer };
  }

  function makeLayer(shadow, className) {
    const layer = document.createElement('div');
    layer.className = `layer ${className}`;
    shadow.appendChild(layer);
    return layer;
  }

  function createBrazilFlag() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.classList.add('brazil-flag');
    svg.setAttribute('viewBox', '0 0 28 20');
    svg.setAttribute('aria-hidden', 'true');
    const background = document.createElementNS(namespace, 'rect');
    background.setAttribute('width', '28');
    background.setAttribute('height', '20');
    background.setAttribute('rx', '1');
    background.setAttribute('fill', '#009b3a');
    const diamond = document.createElementNS(namespace, 'path');
    diamond.setAttribute('d', 'M14 2.4 25 10 14 17.6 3 10Z');
    diamond.setAttribute('fill', '#ffdf00');
    const globe = document.createElementNS(namespace, 'circle');
    globe.setAttribute('cx', '14');
    globe.setAttribute('cy', '10');
    globe.setAttribute('r', '4.4');
    globe.setAttribute('fill', '#002776');
    svg.append(background, diamond, globe);
    return svg;
  }

  function createLanguageIcon(language = selectedLanguage) {
    if (language.code === 'por') return createBrazilFlag();
    const icon = document.createElement('span');
    icon.className = 'language-flag';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = language.flag;
    return icon;
  }

  function appendTextElement(parent, className, text) {
    const element = document.createElement('span');
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function isVisible(element) {
    return Boolean(element?.isConnected && element.getClientRects().length > 0);
  }

  function stateKey(bookId, languageCode = selectedLanguage.code) {
    return `${languageCode}:${bookId}`;
  }

  function getBookState(bookId) {
    return bookStates.get(stateKey(String(bookId))) || null;
  }

  function setBookState(bookId, state) {
    const key = stateKey(String(bookId), state.language.code);
    bookStates.delete(key);
    bookStates.set(key, state);
    if (bookStates.size > MAX_MEMORY_BOOK_STATES) {
      for (const [candidateKey, candidate] of bookStates) {
        if (bookStates.size <= MAX_MEMORY_BOOK_STATES) break;
        if (['queued', 'loading'].includes(candidate.status)) continue;
        if (mainContext && candidateKey === stateKey(mainContext.bookId)) continue;
        bookStates.delete(candidateKey);
      }
    }
    if (state.language.code === selectedLanguage.code) refreshBookUI(String(bookId));
  }

  function refreshBookUI(bookId) {
    for (const record of coverRecords.values()) {
      if (record.bookId === bookId) renderCoverRecord(record);
    }
    if (mainContext?.bookId === bookId) renderMainButton();
  }

  function applyCachedResult(bookId, state, cached) {
    state.status = cached.status;
    state.editions = cached.editions;
    state.partial = Boolean(cached.partial);
    state.totalPages = Math.max(1, Number(cached.totalPages) || 1);
    state.minimumEditionCount = Math.max(state.editions.length,
      Number(cached.minimumEditionCount) || state.editions.length);
    setBookState(bookId, state);
    return state;
  }

  function enqueueNetworkLookup(bookId, knownWorkId, state) {
    const networkPromise = requestQueue
      .catch(() => {})
      .then(async () => {
        const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt));
        if (wait) await delay(wait);
        lastRequestStartedAt = Date.now();
        state.status = 'loading';
        setBookState(bookId, state);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          let workId = knownWorkId;
          if (!workId) {
            const response = await fetch(`/book/show/${bookId}.xml`, {
              credentials: 'include',
              signal: controller.signal
            });
            if (!response.ok || response.status === 202) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            if (html.includes('awsWafCookieDomainList')) throw new Error('AWS WAF');
            workId = GRPT.extractWorkId(null, html);
            if (!workId) throw new Error('work_id not found');
          }
          state.workId = String(workId);

          const cached = await GRPT.Cache.getWork(state.workId, state.language.code);
          if (cached) {
            await GRPT.Cache.setWorkIdForBook(bookId, state.workId);
            return applyCachedResult(bookId, state, cached);
          }

          const result = await GRPT.fetchAllEditions(state.workId, {
            signal: controller.signal,
            maxPages: 1,
            languageCode: state.language.code
          });
          await GRPT.Cache.setLookup(bookId, state.workId, result, state.language.code);
          return applyCachedResult(bookId, state, {
            status: result.editions.length ? 'found' : 'not-found',
            editions: result.editions,
            partial: result.partial,
            totalPages: result.totalPages,
            minimumEditionCount: result.minimumEditionCount
          });
        } catch (error) {
          console.error('[Goodreads Edition Checker] Failed to check book:', bookId, error);
          state.status = 'error';
          state.error = error;
          setBookState(bookId, state);
          return state;
        } finally {
          clearTimeout(timeout);
        }
      });
    requestQueue = networkPromise;
    return networkPromise;
  }

  function lookupBook(bookId, knownWorkId = null, preflightPromise = null) {
    const key = String(bookId);
    const language = selectedLanguage;
    const existing = getBookState(key);
    if (existing?.status) return existing.promise || Promise.resolve(existing);

    const state = {
      bookId: key,
      status: 'queued',
      editions: [],
      workId: knownWorkId,
      partial: false,
      totalPages: 1,
      minimumEditionCount: 0,
      promise: null,
      language
    };
    setBookState(key, state);
    const promise = (async () => {
      await cacheReady;
      let resolved = await (preflightPromise
        || GRPT.Cache.resolveBook(key, language.code, knownWorkId));
      if (!resolved.cachedResult) {
        resolved = await GRPT.Cache.resolveBook(key, language.code, knownWorkId || resolved.workId);
      }
      state.workId = resolved.workId || knownWorkId;
      if (resolved.cachedResult) return applyCachedResult(key, state, resolved.cachedResult);
      return enqueueNetworkLookup(key, state.workId, state);
    })();
    state.promise = promise;
    return promise;
  }

  // ── Covers ───────────────────────────────────────────────────

  function findBookLinkNearImage(image) {
    const direct = image.closest('a[href*="/book/show/"]');
    if (direct) return direct;
    let current = image.parentElement;
    for (let depth = 0; current && current !== document.body && depth < 8; depth += 1) {
      const links = [...current.querySelectorAll('a[href*="/book/show/"]')];
      if (links.length) {
        const ids = new Set(links.map((link) => GRPT.extractBookId(link.href)).filter(Boolean));
        if (ids.size === 1) return links[0];
        if (ids.size > 1) return null;
      }
      current = current.parentElement;
    }
    return null;
  }

  function findWorkIdNearImage(image) {
    let current = image.parentElement;
    for (let depth = 0; current && current !== document.body && depth < 6; depth += 1) {
      const workIds = new Set();
      const ownWorkId = current.getAttribute('data-work-id') || current.getAttribute('data-workid');
      if (/^\d+$/.test(String(ownWorkId || ''))) workIds.add(String(ownWorkId));
      for (const element of current.querySelectorAll('[data-work-id], [data-workid]')) {
        const value = element.getAttribute('data-work-id') || element.getAttribute('data-workid');
        if (/^\d+$/.test(String(value || ''))) workIds.add(String(value));
      }
      for (const link of current.querySelectorAll('a[href*="/work/"]')) {
        const workId = GRPT.extractWorkIdFromHtml(link.getAttribute('href') || link.href);
        if (workId) workIds.add(workId);
      }
      if (workIds.size === 1) return [...workIds][0];
      if (workIds.size > 1) return null;
      current = current.parentElement;
    }
    return null;
  }

  function isLikelyBookCover(image) {
    const rect = image.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 36) return false;
    const aspectRatio = rect.width / rect.height;
    return aspectRatio >= 0.45 && aspectRatio <= 0.9;
  }

  function findCoverMount(image) {
    const imageRect = image.getBoundingClientRect();
    let current = image.parentElement;
    for (let depth = 0; current && current !== document.body && depth < 5; depth += 1) {
      if (current.tagName !== 'PICTURE') {
        const rect = current.getBoundingClientRect();
        const display = getComputedStyle(current).display;
        const containsImageCenter = rect.left <= imageRect.left + imageRect.width / 2
          && rect.right >= imageRect.left + imageRect.width / 2
          && rect.top <= imageRect.top + imageRect.height / 2
          && rect.bottom >= imageRect.top + imageRect.height / 2;
        if (display !== 'inline' && containsImageCenter && rect.width > 0 && rect.height > 0) return current;
      }
      current = current.parentElement;
    }
    return image.parentElement;
  }

  function acquireCoverMount(mount) {
    let state = coverMountStates.get(mount);
    if (!state) {
      const changedPosition = getComputedStyle(mount).position === 'static';
      state = { count: 0, changedPosition, originalInlinePosition: mount.style.position };
      if (changedPosition) mount.style.position = 'relative';
      coverMountStates.set(mount, state);
    }
    state.count += 1;
  }

  function releaseCoverMount(mount) {
    const state = coverMountStates.get(mount);
    if (!state) return;
    state.count -= 1;
    if (state.count > 0) return;
    if (state.changedPosition && mount.style.position === 'relative') {
      mount.style.position = state.originalInlinePosition;
    }
    coverMountStates.delete(mount);
  }

  function createCoverRecord(image, bookId) {
    const mount = findCoverMount(image);
    if (!mount) return null;
    acquireCoverMount(mount);

    const host = document.createElement('span');
    host.dataset.grptCoverHost = '';
    host.style.cssText = 'all:initial;position:absolute;left:0;top:0;width:0;height:0;z-index:1;overflow:hidden;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .cover-marker {
        position: absolute; right: 0; top: 0; display: inline-flex; align-items: center; justify-content: center;
        gap: 4px; height: 22px; padding: 3px 6px; border: 0; border-radius: 0 4px 0 7px;
        box-sizing: border-box; box-shadow: -1px 1px 4px rgba(0,0,0,.28);
        font: 800 9px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: .04em; pointer-events: none; overflow: hidden;
      }
      .cover-marker.found { width: 26px; padding: 3px 4px; color: #174d28; background: rgba(255,255,255,.96); border-left: 1px solid rgba(0,0,0,.12); border-bottom: 1px solid rgba(0,0,0,.12); pointer-events: auto; cursor: pointer; }
      .cover-marker.found:hover { background: #fff; filter: brightness(.97); }
      .cover-marker.found:focus-visible { outline: 2px solid #1f6feb; outline-offset: -2px; }
      .cover-marker.found .brazil-flag { width: 18px; height: 12px; flex: 0 0 auto; border-radius: 1px; }
      .cover-marker.found .language-flag { font-size: 16px; line-height: 1; }
      .cover-marker.not-found { width: 19px; height: 19px; padding: 0; color: #fff; background: rgba(56,51,47,.88); font-size: 14px; font-weight: 700; }
      .cover-marker.loading { width: 19px; height: 19px; padding: 0; background: rgba(255,255,255,.94); border-left: 1px solid rgba(0,0,0,.1); border-bottom: 1px solid rgba(0,0,0,.1); }
      .cover-spinner { width: 10px; height: 10px; box-sizing: border-box; border: 1.5px solid #c9d6c8; border-top-color: #39763f; border-radius: 50%; animation: spin .7s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .cover-spinner { animation: none; border-top-color: #39763f; } }
    `;
    const marker = document.createElement('span');
    marker.className = 'cover-marker';
    marker.setAttribute('role', 'img');
    marker.addEventListener('click', (event) => {
      const state = getBookState(record.bookId);
      if (state?.status !== 'found') return;
      event.preventDefault();
      event.stopPropagation();
      openEditionsPanel(state, record.marker);
    });
    marker.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const state = getBookState(record.bookId);
      if (state?.status !== 'found') return;
      event.preventDefault();
      event.stopPropagation();
      openEditionsPanel(state, record.marker);
    });
    shadow.append(style, marker);
    mount.appendChild(host);
    const record = { image, bookId: String(bookId), mount, host, marker };
    if (typeof ResizeObserver === 'function') {
      record.resizeObserver = new ResizeObserver(() => positionCoverRecord(record));
      record.resizeObserver.observe(image);
      record.resizeObserver.observe(mount);
    }
    positionCoverRecord(record);
    return record;
  }

  function removeCoverRecord(record) {
    record.resizeObserver?.disconnect();
    record.host.remove();
    releaseCoverMount(record.mount);
  }

  function beginCoverHover(image) {
    const bookLink = findBookLinkNearImage(image);
    const bookId = GRPT.extractBookId(bookLink?.href);
    if (!bookId || !isVisible(image) || !isLikelyBookCover(image)) return;
    activeCoverImages.add(image);
    const languageCode = selectedLanguage.code;
    const knownWorkId = findWorkIdNearImage(image);
    let preflight = coverPreflights.get(image);
    if (preflight?.bookId !== String(bookId) || preflight.languageCode !== languageCode
      || preflight.knownWorkId !== knownWorkId) {
      preflight = {
        bookId: String(bookId),
        languageCode,
        knownWorkId,
        promise: GRPT.Cache.resolveBook(bookId, languageCode, knownWorkId)
      };
      coverPreflights.set(image, preflight);
    }
    clearTimeout(coverTimers.get(image));
    coverTimers.set(image, setTimeout(() => {
      coverTimers.delete(image);
      if (!activeCoverImages.has(image) || !image.isConnected) return;
      if (preflight.languageCode !== selectedLanguage.code) {
        preflight = {
          bookId: String(bookId),
          languageCode: selectedLanguage.code,
          knownWorkId,
          promise: GRPT.Cache.resolveBook(bookId, selectedLanguage.code, knownWorkId)
        };
        coverPreflights.set(image, preflight);
      }
      let record = coverRecords.get(image);
      if (record && (!record.host.isConnected || !record.mount.contains(image))) {
        removeCoverRecord(record);
        coverRecords.delete(image);
        record = null;
      }
      if (!record) {
        record = createCoverRecord(image, bookId);
        if (!record) return;
        coverRecords.set(image, record);
      } else if (record.bookId !== String(bookId)) {
        record.bookId = String(bookId);
        record.marker.hidden = true;
      }
      positionCoverRecord(record);
      renderCoverRecord(record);
      lookupBook(bookId, preflight.knownWorkId, preflight.promise);
    }, COVER_HOVER_DELAY_MS));
  }

  function endCoverHover(image, relatedTarget) {
    if (relatedTarget instanceof Node && image.contains(relatedTarget)) return;
    activeCoverImages.delete(image);
    clearTimeout(coverTimers.get(image));
    coverTimers.delete(image);
  }

  function renderCoverRecord(record) {
    const state = getBookState(record.bookId);
    if (state?.status === 'error') {
      record.marker.hidden = true;
      return;
    }
    record.marker.hidden = false;
    const status = !state || ['queued', 'loading'].includes(state.status) ? 'loading' : state.status;
    record.marker.className = `cover-marker ${status}`;
    record.marker.removeAttribute('tabindex');
    record.marker.replaceChildren();
    if (status === 'loading') {
      appendTextElement(record.marker, 'cover-spinner', '');
      record.marker.setAttribute('role', 'img');
    } else if (status === 'found') {
      record.marker.append(createLanguageIcon(state.language));
      record.marker.setAttribute('role', 'button');
      record.marker.setAttribute('tabindex', '0');
    } else {
      record.marker.textContent = '×';
      record.marker.setAttribute('role', 'img');
    }
    const language = state?.language || selectedLanguage;
    const label = status === 'loading'
      ? `Checking for a ${language.label} edition`
      : status === 'found'
        ? `${language.label} edition available`
        : `No ${language.label} edition`;
    record.marker.setAttribute('aria-label', label);
    record.marker.title = label;
    positionCoverRecord(record);
  }

  function positionCoverRecord(record) {
    if (!isVisible(record.image)) {
      record.marker.hidden = true;
      return;
    }
    const state = getBookState(record.bookId);
    if (!state || ['queued', 'loading', 'found', 'not-found'].includes(state.status)) record.marker.hidden = false;
    const imageRect = record.image.getBoundingClientRect();
    const mountRect = record.mount.getBoundingClientRect();
    record.host.style.left = `${imageRect.left - mountRect.left - record.mount.clientLeft}px`;
    record.host.style.top = `${imageRect.top - mountRect.top - record.mount.clientTop}px`;
    record.host.style.width = `${imageRect.width}px`;
    record.host.style.height = `${imageRect.height}px`;
  }

  // ── Book page and editions panel ─────────────────────────────

  function getControlLabel(element) {
    return `${element?.textContent || ''} ${element?.getAttribute?.('aria-label') || ''} ${element?.title || ''}`
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findMainActionPlacement() {
    const controls = [...document.querySelectorAll('button, a')].filter(isVisible);
    const buyControl = controls.find((element) => /buy on amazon|comprar? (?:na|no) amazon|amazon/.test(getControlLabel(element)))
      || controls.find((element) => /\bkindle\b/.test(getControlLabel(element)))
      || controls.find((element) => /more options to get the book|get the book/.test(getControlLabel(element)));
    if (!buyControl) return null;

    const wantControl = controls.find((element) => /want to read|quero ler/.test(getControlLabel(element))) || null;
    let actionRow = buyControl.parentElement;
    let current = actionRow;
    for (let depth = 0; current?.parentElement && depth < 5; depth += 1) {
      const rect = current.getBoundingClientRect();
      const containsWant = wantControl && current.contains(wantControl);
      if (containsWant || rect.height > 120 || rect.width > 420) break;
      actionRow = current;
      current = current.parentElement;
    }
    if (!actionRow?.parentElement) return null;
    return { actionRow, buyControl, wantControl };
  }

  function createMainPill(placement, bookId, workId, pathname) {
    const host = document.createElement('div');
    host.dataset.grptMainHost = '';
    host.style.cssText = 'all:initial;display:block;box-sizing:border-box;flex:0 0 auto;align-self:flex-start;grid-column:1 / -1;';
    const shadow = host.attachShadow({ mode: 'open' });
    const sharedStyle = ui.shadow.querySelector('style')?.cloneNode(true);
    if (sharedStyle) shadow.appendChild(sharedStyle);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grpt-badge grpt-loading';
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', () => {
      const state = getBookState(bookId);
      if (state?.status === 'found') openEditionsPanel(state, button);
      else if (state?.status === 'error') {
        bookStates.delete(stateKey(String(bookId)));
        lookupBook(bookId, workId);
      }
    });
    shadow.appendChild(button);
    placement.actionRow.insertAdjacentElement('afterend', host);
    return {
      pathname,
      bookId: String(bookId),
      workId: String(workId),
      host,
      button,
      ...placement
    };
  }

  function applyMainPillLayout(reference) {
    if (!mainContext || !reference?.isConnected) return;
    const { actionRow, button, host } = mainContext;
    const referenceStyle = getComputedStyle(reference);
    const referenceRect = reference.getBoundingClientRect();
    const rowRect = actionRow.getBoundingClientRect();

    host.style.width = `${Math.max(rowRect.width, referenceRect.width)}px`;
    const parentStyle = getComputedStyle(actionRow.parentElement);
    host.style.marginTop = parseFloat(parentStyle.rowGap || parentStyle.gap || '0') > 0 ? '0' : '8px';

    button.style.width = '100%';
    button.style.maxWidth = 'none';
    button.style.height = referenceRect.height > 0 ? `${referenceRect.height}px` : '40px';
    button.style.minHeight = button.style.height;
    button.style.padding = referenceStyle.padding;
    button.style.setProperty('border-radius', '9999px', 'important');
    button.style.clipPath = 'inset(0 round 9999px)';
    button.style.webkitClipPath = 'inset(0 round 9999px)';
    button.style.overflow = 'hidden';
    button.style.fontFamily = referenceStyle.fontFamily;
    button.style.fontSize = referenceStyle.fontSize;
    button.style.fontWeight = referenceStyle.fontWeight;
    button.style.letterSpacing = referenceStyle.letterSpacing;
    button.style.lineHeight = referenceStyle.lineHeight;
  }

  function initMainPage() {
    const pathname = window.location.pathname;
    if (!pathname.startsWith('/book/show/')) {
      if (mainContext) removeMainContext();
      return;
    }
    const bookId = GRPT.extractBookId(pathname);
    const workId = GRPT.extractWorkId(document);
    const placement = findMainActionPlacement();
    if (!bookId || !workId || !placement) return;
    if (mainContext?.pathname === pathname && mainContext.host.isConnected) {
      syncMainPillLayout();
      return;
    }
    removeMainContext();
    mainContext = createMainPill(placement, bookId, workId, pathname);
    syncMainPillLayout();
    renderMainButton();
    lookupBook(bookId, workId);
  }

  function removeMainContext() {
    mainContext?.host.remove();
    mainContext = null;
    closeEditionsPanel();
  }

  function renderMainButton() {
    if (!mainContext) return;
    const state = getBookState(mainContext.bookId);
    const button = mainContext.button;
    button.className = 'grpt-badge';
    button.replaceChildren();
    button.title = '';
    const language = state?.language || selectedLanguage;
    if (!state || ['queued', 'loading'].includes(state.status)) {
      button.classList.add('grpt-loading');
      appendTextElement(button, 'main-spinner', '');
      appendTextElement(button, 'grpt-text', `Checking ${language.label} editions…`);
      button.disabled = true;
      button.setAttribute('aria-label', `Checking ${language.label} editions`);
    } else if (state.status === 'found') {
      button.classList.add('grpt-found');
      const displayedCount = Math.max(state.editions.length,
        Number(state.minimumEditionCount) || state.editions.length);
      const estimatedCount = state.partial && displayedCount > state.editions.length;
      const icon = appendTextElement(button, 'grpt-icon', '');
      icon.append(createLanguageIcon(language));
      appendTextElement(button, 'grpt-text', `${language.label} editions`);
      appendTextElement(button, 'grpt-count', estimatedCount ? `${displayedCount}+` : String(displayedCount));
      appendTextElement(button, 'grpt-chevron', '›');
      button.disabled = false;
      button.setAttribute('aria-label', `${estimatedCount ? 'At least ' : ''}${displayedCount} ${language.label} ${displayedCount === 1 ? 'edition' : 'editions'}; open list`);
      button.title = 'Click to view the editions found';
    } else if (state.status === 'not-found') {
      button.classList.add('grpt-not-found');
      appendTextElement(button, 'grpt-icon', '✗');
      appendTextElement(button, 'grpt-text', `No ${language.label} edition`);
      button.disabled = true;
      button.setAttribute('aria-label', `No ${language.label} edition found`);
    } else {
      button.classList.add('grpt-error');
      appendTextElement(button, 'grpt-icon', '⚠');
      appendTextElement(button, 'grpt-text', 'Could not check — try again');
      button.disabled = false;
      button.setAttribute('aria-label', 'Could not check; try again');
    }
    syncMainPillLayout();
  }

  function syncMainPillLayout() {
    if (!mainContext) return;
    const { button, buyControl } = mainContext;
    button.hidden = false;
    applyMainPillLayout(buyControl);
  }

  function openEditionsPanel(state, opener = null) {
    closeEditionsPanel();
    const language = state.language || selectedLanguage;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'grpt-panel-title');
    panel.setAttribute('aria-describedby', 'grpt-panel-summary');
    panel.tabIndex = -1;
    const editionCount = state.editions.length;
    const displayedEditionCount = Math.max(editionCount,
      Number(state.minimumEditionCount) || editionCount);
    const estimatedEditionCount = state.partial && displayedEditionCount > editionCount;
    const longestLine = Math.max(
      `${language.label} editions`.length,
      ...state.editions.flatMap((edition) => [edition.title, edition.meta, edition.isbn13]
        .map((value) => String(value || '').length))
    );
    const estimatedWidth = Math.min(640, Math.max(430, 260 + Math.min(longestLine, 60) * 6.2));
    panel.style.setProperty('--grpt-panel-width', `${Math.round(estimatedWidth)}px`);

    const header = document.createElement('header');
    header.className = 'panel-header';
    const languageControl = document.createElement('div');
    languageControl.className = 'panel-language';
    const headerIcon = document.createElement('button');
    headerIcon.className = 'panel-header-icon panel-language-button';
    headerIcon.type = 'button';
    headerIcon.setAttribute('aria-label', `Change edition language; current language is ${language.label}`);
    headerIcon.setAttribute('aria-haspopup', 'listbox');
    headerIcon.setAttribute('aria-expanded', 'false');
    headerIcon.append(createLanguageIcon(language));
    appendTextElement(headerIcon, 'panel-language-chevron', '▾').setAttribute('aria-hidden', 'true');
    const languagePicker = document.createElement('div');
    languagePicker.className = 'panel-language-picker';
    languagePicker.hidden = true;
    const languageLabel = document.createElement('label');
    languageLabel.className = 'panel-language-label';
    languageLabel.htmlFor = 'grpt-panel-language-select';
    languageLabel.textContent = 'Edition language';
    const languageSelect = document.createElement('select');
    languageSelect.className = 'panel-language-select';
    languageSelect.id = 'grpt-panel-language-select';
    languageSelect.setAttribute('aria-label', 'Edition language');
    for (const optionLanguage of GRPT.Settings.LANGUAGES) {
      const option = document.createElement('option');
      option.value = optionLanguage.code;
      option.textContent = `${optionLanguage.flag}  ${optionLanguage.label}`;
      languageSelect.appendChild(option);
    }
    languageSelect.value = language.code;
    languagePicker.append(languageLabel, languageSelect);
    languageControl.append(headerIcon, languagePicker);
    const heading = document.createElement('div');
    heading.className = 'panel-heading';
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.id = 'grpt-panel-title';
    title.textContent = `${language.label} editions`;
    const summary = document.createElement('p');
    summary.className = 'panel-summary';
    summary.id = 'grpt-panel-summary';
    summary.textContent = `${estimatedEditionCount ? 'At least ' : ''}${displayedEditionCount} ${displayedEditionCount === 1 ? 'edition' : 'editions'} found`;
    heading.append(title, summary);
    const close = document.createElement('button');
    close.className = 'panel-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    header.append(languageControl, heading, close);
    panel.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'edition-list';
    for (const edition of state.editions) list.appendChild(createEditionRow(edition));
    panel.appendChild(list);

    const footer = document.createElement('footer');
    footer.className = 'panel-footer';
    const link = document.createElement('a');
    link.href = GRPT.buildEditionsUrl(state.workId, language.code);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View editions on Goodreads ↗';
    footer.appendChild(link);
    panel.appendChild(footer);
    backdrop.appendChild(panel);
    ui.modalLayer.appendChild(backdrop);

    headerIcon.addEventListener('click', () => {
      languagePicker.hidden = !languagePicker.hidden;
      headerIcon.setAttribute('aria-expanded', String(!languagePicker.hidden));
      if (!languagePicker.hidden) languageSelect.focus();
    });
    panel.addEventListener('click', (event) => {
      if (languagePicker.hidden || languageControl.contains(event.target)) return;
      languagePicker.hidden = true;
      headerIcon.setAttribute('aria-expanded', 'false');
    });
    languageSelect.addEventListener('change', async () => {
      const nextLanguage = GRPT.Settings.normalizeLanguage(languageSelect.value);
      if (nextLanguage.code === language.code) {
        languagePicker.hidden = true;
        headerIcon.setAttribute('aria-expanded', 'false');
        headerIcon.focus();
        return;
      }
      languageSelect.disabled = true;
      const sourceBookId = state.bookId || mainContext?.bookId;
      const sourceWorkId = state.workId;
      try {
        await GRPT.Settings.setLanguage(nextLanguage.code);
        applyLanguage(nextLanguage);
        if (sourceBookId && sourceWorkId) {
          const nextState = await lookupBook(sourceBookId, sourceWorkId);
          if (['found', 'not-found'].includes(nextState.status)) {
            openEditionsPanel(nextState, opener);
          }
        }
      } catch (error) {
        console.error('[Goodreads Edition Checker] Failed to change panel language:', error);
        languageSelect.value = language.code;
        languageSelect.disabled = false;
      }
    });

    const keyHandler = (event) => {
      if (event.key === 'Escape') {
        if (!languagePicker.hidden) {
          languagePicker.hidden = true;
          headerIcon.setAttribute('aria-expanded', 'false');
          headerIcon.focus();
          return;
        }
        closeEditionsPanel();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button:not([disabled]), select:not([disabled]), a[href]')]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = panel.getRootNode().activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === panel) {
        event.preventDefault();
        first.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    close.addEventListener('click', closeEditionsPanel);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeEditionsPanel();
    });
    document.addEventListener('keydown', keyHandler);
    panelContext = { backdrop, keyHandler, opener: opener || mainContext?.button };
    panel.focus();
  }

  function createEditionRow(edition) {
    const item = document.createElement('li');
    item.className = 'edition';
    if (edition.cover) {
      const cover = document.createElement('img');
      cover.className = 'edition-cover';
      cover.src = edition.cover;
      cover.alt = `Cover of ${edition.title}`;
      cover.loading = 'lazy';
      item.appendChild(cover);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'edition-cover';
      item.appendChild(placeholder);
    }
    const info = document.createElement('div');
    info.className = 'edition-info';
    const title = document.createElement('p');
    title.className = 'edition-title';
    if (edition.url) {
      const link = document.createElement('a');
      link.href = edition.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = edition.title;
      link.title = edition.title;
      title.appendChild(link);
    } else title.textContent = edition.title;
    info.appendChild(title);
    if (edition.meta) {
      const meta = document.createElement('p');
      meta.className = 'edition-meta';
      meta.textContent = edition.meta;
      meta.title = edition.meta;
      info.appendChild(meta);
    }
    const isbn = document.createElement('p');
    isbn.className = 'edition-isbn';
    isbn.textContent = edition.isbn13 ? `ISBN-13: ${edition.isbn13}` : 'ISBN unavailable';
    info.appendChild(isbn);
    item.appendChild(info);
    return item;
  }

  function closeEditionsPanel() {
    if (!panelContext) return;
    document.removeEventListener('keydown', panelContext.keyHandler);
    panelContext.backdrop.remove();
    const opener = panelContext.opener;
    panelContext = null;
    if (opener?.isConnected) opener.focus();
  }

  function scheduleMainInit(delayMs = 120) {
    clearTimeout(mainInitTimer);
    mainInitTimer = setTimeout(() => {
      mainInitTimer = null;
      initMainPage();
    }, delayMs);
  }

  function applyLanguage(language) {
    const nextLanguage = GRPT.Settings.normalizeLanguage(language);
    if (nextLanguage.code === selectedLanguage.code) return;
    selectedLanguage = nextLanguage;
    closeEditionsPanel();
    for (const record of coverRecords.values()) removeCoverRecord(record);
    coverRecords.clear();
    if (mainContext) {
      renderMainButton();
      lookupBook(mainContext.bookId, mainContext.workId);
    }
  }

  // ── Events and maintenance ───────────────────────────────────

  document.addEventListener('mouseover', (event) => {
    const image = event.target.closest?.('img');
    if (image && image !== event.relatedTarget) beginCoverHover(image);
  }, { passive: true });

  document.addEventListener('mouseout', (event) => {
    const image = event.target.closest?.('img');
    if (image) endCoverHover(image, event.relatedTarget);
  }, { passive: true });

  const observer = new MutationObserver(() => {
    scheduleMainInit();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function maintainCoverRecords(reposition = false) {
    for (const [image, record] of coverRecords) {
      if (!image.isConnected) {
        removeCoverRecord(record);
        coverRecords.delete(image);
      } else if (reposition) positionCoverRecord(record);
    }
  }

  function handleResize() {
    maintainCoverRecords(true);
    syncMainPillLayout();
  }
  window.addEventListener('resize', handleResize);
  window.addEventListener('popstate', () => scheduleMainInit(0));
  setInterval(() => {
    maintainCoverRecords(false);
    const pathname = window.location.pathname;
    if (pathname !== observedPathname) {
      observedPathname = pathname;
      scheduleMainInit(0);
    }
  }, 1000);

  chrome.storage?.onChanged?.addListener((changes) => {
    const nextCode = changes?.[GRPT.Settings.KEY]?.newValue?.languageCode;
    if (nextCode) applyLanguage(nextCode);
  });

  GRPT.Settings.getLanguage()
    .then((language) => {
      selectedLanguage = language;
      scheduleMainInit(0);
    })
    .catch(() => scheduleMainInit(0));
})();
