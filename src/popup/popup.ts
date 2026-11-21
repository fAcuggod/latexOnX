const STORAGE_KEY_ENABLED = "enabled";

const toggleInput = document.getElementById(
  "toggle-enabled"
) as HTMLInputElement | null;
const statusText = document.getElementById("status-text");

function updateStatusUI(enabled: boolean): void {
  if (toggleInput) {
    toggleInput.checked = enabled;
  }
  if (statusText) {
    statusText.textContent = enabled ? "Activo en x.com" : "Pausado";
    statusText.classList.toggle("paused", !enabled);
  }
}

if (typeof chrome !== "undefined" && chrome.storage?.sync) {
  chrome.storage.sync.get({ [STORAGE_KEY_ENABLED]: true }, (items) => {
    updateStatusUI(Boolean(items[STORAGE_KEY_ENABLED]));
  });

  toggleInput?.addEventListener("change", () => {
    const enabled = toggleInput.checked;
    updateStatusUI(enabled);
    chrome.storage.sync.set({ [STORAGE_KEY_ENABLED]: enabled });
  });
}
