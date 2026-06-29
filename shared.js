const TELEGRAM_URL = 'https://web.telegram.org/a/#-1001380278130';

function extractWorkIdFromHTML(html) {
  const editionsLinksMatch = html.match(/\/work\/editions\/(\d+)/);
  if (editionsLinksMatch) return editionsLinksMatch[1];
  const workLinksMatch = html.match(/\/work\/(\d+)/);
  if (workLinksMatch) return workLinksMatch[1];
  const workRegex = html.match(/work[_\-]?id["\s:=]+(\d+)/i);
  if (workRegex) return workRegex[1];
  return null;
}

function hasPortugueseInLanguageDropdown(doc, html) {
  const langSelect = doc.querySelector('select[name="filter_by_language"]');
  if (langSelect) {
    const options = langSelect.querySelectorAll('option');
    for (const opt of options) {
      const val = (opt.getAttribute('value') || '').toLowerCase();
      const text = opt.textContent.trim().toLowerCase();
      if (val === 'por' || text === 'portuguese') return true;
    }
    return false;
  }
  const selectMatch = html.match(/filter_by_language[\s\S]*?<\/select>/i);
  if (selectMatch) {
    const selectHtml = selectMatch[0];
    return /value="por"/i.test(selectHtml) || /Portuguese/i.test(selectHtml);
  }
  return false;
}

function isPortugueseEdition(editionDataEl) {
  const dataTitles = editionDataEl.querySelectorAll('.dataTitle');
  for (const dt of dataTitles) {
    if (dt.textContent.trim().toLowerCase().includes('edition language')) {
      const dv = dt.nextElementSibling || dt.parentElement.querySelector('.dataValue');
      if (dv) return dv.textContent.trim().toLowerCase().includes('portuguese');
    }
  }
  const fullText = editionDataEl.textContent;
  const langMatch = fullText.match(/Edition language:\s*([\w\s]+)/i);
  if (langMatch) return langMatch[1].trim().toLowerCase().includes('portuguese');
  return false;
}

function extractCoverUrl(el) {
  const img = el.querySelector('img[src*="gr-assets"], img[src*="goodreads"], img[src*="book"]');
  if (img) {
    let src = img.getAttribute('src') || '';
    return src.replace(/_S[XY]\d+_/g, '_SX100_');
  }
  const parent = el.parentElement;
  if (parent) {
    const siblingImg = parent.querySelector('img[src*="gr-assets"], img[src*="goodreads"]');
    if (siblingImg) {
      let src = siblingImg.getAttribute('src') || '';
      return src.replace(/_S[XY]\d+_/g, '_SX100_');
    }
  }
  return null;
}

function extractISBN13(el) {
  let found = null;
  const isbnEl = el.querySelector('.isbn13, [itemprop="isbn"], .isbn');
  if (isbnEl) {
    const match = isbnEl.textContent.match(/(\d{13})/);
    if (match) found = match[1];
  }
  
  if (!found) {
    const dataIsbn = el.getAttribute('data-isbn13') || el.getAttribute('data-isbn');
    if (dataIsbn && /^\d{13}$/.test(dataIsbn)) found = dataIsbn;
  }
  
  if (!found) {
    const fullText = el.textContent;
    const isbn13Match = fullText.match(/ISBN[\s-]*13[:\s]*(\d{13})/i);
    if (isbn13Match) found = isbn13Match[1];
    else {
      const genericMatch = fullText.match(/\b(97[89]\d{10})\b/);
      if (genericMatch) found = genericMatch[1];
    }
  }

  return found && isValidISBN13(found) ? found : null;
}

function extractEditionData(elementList, editionDataEl) {
  let title = '';
  let url = null;
  const titleEl = editionDataEl.querySelector('.editionTitle, .bookTitle, a[href*="/book/show/"]');
  if (titleEl) {
    title = titleEl.textContent.trim();
    url = titleEl.getAttribute('href');
  }
  if (!title) {
    const link = editionDataEl.querySelector('a');
    if (link) {
      title = link.textContent.trim();
      url = link.getAttribute('href');
    }
  }
  if (url && !url.startsWith('http')) url = 'https://www.goodreads.com' + url;

  const isbn13 = extractISBN13(editionDataEl);
  const cover = extractCoverUrl(elementList);
  
  let meta = '';
  const dataRows = editionDataEl.querySelectorAll(':scope > .dataRow, .editionDetails, .greyText');
  if (dataRows.length >= 2) {
    meta = dataRows[1].textContent.trim().replace(/\s+/g, ' ');
  } else if (dataRows.length === 1) {
    meta = dataRows[0].textContent.trim().replace(/\s+/g, ' ');
  }
  if (meta.length > 100) meta = meta.substring(0, 100) + '…';

  if (title || isbn13) {
    return { title: title || 'Edição sem título', isbn13, cover, meta, url };
  }
  return null;
}

function parseWithRegex(html) {
  const editions = [];
  const blockPattern = /<div class="elementList[\s\S]*?(?=<div class="elementList|$)/g;
  const blocks = [...html.matchAll(blockPattern)];

  for (const blockMatch of blocks) {
    const blockHtml = blockMatch[0];
    if (!/Edition language:\s*Portuguese/i.test(blockHtml)) continue;
    
    const bookPattern = /<a[^>]*href="(\/book\/show\/[^"]*)"[^>]*>([^<]+)<\/a>/;
    const match = blockHtml.match(bookPattern);
    if (!match) continue;

    let url = match[1];
    if (url && !url.startsWith('http')) url = 'https://www.goodreads.com' + url;
    const title = match[2].trim();
    if (!title || title.length < 2) continue;

    let isbn13 = null;
    const isbnMatch = blockHtml.match(/\b(97[89]\d{10})\b/);
    if (isbnMatch && isValidISBN13(isbnMatch[1])) isbn13 = isbnMatch[1];

    if (!editions.some(e => e.title === title)) {
      editions.push({ title, isbn13, meta: '', url });
    }
  }

  if (editions.length > 0) return editions;

  const bookPattern = /<a[^>]*href="(\/book\/show\/[^"]*)"[^>]*>([^<]+)<\/a>/g;
  const matches = [...html.matchAll(bookPattern)];
  for (const match of matches) {
    let url = match[1];
    if (url && !url.startsWith('http')) url = 'https://www.goodreads.com' + url;
    const title = match[2].trim();
    if (!title || title.length < 2) continue;

    const startPos = match.index + match[0].length;
    const searchWindow = html.substring(startPos, startPos + 500);
    let isbn13 = null;
    const isbnMatch = searchWindow.match(/\b(97[89]\d{10})\b/);
    if (isbnMatch && isValidISBN13(isbnMatch[1])) isbn13 = isbnMatch[1];

    if (!editions.some(e => e.title === title)) {
      editions.push({ title, isbn13, meta: '', url });
    }
  }
  return editions;
}

function parseEditions(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!hasPortugueseInLanguageDropdown(doc, html)) return [];

  const editions = [];
  const elementLists = doc.querySelectorAll('.elementList');

  if (elementLists.length > 0) {
    for (const el of elementLists) {
      const editionData = el.querySelector('.editionData');
      if (!editionData) continue;
      if (!isPortugueseEdition(editionData)) continue;
      
      const edition = extractEditionData(el, editionData);
      if (edition) editions.push(edition);
    }
  }

  if (editions.length === 0 && hasPortugueseInLanguageDropdown(doc, html)) {
    return parseWithRegex(html);
  }
  return editions;
}

function isValidISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, d, i) => acc + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
