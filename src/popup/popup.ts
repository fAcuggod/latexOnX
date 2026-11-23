import {
  detectDefaultLocale,
  getMessages,
  normalizeLocale,
  type Locale,
} from "../i18n/messages.js";

const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_CHEMISTRY = "enableChemistry";
const STORAGE_KEY_BARE_BUTTON = "enableBareLatexButton";
const STORAGE_KEY_COMPOSER_PREVIEW = "enableComposerPreview";
const STORAGE_KEY_LOCALE = "locale";

const toggleInput = document.getElementById(
  "toggle-enabled"
) as HTMLInputElement | null;
const chemistryInput = document.getElementById(
  "toggle-chemistry"
) as HTMLInputElement | null;
const bareButtonInput = document.getElementById(
  "toggle-bare-button"
) as HTMLInputElement | null;
const composerPreviewInput = document.getElementById(
  "toggle-composer-preview"
) as HTMLInputElement | null;

const subtitleEl = document.getElementById("subtitle");
const toggleLabelEl = document.getElementById("toggle-label");
const statusTextEl = document.getElementById("status-text");
const optionsTitleEl = document.getElementById("options-title");
const chemistryLabelEl = document.getElementById("chemistry-label");
const bareLatexLabelEl = document.getElementById("bare-latex-label");
const composerPreviewLabelEl = document.getElementById("composer-preview-label");
const syntaxTitleEl = document.getElementById("syntax-title");
const modeInlineEl = document.getElementById("mode-inline");
const modeDisplay1El = document.getElementById("mode-display-1");
const modeDisplay2El = document.getElementById("mode-display-2");
const modeChemistryEl = document.getElementById("mode-chemistry");
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
  if (optionsTitleEl) optionsTitleEl.textContent = msg.optionsTitle;
  if (chemistryLabelEl) chemistryLabelEl.textContent = msg.chemistryLabel;
  if (bareLatexLabelEl) bareLatexLabelEl.textContent = msg.bareLatexLabel;
  if (composerPreviewLabelEl) {
    composerPreviewLabelEl.textContent = msg.composerPreviewLabel;
  }
  if (syntaxTitleEl) syntaxTitleEl.textContent = msg.syntaxTitle;
  if (modeInlineEl) modeInlineEl.textContent = msg.modeInline;
  if (modeDisplay1El) modeDisplay1El.textContent = msg.modeDisplay;
  if (modeDisplay2El) modeDisplay2El.textContent = msg.modeDisplay;
  if (modeChemistryEl) modeChemistryEl.textContent = msg.modeChemistry;
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

chemistryInput?.addEventListener("change", () => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.set({ [STORAGE_KEY_CHEMISTRY]: chemistryInput.checked });
  }
});

bareButtonInput?.addEventListener("change", () => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.set({
      [STORAGE_KEY_BARE_BUTTON]: bareButtonInput.checked,
    });
  }
});

composerPreviewInput?.addEventListener("change", () => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.set({
      [STORAGE_KEY_COMPOSER_PREVIEW]: composerPreviewInput.checked,
    });
  }
});

if (typeof chrome !== "undefined" && chrome.storage?.sync) {
  chrome.storage.sync.get(
    {
      [STORAGE_KEY_ENABLED]: true,
      [STORAGE_KEY_CHEMISTRY]: true,
      [STORAGE_KEY_BARE_BUTTON]: true,
      [STORAGE_KEY_COMPOSER_PREVIEW]: true,
      [STORAGE_KEY_LOCALE]: null,
    },
    (items) => {
      currentEnabled = Boolean(items[STORAGE_KEY_ENABLED]);
      if (chemistryInput) {
        chemistryInput.checked = Boolean(items[STORAGE_KEY_CHEMISTRY]);
      }
      if (bareButtonInput) {
        bareButtonInput.checked = Boolean(items[STORAGE_KEY_BARE_BUTTON]);
      }
      if (composerPreviewInput) {
        composerPreviewInput.checked = Boolean(
          items[STORAGE_KEY_COMPOSER_PREVIEW]
        );
      }
      const locale = normalizeLocale(items[STORAGE_KEY_LOCALE]);
      applyTranslations(locale);
    }
  );
} else {
  applyTranslations(currentLocale);
}
