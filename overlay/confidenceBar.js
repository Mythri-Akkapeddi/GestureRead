// Runs inside the overlay iframe. Shows how stable the current pose classification is, driven by gestureEngine.js's confidenceFromStreak(), relayed through overlayController.js.
(function () {
  function colorFor(value) {
    if (value < 0.34) return "#ef4444";
    if (value < 0.67) return "#facc15";
    return "#22c55e";
  }

  function setValue(value, poseLabel) {
    const fill = document.getElementById("gr-confidence-fill");
    const label = document.getElementById("gr-confidence-label");
    if (!fill) return;
    const pct = Math.max(0, Math.min(1, value)) * 100;
    fill.style.width = `${pct}%`;
    fill.style.background = colorFor(value);
    if (label) label.textContent = poseLabel && value > 0 ? capitalize(poseLabel) : "";
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.GestureReadConfidenceBar = { setValue };
})();