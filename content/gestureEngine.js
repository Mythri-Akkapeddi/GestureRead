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

  const SCROLL_MOVE_THRESHOLD = 0.01;
  const SCROLL_SPEED_MULTIPLIER = 4000;
  const MAX_SCROLL_PER_FRAME = 60;

  // A raw per-frame pose classification is noisy right at the boundary (2 vs 3 fingers extended). Require the SAME raw pose for POSE_STABILITY_FRAMES consecutive frames before it becomes the committed currentPose. 
  // This is what kills the scroll "double-trigger/hitch" symptom. Without it, one misclassified frame resets lastPalmY and restarts the scroll delta calculation mid-swipe.
  const POSE_STABILITY_FRAMES = 3;

  let lastPalmY = null;
  let currentPose = null;
  let candidatePose = null;
  let candidateStreak = 0;
  let enabled = true;

  // Generic per-gesture cooldown registry
  // Keyed per gesture name, NOT one global lock, engaging one gesture must never block a different gesture from firing the same frame.
  // Nothing uses it yet (scroll is continuous, doesn't need one)

  const gestureCooldowns = new Map();

  function canTrigger(gestureName, cooldownMs) {
    const last = gestureCooldowns.get(gestureName);
    if (last === undefined) return true;
    return performance.now() - last >= cooldownMs;
  }

  function markTriggered(gestureName) {
    gestureCooldowns.set(gestureName, performance.now());
  }

  // v1 classifier: for each of the 4 non-thumb fingers, "extended" if the tip is farther from the wrist than that finger's PIP joint is. 
  // Thumb geometry is different so it's skipped here.
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

  // Commits a raw classification to currentPose only after it's been consistent for POSE_STABILITY_FRAMES frames in a row.
  function updateStablePose(rawPose) {
    if (rawPose === candidatePose) {
      candidateStreak++;
    } else {
      candidatePose = rawPose;
      candidateStreak = 1;
    }

    if (candidateStreak >= POSE_STABILITY_FRAMES && currentPose !== candidatePose) {
      currentPose = candidatePose;
      console.log("[GestureRead] pose:", currentPose);
    }

    return currentPose;
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
        candidatePose = null;
        candidateStreak = 0;
        lastPalmY = null;
      }
      return;
    }

    const rawPose = classifyPose(landmarks);
    const pose = updateStablePose(rawPose);

    detectScroll(pose, landmarks);
  }

  window.addEventListener("gestureread:landmarks", handleLandmarksFrame);

  window.GestureReadGestureEngine = {
    enable: () => { enabled = true; },
    disable: () => {
      enabled = false;
      lastPalmY = null;
      currentPose = null;
      candidatePose = null;
      candidateStreak = 0;
    },
    classifyPose, // exposed for manual console testing
  };
})();