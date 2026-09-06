// Orchestrator for the overlay iframe. Proves the handshake with the content script, flips the status dot and applies the brightness dim layer on request and shows the pose label.
(function () {
  const statusDot = document.getElementById("gr-status-dot");
  const brightnessOverlay = document.getElementById("brightness-overlay");
  const poseLabel = document.getElementById("gr-pose-label");
  const panel = document.getElementById("gr-hud-panel");

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

    if (data.type === "POINT_STATUS") {
      if (poseLabel) {
        poseLabel.textContent = data.payload?.active ? "Point detected" : "";
      }
      return;
    }

    if (data.type === "SET_ENABLED_VISUAL") {
      const enabled = data.payload?.enabled ?? true;
      if (statusDot) statusDot.classList.toggle("on", enabled);
      if (panel) panel.classList.toggle("gr-disabled", !enabled);
      window.GestureReadSkeleton?.setVisible(enabled);
      return;
    }
  });
})();