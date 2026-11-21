import {
  detectDefaultLocale,
  normalizeLocale,
  type Locale,
} from "../i18n/messages.js";
import {
  installCopyHandler,
  processAllTweets,
  restoreAllMath,
  updateRenderedLabels,
} from "./domProcessor.js";
import { createTimelineObserver } from "./observer.js";

const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_LOCALE = "locale";

let currentLocale: Locale = detectDefaultLocale();

const observer = createTimelineObserver((scope) =>
  processAllTweets(scope, currentLocale)
);
let uninstallCopyHandler: (() => void) | null = null;

function enableExtension(): void {
  if (!uninstallCopyHandler) {
    uninstallCopyHandler = installCopyHandler(document);
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
  if (uninstallCopyHandler) {
    uninstallCopyHandler();
    uninstallCopyHandler = null;
  }
  restoreAllMath(document);
}

/**
 * Content script entry point on https://x.com and https://twitter.com.
 * Syncs both On/Off state and UI language from `chrome.storage.sync` in real time.
 */
function bootstrap(): void {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.get(
      { [STORAGE_KEY_ENABLED]: true, [STORAGE_KEY_LOCALE]: null },
      (items) => {
        currentLocale = normalizeLocale(items[STORAGE_KEY_LOCALE]);
        const enabled = Boolean(items[STORAGE_KEY_ENABLED]);
        if (enabled) {
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
        const enabled = Boolean(changes[STORAGE_KEY_ENABLED].newValue);
        if (enabled) {
          enableExtension();
        } else {
          disableExtension();
        }
      }
    });
  } else {
    enableExtension();
  }
}

bootstrap();
