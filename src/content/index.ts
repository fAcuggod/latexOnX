import { installCopyHandler, restoreAllMath } from "./domProcessor.js";
import { createTimelineObserver } from "./observer.js";

const STORAGE_KEY_ENABLED = "enabled";

const observer = createTimelineObserver();
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
 * Punto de entrada del content script en https://x.com y https://twitter.com.
 * Lee el estado guardado en `chrome.storage.sync` y reacciona al instante
 * cuando el usuario activa o pausa la extensión desde el popup.
 */
function bootstrap(): void {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    chrome.storage.sync.get({ [STORAGE_KEY_ENABLED]: true }, (items) => {
      const enabled = Boolean(items[STORAGE_KEY_ENABLED]);
      if (enabled) {
        enableExtension();
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !(STORAGE_KEY_ENABLED in changes)) return;

      const enabled = Boolean(changes[STORAGE_KEY_ENABLED].newValue);
      if (enabled) {
        enableExtension();
      } else {
        disableExtension();
      }
    });
  } else {
    enableExtension();
  }
}

bootstrap();
