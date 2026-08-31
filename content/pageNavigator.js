// Runs in the content script's isolated world.
// Owns all "act on the page" gesture outputs that aren't scrolling (zoom now, more later). 
// gestureEngine.js decides WHEN to zoom, this decides HOW.
// Loaded before gestureEngine.js by manifest.json so window.GestureReadPageNavigator exists by the time a gesture needs it.

(function () {
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.5;
  const DEFAULT_ZOOM = 1.0;

  let currentZoom = DEFAULT_ZOOM;

  function applyZoom(zoom) {
    currentZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    // CSS `zoom` (not transform: scale) — non-standard but Chrome supports it fine and unlike transform it actually reflows text
    document.body.style.zoom = currentZoom;
  }

  function zoomBy(factor) {
    applyZoom(currentZoom * factor);
  }

  function resetZoom() {
    applyZoom(DEFAULT_ZOOM);
  }

  function getZoom() {
    return currentZoom;
  }

  window.GestureReadPageNavigator = { zoomBy, resetZoom, getZoom, applyZoom };
})();