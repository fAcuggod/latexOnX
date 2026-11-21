import {
  detectDefaultLocale,
  getMessages,
  normalizeLocale,
  type Locale,
} from "../i18n/messages.js";

const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_LOCALE = "locale";

const toggleInput = document.getElementById(
  "toggle-enabled"
) as HTMLInputElement | null;
const subtitleEl = document.getElementById("subtitle");
const toggleLabelEl = document.getElementById("toggle-label");
const statusTextEl = document.getElementById("status-text");
const syntaxTitleEl = document.getElementById("syntax-title");
const modeInlineEl = document.getElementById("mode-inline");
const modeDisplay1El = document.getElementById("mode-display-1");
const modeDisplay2El = document.getElementById("mode-display-2");
const hintTextEl = document.getElementById("hint-text");
const languageLabelEl = document.getElementById("language-label");
const langButtons = document.querySelectorAll<HTMLButtonElement>(".lang-btn");

let currentEnabled = true;
let currentLocale: Locale = detectDefaultLocale();

function applyTranslations(locale: Locale): void {
  currentLocale = locale;
  const msg = getMessages(locale);

  document.documentElement.lang = locale;
  if (subtitleEl) subtitleEl.textContent = msg.subtitle;
  if (toggleLabelEl) toggleLabelEl.textContent = msg.toggleLabel;
  if (syntaxTitleEl) syntaxTitleEl.textContent = msg.syntaxTitle;
  if (modeInlineEl) modeInlineEl.textContent = msg.modeInline;
  if (modeDisplay1El) modeDisplay1El.textContent = msg.modeDisplay;
  if (modeDisplay2El) modeDisplay2El.textContent = msg.modeDisplay;
  if (hintTextEl) hintTextEl.textContent = msg.hint;
  if (languageLabelEl) languageLabelEl.textContent = msg.languageLabel;

  langButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.locale === locale);
  });

  updateStatusUI(currentEnabled);
}

function updateStatusUI(enabled: boolean): void {
  currentEnabled = enabled;
  const msg = getMessages(currentLocale);

  if (toggleInput) {
    toggleInput.checked = enabled;
  }
  if (statusTextEl) {
    statusTextEl.textContent = enabled ? msg.statusActive : msg.statusPaused;
    statusTextEl.classList.toggle("paused", !enabled);
  }
}

langButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const nextLocale = normalizeLocale(btn.dataset.locale);
    applyTranslations(nextLocale);
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      chrome.storage.sync.set({ [STORAGE_KEY_LOCALE]: nextLocale });
    }
  });
});

toggleInput?.addEventListener("change", () => {
  const enabled = toggleInput.checked;
  updateStatusUI(enabled);
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.set({ [STORAGE_KEY_ENABLED]: enabled });
  }
});

if (typeof chrome !== "undefined" && chrome.storage?.sync) {
  chrome.storage.sync.get(
    { [STORAGE_KEY_ENABLED]: true, [STORAGE_KEY_LOCALE]: null },
    (items) => {
      currentEnabled = Boolean(items[STORAGE_KEY_ENABLED]);
      const locale = normalizeLocale(items[STORAGE_KEY_LOCALE]);
      applyTranslations(locale);
    }
  );
} else {
  applyTranslations(currentLocale);
}
