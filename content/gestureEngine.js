// Runs in the content script's isolated world.
// Receives smoothed landmark frames relayed from overlay/engine.js via overlayController.js's postMessage listener, which re-dispatches them as a "gestureread:landmarks" DOM event.
// Has pose classification and gesture dispatch
// Does NOT touch MediaPipe or the camera, that lives entirely in overlay/engine.js.

(function () {
  const WRIST = 0;
  const FINGERS = [
    { name: "thumb", tip: 4, pip: 2 },
    { name: "index", tip: 8, pip: 6 },
    { name: "middle", tip: 12, pip: 10 },
    { name: "ring", tip: 16, pip: 14 },
    { name: "pinky", tip: 20, pip: 18 },
  ];

  const SCROLL_MOVE_THRESHOLD = 0.01;   // normalized-Y delta below which the hand counts as "still"
  const SCROLL_SPEED_MULTIPLIER = 4000; // scales normalized-Y delta into scroll pixels
  const MAX_SCROLL_PER_FRAME = 60;      // clamp so a jump/re-detect can't slam the page

  let lastPalmY = null;
  let currentPose = null;
  let enabled = true;

  // v1 classifier: for each of the 4 non-thumb fingers, "extended" if the tip is farther from
  // the wrist than that finger's PIP joint is. Thumb geometry is different so it's skipped here
  // will be handled separately when pinch/thumb-only gestures are added.
  function classifyPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[WRIST];
    let extendedCount = 0;

    for (const finger of FINGERS) {
      if (finger.name === "thumb") continue;
      const tip = landmarks[finger.tip];
      const pip = landmarks[finger.pip];
      const tipDist = euclideanDistance(tip, wrist);
      const pipDist = euclideanDistance(pip, wrist);
      if (tipDist > pipDist) extendedCount++;
    }

    if (extendedCount >= 3) return "open";
    if (extendedCount === 0) return "fist";
    return "unknown";
  }

  function detectScroll(pose, landmarks) {
    if (pose !== "open") {
      lastPalmY = null;
      return;
    }

    const palmY = landmarks[WRIST].y;

    if (lastPalmY === null) {
      lastPalmY = palmY;
      return;
    }

    const deltaY = palmY - lastPalmY;
    lastPalmY = palmY;

    if (Math.abs(deltaY) < SCROLL_MOVE_THRESHOLD) return;

    const rawScroll = deltaY * SCROLL_SPEED_MULTIPLIER;
    const scrollAmount = clamp(rawScroll, -MAX_SCROLL_PER_FRAME, MAX_SCROLL_PER_FRAME);

    window.scrollBy(0, scrollAmount);
  }

  function handleLandmarksFrame(event) {
    if (!enabled) return;

    const landmarks = event.detail?.landmarks;
    if (!landmarks) {
      if (currentPose !== null) {
        currentPose = null;
        lastPalmY = null;
      }
      return;
    }

    const pose = classifyPose(landmarks);
    if (pose !== currentPose) {
      currentPose = pose;
      console.log("[GestureRead] pose:", pose);
    }

    detectScroll(pose, landmarks);
  }

  window.addEventListener("gestureread:landmarks", handleLandmarksFrame);

  window.GestureReadGestureEngine = {
    enable: () => { enabled = true; },
    disable: () => { enabled = false; lastPalmY = null; currentPose = null; },
    classifyPose, // exposed for manual console testing
  };
})();