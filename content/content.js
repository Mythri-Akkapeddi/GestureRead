// content/content.js
// Entry point for the content script, injected into webpages by manifest.json.
// Initialises everything in order and is the only file that talks to background.js directly from the page context. 
// Nothing heavy here, it's a conductor.

// Future initialization will happen here in this order:
// 1. Load calibration profile from storage (via background.js)
// 2. Inject overlay
// 3. Start webcam
// 4. Start MediaPipe
// 5. Begin gesture loop

(function initGestureRead() {
  console.log("GestureRead active on: " + window.location.href);
  init();

  function init() {
    window.GestureReadOverlay?.init();
    notifyBackgroundReady();
    listenForBackgroundMessages();
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
})();