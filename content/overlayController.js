// content/overlayController.js
// Injects the transparent overlay iframe into the page and handles the postMessage handshake with it. 
// Runs before content.js in manifest.json's content_scripts array so content.js can call window.GestureReadOverlay.init().
// In short, responsible for:
// 1. Creating the overlay iframe.
// 2. Loading the extension owned overlay page.
// 3. Keeping the iframe above the webpage.
// 4. Performing the content <-> overlay handshake.

(function () {
  const OVERLAY_ID = "gestureread-overlay-frame";
  let overlayFrame = null;
  let removalObserver = null;

  function initOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      overlayFrame = existing;
      return overlayFrame;
    }

    const iframe = document.createElement("iframe");
    iframe.id = OVERLAY_ID;
    iframe.src = chrome.runtime.getURL("overlay/overlay.html");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100%",
      "height: 100%",
      "border: none",
      "pointer-events: none",
      "z-index: 2147483647",
      "background: transparent",
      "color-scheme: light"
    ].join("; ") + ";";

    const parent = document.documentElement || document.body;
    if (!parent) {
      console.warn("[GestureRead] could not find document root for overlay");
      return null;
    }
    parent.appendChild(iframe);
    overlayFrame = iframe;

    iframe.addEventListener("load", () => {
      console.log("[GestureRead] overlay iframe loaded");
      pingOverlay();
    });

    watchForRemoval();
    return iframe;
  }

  function pingOverlay() {
    if (!overlayFrame || !overlayFrame.contentWindow) {
      return;
    }
    overlayFrame.contentWindow.postMessage(
      {
        source: "gestureread-content",
        type: "CONTENT_READY"
      },
      "*"
    );
  }

  function watchForRemoval() {
    if (removalObserver) {
      return;
    }
    removalObserver = new MutationObserver(() => {
      const current = document.getElementById(OVERLAY_ID);
      if (!current && document.documentElement) {
        console.warn(
          "[GestureRead] overlay was removed. Re-injecting."
        );
        overlayFrame = null;
        initOverlay();
      }
    });
    removalObserver.observe(document.documentElement, {
      childList: true
    });
  }

  window.addEventListener("message", (event) => {
    if (!overlayFrame) {
      return;
    }
    if (event.source !== overlayFrame.contentWindow) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== "gestureread-overlay") {
      return;
    }
    if (data.type === "OVERLAY_READY") {
      console.log(
        "[GestureRead] overlay acknowledged handshake"
      );
    }
  });
  
  window.GestureReadOverlay = {
    init: initOverlay,
    ping: pingOverlay
  };
})();