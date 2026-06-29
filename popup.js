/**
 * Goodreads PT Edition Checker — popup.js
 *
 * Fluxo:
 * 1. Verifica se a aba ativa é uma página de livro no Goodreads
 * 2. Injeta um script na página para extrair o work_id
 * 3. Faz fetch da página de edições filtrada por português
 * 4. Parseia o HTML para extrair título e ISBN-13 de cada edição
 * 5. Exibe os resultados no popup
 */

// ── Helpers de UI ──────────────────────────────────────────────

/** Mostra apenas o estado com o ID fornecido, escondendo os demais. */
function showState(stateId) {
  const states = document.querySelectorAll('.state');
  for (const state of states) {
    state.classList.add('hidden');
  }
  document.getElementById(stateId).classList.remove('hidden');
}

/** Exibe uma mensagem de erro no popup. */
function showError(message) {
  document.getElementById('error-message').textContent = message;
  showState('error');
}

// ── Extração do work_id ────────────────────────────────────────

// As funções de parsing de edições foram movidas para shared.js

// ── Renderização ───────────────────────────────────────────────

/**
 * Renderiza a lista de edições encontradas no popup.
 */
function renderEditions(editions) {
  const count = editions.length;
  document.getElementById('results-count').textContent =
    `🇧🇷 ${count} ${count !== 1 ? 'edições em português encontradas' : 'edição em português encontrada'}`;

  const list = document.getElementById('editions-list');
  list.innerHTML = '';

  for (const edition of editions) {
    const li = document.createElement('li');
    li.className = 'edition-item';

    const info = document.createElement('div');
    info.className = 'edition-info';

    const titleP = document.createElement('p');
    titleP.className = 'edition-title';
    if (edition.url) {
      const link = document.createElement('a');
      link.href = edition.url;
      link.target = '_blank';
      link.textContent = edition.title;
      // Corrigindo estilo de link nativo
      link.style.color = 'inherit';
      link.style.textDecoration = 'none';
      link.addEventListener('mouseenter', () => link.style.textDecoration = 'underline');
      link.addEventListener('mouseleave', () => link.style.textDecoration = 'none');
      titleP.appendChild(link);
    } else {
      titleP.textContent = edition.title;
    }
    info.appendChild(titleP);

    if (edition.isbn13) {
      const isbnP = document.createElement('p');
      isbnP.className = 'edition-isbn';
      isbnP.textContent = `ISBN-13: ${edition.isbn13}`;
      info.appendChild(isbnP);
    }

    if (edition.meta) {
      const metaP = document.createElement('p');
      metaP.className = 'edition-meta';
      metaP.textContent = edition.meta;
      info.appendChild(metaP);
    }

    li.appendChild(info);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edition-actions';
    actionsDiv.style.display = 'flex';
    actionsDiv.style.flexDirection = 'column';
    actionsDiv.style.gap = '6px';
    actionsDiv.style.alignItems = 'center';
    actionsDiv.style.justifyContent = 'center';

    if (edition.isbn13) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = '📋 Copiar ISBN';
      // Usar addEventListener (não inline handler) — CSP compliance
      copyBtn.addEventListener('click', () => copyISBN(copyBtn, edition.isbn13));
      actionsDiv.appendChild(copyBtn);
    } else {
      const noIsbn = document.createElement('span');
      noIsbn.className = 'no-isbn';
      noIsbn.textContent = 'sem ISBN';
      actionsDiv.appendChild(noIsbn);
    }

    const tgBtn = document.createElement('button');
    tgBtn.className = 'copy-btn'; // Reaproveitando estilo visual
    tgBtn.innerHTML = '✈️ Telegram';
    tgBtn.title = 'Copiar título e buscar no Telegram';
    tgBtn.addEventListener('click', async () => {
      // Remover informações entre parênteses no final do título (ex: "(Edição Kindle)")
      const cleanTitle = edition.title.replace(/\s*\(.*?\)\s*$/, '').trim();
      await navigator.clipboard.writeText(cleanTitle);
      tgBtn.textContent = 'Copiado!';
      setTimeout(() => { tgBtn.innerHTML = '✈️ Telegram'; }, 2000);
      window.open(TELEGRAM_URL, '_blank');
    });
    actionsDiv.appendChild(tgBtn);

    li.appendChild(actionsDiv);

    list.appendChild(li);
  }

  showState('results');
}

/**
 * Copia o ISBN para a área de transferência e dá feedback visual.
 */
async function copyISBN(button, isbn) {
  try {
    await navigator.clipboard.writeText(isbn);
    const originalText = button.textContent;
    button.textContent = '✓ Copiado!';
    button.classList.add('copied');

    // Restaurar após 2 segundos
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Clipboard write failed:', err);
  }
}

// ── Fluxo principal ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Obter a aba ativa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 2. Verificar se estamos numa página de livro do Goodreads
    if (!tab.url || !tab.url.match(/^https:\/\/(www\.)?goodreads\.com\/book\/show\//)) {
      showState('not-goodreads');
      return;
    }

    // 3. Injetar script para extrair o work_id da página
    // Usamos chrome.scripting.executeScript que roda no contexto da página
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => extractWorkIdFromHTML(document.body.innerHTML)
    });

    const workId = results?.[0]?.result;

    if (!workId) {
      showError('Não foi possível encontrar o work_id desta página. Tente recarregar a página.');
      return;
    }

    // 4. Montar a URL de edições filtrada por português
    const editionsUrl = `https://www.goodreads.com/work/editions/${workId}?utf8=%E2%9C%93&sort=num_ratings&filter_by_format=&filter_by_language=por`;

    // Mostrar link para a página de edições no footer
    const editionsLink = document.getElementById('editions-link');
    editionsLink.href = editionsUrl;
    editionsLink.classList.remove('hidden');

    // 5. Fazer fetch da página de edições em português
    // Isto funciona graças ao host_permissions no manifest
    // NOTA: O Goodreads pode requerer cookie de sessão para algumas páginas.
    // O fetch herda os cookies do browser automaticamente, então se o usuário
    // estiver logado no Goodreads, o request incluirá o cookie de sessão.
    const response = await fetch(editionsUrl, {
      credentials: 'include', // Envia cookies do Goodreads
      headers: {
        'Accept': 'text/html',
        // Simular request de browser para evitar bloqueio
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Goodreads retornou status ${response.status}. Tente novamente.`);
    }

    const html = await response.text();

    // 6. Parsear o HTML para extrair edições
    const editions = parseEditions(html);

    // 7. Exibir resultados
    if (editions.length === 0) {
      showState('no-results');
    } else {
      renderEditions(editions);
    }

  } catch (err) {
    console.error('Goodreads PT Checker error:', err);

    // Mensagens de erro amigáveis
    if (err.message.includes('Cannot access')) {
      showError('Sem permissão para acessar esta página. Verifique se é uma página do Goodreads.');
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      showError('Erro de rede. Verifique sua conexão e tente novamente.');
    } else {
      showError(err.message || 'Erro desconhecido. Tente novamente.');
    }
  }
});
