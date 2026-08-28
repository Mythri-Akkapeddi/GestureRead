// Injects the transparent overlay iframe into the page and handles the postMessage handshake with it. 
// Runs before content.js in manifest.json's content_scripts array so content.js can call window.GestureReadOverlay.init().
// In short, responsible for:
// 1. Creating the overlay iframe.
// 2. Loading the extension owned overlay page.
// 3. Keeping the iframe above the webpage.
// 4. Performing the content <-> overlay handshake.

// the MutationObserver that re-injects a removed overlay is now debounced and circuit-breakered, and remembers whether the engine was running so it can be restarted after a genuine reinjection (e.g. an SPA nuking and rebuilding <html> on route change).

(function () {
  const OVERLAY_ID = "gestureread-overlay-frame";
  const REINJECT_LIMIT = 5;
  const REINJECT_WINDOW_MS = 10000;

  let overlayFrame = null;
  let removalObserver = null;
  let engineRunning = false;
  let pendingEngineRestart = false;

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
    iframe.setAttribute("allow", "camera");
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
      { source: "gestureread-content", type: "CONTENT_READY" },
      "*"
    );
  }

  function watchForRemoval() {
    if (removalObserver) {
      return;
    }

    let reinjectCount = 0;
    let windowStart = Date.now();

    const handleRemoval = debounce(() => {
      const current = document.getElementById(OVERLAY_ID);
      if (current) return; // false alarm — still there

      const now = Date.now();
      if (now - windowStart > REINJECT_WINDOW_MS) {
        windowStart = now;
        reinjectCount = 0;
      }
      reinjectCount++;

      if (reinjectCount > REINJECT_LIMIT) {
        console.warn(
          `[GestureRead] overlay removed ${reinjectCount}x in ${REINJECT_WINDOW_MS}ms — this page ` +
          `is likely thrashing the DOM (heavy SPA). Skipping auto-reinject this cycle to avoid ` +
          `repeatedly restarting the camera.`
        );
        return;
      }

      console.warn("[GestureRead] overlay was removed. Re-injecting.", { reinjectCount });
      pendingEngineRestart = engineRunning;
      engineRunning = false;
      overlayFrame = null;
      initOverlay();
    }, 300);

    removalObserver = new MutationObserver(handleRemoval);
    removalObserver.observe(document.documentElement, { childList: true });
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
      console.log("[GestureRead] overlay acknowledged handshake");
      if (pendingEngineRestart) {
        pendingEngineRestart = false;
        console.log("[GestureRead] restarting engine after overlay reinjection");
        startEngine();
      }
      return;
    }

    if (data.type === "LANDMARKS_FRAME") {
      window.dispatchEvent(new CustomEvent("gestureread:landmarks", { detail: data.payload }));
      return;
    }
  });

  function startEngine() {
    if (!overlayFrame || !overlayFrame.contentWindow) {
      console.warn("[GestureRead] cannot start engine: overlay not ready");
      return;
    }
    engineRunning = true;
    overlayFrame.contentWindow.postMessage(
      { source: "gestureread-content", type: "START_ENGINE" },
      "*"
    );
  }

  function stopEngine() {
    if (!overlayFrame || !overlayFrame.contentWindow) {
      return;
    }
    engineRunning = false;
    overlayFrame.contentWindow.postMessage(
      { source: "gestureread-content", type: "STOP_ENGINE" },
      "*"
    );
  }

  window.GestureReadOverlay = {
    init: initOverlay,
    ping: pingOverlay,
    startEngine,
    stopEngine
  };
})();