// Has the <canvas> that the hand skeleton is drawn on.
// Runs in the overlay iframe's world, engine.js calls draw()/clear() on this directly since they share the same JS realm.
// Uses MediaPipe's own DrawingUtils (drawConnectors/drawLandmarks) so don't have to draw the hand-roll the connection topology.

(function () {
  const CANVAS_ID = "gr-skeleton-canvas";
  const VISION_BUNDLE_PATH = "assets/mediapipe/vision_bundle.mjs";

  let canvas = null;
  let ctx = null;
  let drawingUtils = null;
  let HAND_CONNECTIONS = null;
  let ready = false;
  let visible = true; // hidden while the extension is toggled off, drawing loop keeps running elsewhere

  function initCanvas() {
    canvas = document.getElementById(CANVAS_ID);
    if (!canvas) {
      console.warn("[GestureRead] skeleton canvas element not found in overlay.html");
      return;
    }
    canvas.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100%",
      "height: 100%",
      "pointer-events: none",
    ].join("; ") + ";";

    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    initDrawingUtils();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  async function initDrawingUtils() {
    try {
      const bundleUrl = chrome.runtime.getURL(VISION_BUNDLE_PATH);
      const { DrawingUtils, HandLandmarker } = await import(bundleUrl);
      HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;
      drawingUtils = new DrawingUtils(ctx);
      ready = true;
      console.log("[GestureRead] skeleton drawing utils ready.");
    } catch (err) {
      console.error("[GestureRead] failed to init skeleton DrawingUtils:", err);
    }
  }

  function draw(landmarks) {
    if (!ctx || !canvas || !visible) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!ready || !landmarks || landmarks.length === 0) {
      return;
    }

    ctx.save();
    // Mirror the x-axis so the skeleton moves like a mirror, not a camera feed.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    drawingUtils.drawConnectors(landmarks, HAND_CONNECTIONS, {
      color: "#22c55e",
      lineWidth: 3,
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: "#f9fafb",
      lineWidth: 1,
      radius: 4,
    });

    ctx.restore();
  }

  function clear() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCanvas);
  } else {
    initCanvas();
  }

  function setVisible(v) {
    visible = v;
    if (!visible) clear();
  }

  window.GestureReadSkeleton = { draw, clear, setVisible };
})();