// Runs in the content script's isolated world.
// Receives wrist position/velocity variance from the overlay (overlay/smoothing.js) via overlayController.js's "gestureread:variance" relay — a postMessage/event bridge rather than a direct function call because smoothing.js runs inside the overlay iframe's world, not this one.
// Right now it just confirms the numbers arrive and visibly climb under deliberate shaking.
// Baseline capture + scoring later

(function () {
  function handleVarianceFrame(event) {
    const { positionVariance, velocityVariance } = event.detail || {};
    if (typeof positionVariance !== "number" || typeof velocityVariance !== "number") return;

    console.log(
      `[GestureRead] variance — position: ${positionVariance.toFixed(6)}, velocity: ${velocityVariance.toFixed(6)}`
    );
  }

  window.addEventListener("gestureread:variance", handleVarianceFrame);
})();