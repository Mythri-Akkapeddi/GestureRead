// content/gestureEngine.js
// MediaPipe HandLandmarker setup + webcam capture.
// Pose classification (open/pinch/point/fist/thumbOnly) is NOT here yet.
// Right now: a stable camera stream + a running HandLandmarker producing landmarks per frame.

// NOT auto-started by content.js yet on purpose since starting the camera on every single page load would spam every site with a permission prompt. Starting it manually for testing.
// 1. Request webcam access.
// 2. Create a hidden video element.
// 3. Load MediaPipe Tasks Vision from local files.
// 4. Load the Hand Landmarker model.
// 5. Run HandLandmarker in VIDEO mode.
// 6. Send detected landmarks into smoothing.js.

(function () {
  let handLandmarker = null;
  let videoEl = null;
  let rafId = null;
  let running = false;

  const VISION_BUNDLE_PATH = "assets/mediapipe/vision_bundle.mjs";
  const MODEL_PATH = "assets/mediapipe/hand_landmarker.task";
  const WASM_DIR_PATH = "assets/mediapipe/wasm";

  async function init() {
    try {
      await setupCamera();
      await setupHandLandmarker();
      startLoop();
      console.log("[GestureRead] gesture engine running.");
    } catch (err) {
      console.error("[GestureRead] gesture engine failed to start:", err);
    }
  }

  async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });

    videoEl = document.createElement("video");
    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    // Kept off-screen on purpose, no live camera feed shown, skeleton only.
    videoEl.style.cssText = "position:fixed; top:-9999px; left:-9999px;";
    document.documentElement.appendChild(videoEl);

    await videoEl.play();
    console.log(
      "[GestureRead] webcam stream active:",
      stream.getVideoTracks()[0]?.label
    );
  }

  async function setupHandLandmarker() {
    const bundleUrl = chrome.runtime.getURL(VISION_BUNDLE_PATH);
    const { HandLandmarker, FilesetResolver } = await import(bundleUrl);

    const vision = await FilesetResolver.forVisionTasks(
      chrome.runtime.getURL(WASM_DIR_PATH)
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: chrome.runtime.getURL(MODEL_PATH),
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });

    console.log("[GestureRead] HandLandmarker initialized.");
  }

  function startLoop() {
    running = true;
    const loop = () => {
      if (!running) return;
      detectFrame();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function detectFrame() {
    if (!handLandmarker || !videoEl || videoEl.readyState < 2) return;

    const result = handLandmarker.detectForVideo(videoEl, performance.now());

    if (result.landmarks && result.landmarks.length > 0) {
      const smoothed = window.GestureReadSmoothing?.addFrame(result.landmarks[0]);
      // Will forward `smoothed` to overlayController -> skeletonCanvas later on.
      // For now, just to confirm if detection is live (throttled log so console isn't flooded).
      if (Math.random() < 0.02) {
        console.log("[GestureRead] hand detected, landmark count:", smoothed?.length);
      }
    }
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (videoEl?.srcObject) {
      videoEl.srcObject.getTracks().forEach((t) => t.stop());
    }
    console.log("[GestureRead] gesture engine stopped.");
  }

  window.GestureReadEngine = { init, stop };
})();