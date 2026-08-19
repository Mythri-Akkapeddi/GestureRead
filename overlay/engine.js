// Runs inside the overlay iframe (extension-origin page), not the content script.
// This avoids the isolated-world/main-world split that broke MediaPipe's wasm loader.
// MediaPipe and the webcam live entirely in this context.

(function () {
  let handLandmarker = null;
  let videoEl = null;
  let rafId = null;
  let running = false;

  const VISION_BUNDLE_PATH = "assets/mediapipe/vision_bundle.mjs";
  const MODEL_PATH = "assets/mediapipe/hand_landmarker.task";
  const WASM_DIR_PATH = "assets/mediapipe/wasm";

  async function init() {
    if (running) {
      console.log("[GestureRead] gesture engine already running.");
      return;
    }
    try {
      await setupCamera();
      await setupHandLandmarker();
      startLoop();
      console.log("[GestureRead] gesture engine running (overlay context).");
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
    videoEl.style.cssText = "position:fixed; top:-9999px; left:-9999px;";
    document.documentElement.appendChild(videoEl);

    await videoEl.play();
    console.log("[GestureRead] webcam stream active:", stream.getVideoTracks()[0]?.label);
  }

  async function setupHandLandmarker() {
    console.log("[GestureRead] loading MediaPipe...");
    const bundleUrl = chrome.runtime.getURL(VISION_BUNDLE_PATH);
    const { HandLandmarker, FilesetResolver } = await import(bundleUrl);
    console.log("[GestureRead] MediaPipe bundle imported.");

    const vision = await FilesetResolver.forVisionTasks(chrome.runtime.getURL(WASM_DIR_PATH));

    console.log("[GestureRead] MediaPipe vision fileset created:", vision);

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
      if (Math.random() < 0.02) {
        console.log("[GestureRead] hand detected, landmark count:", smoothed?.length);
      }
      // Tell the parent page (content script) we're alive and detecting.
      window.parent.postMessage(
        { source: "gestureread-overlay", type: "LANDMARKS_FRAME", payload: { count: smoothed?.length } },
        "*"
      );
    }
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (videoEl?.srcObject) videoEl.srcObject.getTracks().forEach((t) => t.stop());
    console.log("[GestureRead] gesture engine stopped.");
  }

  // Triggered from the content script via postMessage, not auto-started.
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "gestureread-content") return;
    if (data.type === "START_ENGINE") init();
    if (data.type === "STOP_ENGINE") stop();
  });

  window.GestureReadEngine = { init, stop };
})();