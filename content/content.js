// Entry point for the content script, injected into webpages by manifest.json.
// Initialises everything in order and is the only file that talks to background.js directly from the page context.
// Nothing heavy here, it's a conductor.

(function initGestureRead() {
  console.log("GestureRead active on: " + window.location.href);
  init();

  function init() {
    window.GestureReadOverlay?.init();
    notifyBackgroundReady();
    listenForBackgroundMessages();
    listenForToggleGesture();
    loadExtensionState();
  }

  function notifyBackgroundReady() {
    chrome.runtime.sendMessage(
      { type: "CONTENT_SCRIPT_READY", payload: { url: window.location.href } },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[GestureRead] could not reach background:", chrome.runtime.lastError.message);
          return;
        }
        console.log("[GestureRead] background acknowledged content script:", response);
      }
    );
  }

  function listenForBackgroundMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("[GestureRead] content script received message:", message);

      switch (message.type) {
        case "TOGGLE_EXTENSION":
          // Placeholder, real on/off logic will be implemented once the gesture engine exists.
          console.log("[GestureRead] toggle requested:", message.payload);
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: `content.js: unhandled message type ${message.type}` });
      }
      return true;
    });
  }

  // The engine's `window.GestureReadGestureEngine` assignment happens after an `await import(...)` inside its own IIFE, so it may not exist yet the instant this script runs. 
  // Retry briefly instead of assuming it's ready.
  function withGestureEngine(callback, attemptsLeft = 20) {
    if (window.GestureReadGestureEngine) {
      callback(window.GestureReadGestureEngine);
      return;
    }
    if (attemptsLeft <= 0) {
      console.warn("[GestureRead] gesture engine never became available.");
      return;
    }
    setTimeout(() => withGestureEngine(callback, attemptsLeft - 1), 50);
  }

  function loadExtensionState() {
    chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[GestureRead] could not load extension state:", chrome.runtime.lastError.message);
        return;
      }
      const extensionEnabled = response?.data ?? true;
      withGestureEngine((engine) => {
        extensionEnabled ? engine.enable() : engine.disable();
      });
      window.GestureReadOverlay?.setEnabledVisual(extensionEnabled);
    });
  }

  function persistExtensionState(enabled) {
    chrome.runtime.sendMessage({ type: "SAVE_EXTENSION_STATE", payload: enabled }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[GestureRead] could not persist extension state:", chrome.runtime.lastError.message);
      }
    });
  }

  function listenForToggleGesture() {
    window.addEventListener("gestureread:toggle", (event) => {
      const enabled = event.detail.enabled;
      console.log("[GestureRead] extension toggled via gesture:", enabled ? "ON" : "OFF");
      persistExtensionState(enabled);
    });
  }
})();