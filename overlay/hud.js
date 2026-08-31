// Orchestrator for the overlay iframe. Proves the handshake with the content script, flips the status dot and applies the brightness dim layer on request.

(function () {
  const statusDot = document.getElementById("gr-status-dot");
  const brightnessOverlay = document.getElementById("brightness-overlay");

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "gestureread-content") return;

    if (data.type === "CONTENT_READY") {
      console.log("[GestureRead HUD] handshake received from content script");
      if (statusDot) statusDot.classList.add("on");

      window.parent.postMessage(
        { source: "gestureread-overlay", type: "OVERLAY_READY" },
        "*"
      );
      return;
    }

    if (data.type === "SET_BRIGHTNESS") {
      if (brightnessOverlay) {
        brightnessOverlay.style.setProperty("--gr-brightness-opacity", data.payload?.opacity ?? 0);
      }
      return;
    }
  });
})();