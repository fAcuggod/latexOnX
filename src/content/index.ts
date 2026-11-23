import {
  detectDefaultLocale,
  normalizeLocale,
  type Locale,
} from "../i18n/messages.js";
import {
  installInteractionHandlers,
  processAllTweets,
  removeBareLatexBars,
  restoreAllMath,
  updateRenderedLabels,
  type ProcessOptions,
} from "./domProcessor.js";
import { createTimelineObserver } from "./observer.js";

const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_CHEMISTRY = "enableChemistry";
const STORAGE_KEY_BARE_BUTTON = "enableBareLatexButton";
const STORAGE_KEY_LOCALE = "locale";

let currentEnabled = true;
let currentChemistry = true;
let currentBareButton = true;
let currentLocale: Locale = detectDefaultLocale();

function getProcessOptions(): ProcessOptions {
  return {
    locale: currentLocale,
    enableChemistry: currentChemistry,
    enableBareLatexButton: currentBareButton,
  };
}

const observer = createTimelineObserver((scope) =>
  processAllTweets(scope, getProcessOptions())
);
let uninstallHandlers: (() => void) | null = null;

function enableExtension(): void {
  if (!uninstallHandlers) {
    uninstallHandlers = installInteractionHandlers(document, getProcessOptions);
  }
  if (document.body) {
    observer.start(document.body);
  } else {
    window.addEventListener(
      "DOMContentLoaded",
      () => observer.start(document.body),
      { once: true }
    );
  }
}

function disableExtension(): void {
  observer.stop();
  if (uninstallHandlers) {
    uninstallHandlers();
    uninstallHandlers = null;
  }
  restoreAllMath(document);
  removeBareLatexBars(document);
}

function reprocessPage(): void {
  if (!currentEnabled) return;
  restoreAllMath(document);
  removeBareLatexBars(document);
  processAllTweets(document, getProcessOptions());
}

/**
 * Content script entry point on https://x.com and https://twitter.com.
 * Syncs On/Off state, chemistry support, bare-LaTeX opt-in button, and UI language
 * live from `chrome.storage.sync`.
 */
function bootstrap(): void {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.get(
      {
        [STORAGE_KEY_ENABLED]: true,
        [STORAGE_KEY_CHEMISTRY]: true,
        [STORAGE_KEY_BARE_BUTTON]: true,
        [STORAGE_KEY_LOCALE]: null,
      },
      (items) => {
        currentEnabled = Boolean(items[STORAGE_KEY_ENABLED]);
        currentChemistry = Boolean(items[STORAGE_KEY_CHEMISTRY]);
        currentBareButton = Boolean(items[STORAGE_KEY_BARE_BUTTON]);
        currentLocale = normalizeLocale(items[STORAGE_KEY_LOCALE]);

        if (currentEnabled) {
          enableExtension();
        }
      }
    );

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;

      if (STORAGE_KEY_LOCALE in changes) {
        currentLocale = normalizeLocale(changes[STORAGE_KEY_LOCALE].newValue);
        updateRenderedLabels(currentLocale, document);
      }

      if (STORAGE_KEY_ENABLED in changes) {
        currentEnabled = Boolean(changes[STORAGE_KEY_ENABLED].newValue);
        if (currentEnabled) {
          enableExtension();
        } else {
          disableExtension();
        }
        return;
      }

      if (STORAGE_KEY_CHEMISTRY in changes) {
        currentChemistry = Boolean(changes[STORAGE_KEY_CHEMISTRY].newValue);
        reprocessPage();
      }

      if (STORAGE_KEY_BARE_BUTTON in changes) {
        currentBareButton = Boolean(changes[STORAGE_KEY_BARE_BUTTON].newValue);
        if (!currentBareButton) {
          restoreAllMath(document, "bare");
          removeBareLatexBars(document);
        } else if (currentEnabled) {
          processAllTweets(document, getProcessOptions());
        }
      }
    });
  } else {
    enableExtension();
  }
}

bootstrap();
