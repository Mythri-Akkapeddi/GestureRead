// Runs in the content script's isolated world.
// Owns all "act on the page" gesture outputs that aren't scrolling (zoom now, more later). 
// gestureEngine.js decides WHEN to zoom, this decides HOW.
// Loaded before gestureEngine.js by manifest.json so window.GestureReadPageNavigator exists by the time a gesture needs it.

(function () {
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.5;
  const DEFAULT_ZOOM = 1.0;

  const MIN_BRIGHTNESS = 0.3; // never let the page go fully black
  const MAX_BRIGHTNESS = 1.0; // 1.0 = no dimming at all (this is a dim-only overlay, can't exceed natural brightness)
  const DEFAULT_BRIGHTNESS = 1.0;

  let currentZoom = DEFAULT_ZOOM;
  let currentBrightness = DEFAULT_BRIGHTNESS;

  function applyZoom(zoom) {
    currentZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    // CSS `zoom` (not transform: scale), non-standard but Chrome supports it fine and unlike transform it actually reflows text
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

  // Brightness lives as a dim layer inside the overlay iframe (not on the page itself) so it always renders above the page regardless of what the page's own CSS/JS does. 
  // Since the iframe is cross-origin from here, we can't touch its DOM directly, relay through GestureReadOverlay instead.
  function applyBrightness(level) {
    currentBrightness = clamp(level, MIN_BRIGHTNESS, MAX_BRIGHTNESS);
    const dimOpacity = 1 - currentBrightness;
    window.GestureReadOverlay?.setBrightness(dimOpacity);
  }

  function brightnessBy(delta) {
    applyBrightness(currentBrightness + delta);
  }

  function resetBrightness() {
    applyBrightness(DEFAULT_BRIGHTNESS);
  }

  function getBrightness() {
    return currentBrightness;
  }

  window.GestureReadPageNavigator = {
    zoomBy,
    resetZoom,
    getZoom,
    applyZoom,
    brightnessBy,
    resetBrightness,
    getBrightness,
  };
})();