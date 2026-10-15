// Runs in the content script's isolated world.
// "Wrong gesture?" undo workflow using a HUD prompt (button).
// Observes engage/release events the same way adaptiveThresholds.js does (wraps window.GestureReadLogger.log), snapshots page state right before each gesture engages, and if the state meaningfully changed by release time, offers a short-lived "Undo" prompt in the HUD.
// Accepting it reverts the page AND tells adaptiveThresholds.js this was a confirmed false positive, which is a stronger signal than its own duration heuristic.

(async function () {
  const {
    CORRECTION_WINDOW_MS,
    CORRECTION_MIN_SCROLL_DELTA,
    CORRECTION_MIN_ZOOM_DELTA,
    CORRECTION_MIN_BRIGHTNESS_DELTA,
  } = await import(chrome.runtime.getURL("utils/constants.js"));

  const GESTURE_TYPES = ["scroll", "pinch", "brightness"];
  const MIN_DELTA = {
    scroll: CORRECTION_MIN_SCROLL_DELTA,
    pinch: CORRECTION_MIN_ZOOM_DELTA,
    brightness: CORRECTION_MIN_BRIGHTNESS_DELTA,
  };

  // gesture -> { preValue, postValue, timeoutId }
  const pending = {};

  function readValue(gesture) {
    if (gesture === "scroll") return window.scrollY;
    if (gesture === "pinch") return window.GestureReadPageNavigator?.getZoom() ?? 1;
    if (gesture === "brightness") return window.GestureReadPageNavigator?.getBrightness() ?? 1;
    return null;
  }

  function applyValue(gesture, value) {
    if (gesture === "scroll") {
      window.scrollTo({ top: value, behavior: "smooth" });
    } else if (gesture === "pinch") {
      window.GestureReadPageNavigator?.applyZoom(value);
    } else if (gesture === "brightness") {
      window.GestureReadPageNavigator?.applyBrightness(value);
    }
  }

  function clearPending(gesture) {
    const entry = pending[gesture];
    if (!entry) return;
    clearTimeout(entry.timeoutId);
    delete pending[gesture];
  }

  function handleEngage(gesture) {
    clearPending(gesture); // a fresh gesture of this type supersedes any stale pending correction
    pending[gesture] = { preValue: readValue(gesture), timeoutId: null };
  }

  function handleRelease(gesture) {
    const entry = pending[gesture];
    if (!entry) return;

    const postValue = readValue(gesture);
    const delta = Math.abs(postValue - entry.preValue);

    if (delta < MIN_DELTA[gesture]) {
      delete pending[gesture]; // nothing meaningful happened, not worth prompting
      return;
    }

    entry.postValue = postValue;
    entry.timeoutId = setTimeout(() => expireCorrection(gesture), CORRECTION_WINDOW_MS);
    console.log(`[GestureRead] correction window open for "${gesture}" (${CORRECTION_WINDOW_MS}ms)`);
    window.GestureReadOverlay?.notifyCorrectionAvailable({ gesture });
  }

  function expireCorrection(gesture) {
    if (!pending[gesture]) return;
    delete pending[gesture];
    window.GestureReadOverlay?.notifyCorrectionExpired(gesture);
  }

  function handleUndo(gesture) {
    const entry = pending[gesture];
    if (!entry) return; // window already expired — ignore a late click

    clearPending(gesture);
    applyValue(gesture, entry.preValue);
    console.log(`[GestureRead] "${gesture}" undone by user.`);

    const marked = window.GestureReadLogger?.markCorrected(`${gesture}_engage`);
    if (!marked) {
      window.GestureReadLogger?.log("correction", 1, { correctedGesture: gesture, standalone: true });
    }

    window.GestureReadAdaptiveThresholds?.recordConfirmedFalsePositive(gesture);
  }

  function waitForLogger(callback, attemptsLeft = 20) {
    if (window.GestureReadLogger) {
      callback(window.GestureReadLogger);
      return;
    }
    if (attemptsLeft <= 0) {
      console.warn("[GestureRead] correctionEngine: logger never became available, undo workflow disabled.");
      return;
    }
    setTimeout(() => waitForLogger(callback, attemptsLeft - 1), 50);
  }

  waitForLogger((logger) => {
    const originalLog = logger.log;
    logger.log = function (type, confidence, meta) {
      for (const gesture of GESTURE_TYPES) {
        if (type === `${gesture}_engage`) handleEngage(gesture);
        if (type === `${gesture}_release`) handleRelease(gesture);
      }
      return originalLog(type, confidence, meta);
    };
    console.log("[GestureRead] correction engine attached to logger.");
  });

  window.addEventListener("gestureread:correction", (event) => {
    const { gesture, accepted } = event.detail || {};
    if (accepted) handleUndo(gesture);
    else clearPending(gesture);
  });

  window.GestureReadCorrectionEngine = {
    _debugPending: () => ({ ...pending }), // manual console testing
  };
})();