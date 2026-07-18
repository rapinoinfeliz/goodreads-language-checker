'use strict';

const languageSelect = document.getElementById('language-select');
const clearCacheButton = document.getElementById('clear-cache');
let feedbackTimer = null;

function setTemporaryButtonText(text) {
  clearTimeout(feedbackTimer);
  clearCacheButton.textContent = text;
  feedbackTimer = setTimeout(() => {
    clearCacheButton.textContent = 'Clear cache';
  }, 1600);
}

async function initializePopup() {
  for (const language of GRPT.Settings.LANGUAGES) {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = `${language.flag}  ${language.label}`;
    languageSelect.appendChild(option);
  }

  const currentLanguage = await GRPT.Settings.getLanguage();
  languageSelect.value = currentLanguage.code;
  languageSelect.disabled = false;
}

languageSelect.addEventListener('change', async () => {
  languageSelect.disabled = true;
  try {
    const language = await GRPT.Settings.setLanguage(languageSelect.value);
    languageSelect.value = language.code;
  } catch (error) {
    console.error('[Goodreads Edition Checker] Failed to save language:', error);
    const currentLanguage = await GRPT.Settings.getLanguage();
    languageSelect.value = currentLanguage.code;
  } finally {
    languageSelect.disabled = false;
  }
});

clearCacheButton.addEventListener('click', async () => {
  clearCacheButton.disabled = true;
  try {
    await GRPT.Cache.clear();
    setTemporaryButtonText('Cache cleared');
  } catch (error) {
    console.error('[Goodreads Edition Checker] Failed to clear cache:', error);
    setTemporaryButtonText('Could not clear cache');
  } finally {
    clearCacheButton.disabled = false;
  }
});

initializePopup().catch((error) => {
  console.error('[Goodreads Edition Checker] Failed to initialize popup:', error);
  languageSelect.disabled = true;
});
