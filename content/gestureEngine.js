// Runs in the content script's isolated world.
// Receives smoothed landmark frames relayed from overlay/engine.js via overlayController.js's postMessage listener, which re-dispatches them as a "gestureread:landmarks" DOM event.
// Has pose classification and gesture dispatch
// Does NOT touch MediaPipe or the camera, that lives entirely in overlay/engine.js.

// Mutual exclusivity: exactly one gesture can be "live" at a time (activeGesture).

(async function () {
  const {
    PINCH_ENTER,
    PINCH_EXIT,
    BRIGHTNESS_MOVE_THRESHOLD,
    BRIGHTNESS_SENSITIVITY,
  } = await import(chrome.runtime.getURL("utils/constants.js"));

  const WRIST = 0;
  const THUMB_TIP = 4;
  const INDEX_TIP = 8;
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

  const POSE_STABILITY_FRAMES = 3; // frames of consistent pose required before a gesture is allowed to START

  const PINCH_MOVE_THRESHOLD = 0.004;
  const PINCH_ZOOM_SENSITIVITY = 6;
  const PINCH_ENGAGE_COOLDOWN_MS = 250; // applied only to the enter transition

  let enabled = true;

  // Single source of truth: null | "scroll" | "pinch" | "brightness".
  let activeGesture = null;

  let currentPose = null;
  let candidatePose = null;
  let candidateStreak = 0;

  let lastPalmY = null;
  let lastPinchDistance = null;
  let lastThumbY = null;

  const gestureCooldowns = new Map();
  function canTrigger(name, cooldownMs) {
    const last = gestureCooldowns.get(name);
    return last === undefined || performance.now() - last >= cooldownMs;
  }
  function markTriggered(name) {
    gestureCooldowns.set(name, performance.now());
  }

  // finger extension helpers, shared by every pose
  function isExtended(landmarks, finger) {
    const wrist = landmarks[WRIST];
    return euclideanDistance(landmarks[finger.tip], wrist) > euclideanDistance(landmarks[finger.pip], wrist);
  }

  function isThumbExtended(landmarks) {
    const thumb = FINGERS.find((f) => f.name === "thumb");
    return isExtended(landmarks, thumb);
  }

  function countExtendedNonThumbFingers(landmarks) {
    let count = 0;
    for (const finger of FINGERS) {
      if (finger.name === "thumb") continue;
      if (isExtended(landmarks, finger)) count++;
    }
    return count;
  }

  // Raw finger extension count, independent of pinch state, used both for classification and while scrolling to decide when to stop.
  function rawFingerPose(landmarks) {
    const extendedCount = countExtendedNonThumbFingers(landmarks);
    if (extendedCount >= 3) return "open";
    if (extendedCount === 0) return "fist";
    return "unknown";
  }

  // Fist shape, but thumb sticking out. Used for brightness.
  function isThumbOnlyPose(landmarks) {
    return countExtendedNonThumbFingers(landmarks) === 0 && isThumbExtended(landmarks);
  }

  // Purely descriptive (for logging + deciding whether a gesture may START).
  // Does not itself gate anything, activeGesture does that.
  // Single source of truth for pose category: open / pinch / thumbOnly / point / fist.
  function classifyPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    const pinchDist = euclideanDistance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
    if (activeGesture === "pinch" || pinchDist < PINCH_ENTER) return "pinch";
    if (activeGesture === "brightness" || isThumbOnlyPose(landmarks)) return "thumbOnly";
    return rawFingerPose(landmarks);
  }

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

  function runScroll(landmarks) {
    // Exit the instant the hand stops looking "open", no debounce on the way out, only on the way in.
    // Responsiveness matters more once a gesture is already running and this is also what hands scroll back off to pinch.
    if (rawFingerPose(landmarks) !== "open") {
      activeGesture = null;
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

    const scrollAmount = clamp(deltaY * SCROLL_SPEED_MULTIPLIER, -MAX_SCROLL_PER_FRAME, MAX_SCROLL_PER_FRAME);
    window.scrollBy(0, scrollAmount);
  }

  function runPinch(landmarks) {
    const dist = euclideanDistance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);

    // Hysteresis exit, must open back out past PINCH_EXIT (0.18), not just above PINCH_ENTER (0.08), so a natural zoom-out doesn't drop the gesture mid-motion.
    if (dist > PINCH_EXIT) {
      activeGesture = null;
      lastPinchDistance = null;
      console.log("[GestureRead] pinch released");
      return;
    }

    if (lastPinchDistance === null) {
      lastPinchDistance = dist;
      return;
    }

    const deltaDist = dist - lastPinchDistance;
    lastPinchDistance = dist;
    if (Math.abs(deltaDist) < PINCH_MOVE_THRESHOLD) return;

    window.GestureReadPageNavigator?.zoomBy(1 + deltaDist * PINCH_ZOOM_SENSITIVITY);
  }

  function runBrightness(landmarks) {
    // Same exit logic as scroll: leave the instant the hand stops being thumb-only, no debounce on the way out.
    if (!isThumbOnlyPose(landmarks)) {
      activeGesture = null;
      lastThumbY = null;
      return;
    }

    const thumbY = landmarks[THUMB_TIP].y;
    if (lastThumbY === null) {
      lastThumbY = thumbY;
      return;
    }

    const deltaY = thumbY - lastThumbY;
    lastThumbY = thumbY;
    if (Math.abs(deltaY) < BRIGHTNESS_MOVE_THRESHOLD) return;

    // Normalized Y increases downward, so moving the thumb UP (deltaY negative) should brighten.
    const change = -deltaY * BRIGHTNESS_SENSITIVITY;
    window.GestureReadPageNavigator?.brightnessBy(change);
  }

  function tryEnterPinch(landmarks) {
    const dist = euclideanDistance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
    if (dist < PINCH_ENTER && canTrigger("pinchEngage", PINCH_ENGAGE_COOLDOWN_MS)) {
      activeGesture = "pinch";
      lastPinchDistance = dist;
      markTriggered("pinchEngage");
      console.log("[GestureRead] pinch engaged");
      return true;
    }
    return false;
  }

  function tryEnterBrightness(stablePose, landmarks) {
    if (stablePose === "thumbOnly") {
      activeGesture = "brightness";
      lastThumbY = landmarks[THUMB_TIP].y;
      console.log("[GestureRead] brightness engaged");
      return true;
    }
    return false;
  }

  function tryEnterScroll(stablePose, landmarks) {
    if (stablePose === "open") {
      activeGesture = "scroll";
      lastPalmY = landmarks[WRIST].y;
      return true;
    }
    return false;
  }

  function handleLandmarksFrame(event) {
    if (!enabled) return;

    const landmarks = event.detail?.landmarks;
    if (!landmarks) {
      activeGesture = null;
      currentPose = null;
      candidatePose = null;
      candidateStreak = 0;
      lastPalmY = null;
      lastPinchDistance = null;
      lastThumbY = null;
      return;
    }

    const rawPose = classifyPose(landmarks);
    const stablePose = updateStablePose(rawPose);

    if (activeGesture === "scroll") {
      runScroll(landmarks);
      return;
    }

    if (activeGesture === "pinch") {
      runPinch(landmarks);
      return;
    }

    if (activeGesture === "brightness") {
      runBrightness(landmarks);
      return;
    }

    // Nothing active. Pinch and thumbOnly are the more deliberate shapes, check them before the broader "open" scroll pose.
    if (tryEnterPinch(landmarks)) return;
    if (tryEnterBrightness(stablePose, landmarks)) return;
    tryEnterScroll(stablePose, landmarks);
  }

  window.addEventListener("gestureread:landmarks", handleLandmarksFrame);

  window.GestureReadGestureEngine = {
    enable: () => { enabled = true; },
    disable: () => {
      enabled = false;
      activeGesture = null;
      currentPose = null;
      candidatePose = null;
      candidateStreak = 0;
      lastPalmY = null;
      lastPinchDistance = null;
      lastThumbY = null;
    },
    classifyPose, // exposed for manual console testing
  };
})();