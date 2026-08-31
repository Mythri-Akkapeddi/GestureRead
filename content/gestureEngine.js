// Runs in the content script's isolated world.
// Receives smoothed landmark frames relayed from overlay/engine.js via overlayController.js's postMessage listener, which re-dispatches them as a "gestureread:landmarks" DOM event.
// Has pose classification and gesture dispatch
// Does NOT touch MediaPipe or the camera, that lives entirely in overlay/engine.js.


(async function () {
  const { PINCH_ENTER, PINCH_EXIT } = await import(chrome.runtime.getURL("utils/constants.js"));

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

  const POSE_STABILITY_FRAMES = 3;

  // Pinch tuning — the enter/exit distances themselves come from constants.js, these handle how a held pinch translates into zoom.
  const PINCH_MOVE_THRESHOLD = 0.004;   // ignore sub-tremor finger jitter
  const PINCH_ZOOM_SENSITIVITY = 6;     // scales normalized distance delta into a zoom factor
  const PINCH_ENGAGE_COOLDOWN_MS = 250; // applied only to the enter transition

  let lastPalmY = null;
  let currentPose = null;
  let candidatePose = null;
  let candidateStreak = 0;
  let enabled = true;

  let pinchActive = false;
  let lastPinchDistance = null;

  const gestureCooldowns = new Map();

  function canTrigger(gestureName, cooldownMs) {
    const last = gestureCooldowns.get(gestureName);
    if (last === undefined) return true;
    return performance.now() - last >= cooldownMs;
  }

  function markTriggered(gestureName) {
    gestureCooldowns.set(gestureName, performance.now());
  }

  // Pinch is checked first since thumb–index distance is a much stronger discriminator for it than finger-extension counting is.
  function classifyPose(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;

    const pinchDist = euclideanDistance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
    if (pinchActive || pinchDist < PINCH_ENTER) return "pinch";

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

  // hysteresis on the raw (unstabilized) pinch distance, engage at PINCH_ENTER (0.08), only disengage once fingers open back out past PINCH_EXIT (0.18). 
  // The gap between the two is what stops a finger pair hovering right at one threshold from flickering the zoom on/off

  function detectPinch(landmarks, stablePose) {
    const dist = euclideanDistance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);

    if (!pinchActive) {
      // Only allow a NEW pinch to engage when it's not confidently mid-scroll.
      if (stablePose === "open") return;
      if (dist < PINCH_ENTER && canTrigger("pinchEngage", PINCH_ENGAGE_COOLDOWN_MS)) {
        pinchActive = true;
        lastPinchDistance = dist;
        markTriggered("pinchEngage");
        console.log("[GestureRead] pinch engaged");
      }
      return;
    }

    if (dist > PINCH_EXIT) {
      pinchActive = false;
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

    const zoomFactor = 1 + deltaDist * PINCH_ZOOM_SENSITIVITY;
    window.GestureReadPageNavigator?.zoomBy(zoomFactor);
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
    detectPinch(landmarks, pose);
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
      pinchActive = false;
      lastPinchDistance = null;
    },
    classifyPose, // exposed for manual console testing
  };
})();