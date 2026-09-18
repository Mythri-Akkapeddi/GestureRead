// Runs in the content script's isolated world.
// Wraps window.GestureReadLogger.log so it can observe every engage/release event gestureEngine.js already emits, without gestureEngine.js needing to know this module exists.
// Every FP_CHECK_INTERVAL_MS, computes a false-positive rate per gesture where an engage held for less than MIN_INTENTIONAL_GESTURE_MS before releasing is treated as accidental and nudges a per-gesture "sensitivity multiplier" up or down. 
// gestureEngine.js reads that multiplier through window.GestureReadAdaptiveThresholds.getMultiplier(type), the same way it already reads calibration through window.GestureReadCalibration.

(async function () {
  const {
    MESSAGE_TYPES,
    FP_WINDOW_MS,
    FP_CHECK_INTERVAL_MS,
    FP_THRESHOLD_RATE,
    FP_LOOSEN_RATE,
    MIN_INTENTIONAL_GESTURE_MS,
    MIN_SAMPLES_FOR_ADAPTATION,
    ADAPTIVE_TIGHTEN_STEP,
    ADAPTIVE_LOOSEN_STEP,
    ADAPTIVE_MIN_MULTIPLIER,
    ADAPTIVE_MAX_MULTIPLIER,
  } = await import(chrome.runtime.getURL("utils/constants.js"));

  const GESTURE_TYPES = ["scroll", "pinch", "brightness"];

  // 1.0 = default. >1 = fires more easily ("loosened"). <1 = harder to fire ("tightened").
  const multipliers = { scroll: 1.0, pinch: 1.0, brightness: 1.0 };

  // completed engage->release pairs still inside the rolling window, per gesture
  const completedEvents = { scroll: [], pinch: [], brightness: [] };

  // engage timestamp waiting for its matching release, per gesture
  const pendingEngageAt = { scroll: null, pinch: null, brightness: null };

  function recordEvent(type) {
    for (const gesture of GESTURE_TYPES) {
      if (type === `${gesture}_engage`) {
        pendingEngageAt[gesture] = Date.now();
        return;
      }
      if (type === `${gesture}_release`) {
        if (pendingEngageAt[gesture] === null) return; // release with no tracked engage — ignore
        const duration = Date.now() - pendingEngageAt[gesture];
        completedEvents[gesture].push({ duration, timestamp: Date.now() });
        pendingEngageAt[gesture] = null;
        return;
      }
    }
  }

  function pruneOldEvents() {
    const cutoff = Date.now() - FP_WINDOW_MS;
    for (const gesture of GESTURE_TYPES) {
      completedEvents[gesture] = completedEvents[gesture].filter((e) => e.timestamp >= cutoff);
    }
  }

  function computeFpRate(gesture) {
    const events = completedEvents[gesture];
    if (events.length === 0) return { rate: 0, sampleSize: 0 };
    const fpCount = events.filter((e) => e.duration < MIN_INTENTIONAL_GESTURE_MS).length;
    return { rate: fpCount / events.length, sampleSize: events.length };
  }

  function adapt() {
    pruneOldEvents();

    for (const gesture of GESTURE_TYPES) {
      const { rate, sampleSize } = computeFpRate(gesture);
      if (sampleSize < MIN_SAMPLES_FOR_ADAPTATION) continue;

      const before = multipliers[gesture];

      if (rate > FP_THRESHOLD_RATE) {
        multipliers[gesture] = normalizeToRange(before - ADAPTIVE_TIGHTEN_STEP, ADAPTIVE_MIN_MULTIPLIER, ADAPTIVE_MAX_MULTIPLIER);
      } else if (rate < FP_LOOSEN_RATE) {
        multipliers[gesture] = normalizeToRange(before + ADAPTIVE_LOOSEN_STEP, ADAPTIVE_MIN_MULTIPLIER, ADAPTIVE_MAX_MULTIPLIER);
      }

      if (multipliers[gesture] !== before) {
        const direction = multipliers[gesture] < before ? "tightened" : "loosened";
        const percent = Math.round((Math.abs(multipliers[gesture] - before) / before) * 100);

        console.log(
          `[GestureRead] ${gesture} threshold ${direction} by ${percent}% ` +
          `(FP rate ${(rate * 100).toFixed(0)}% over ${sampleSize} samples, multiplier now ${multipliers[gesture].toFixed(3)})`
        );

        window.GestureReadLogger?.log("threshold_adapted", null, {
          gesture, direction, percent, multiplier: multipliers[gesture], fpRate: rate, sampleSize,
        });

        const entry = buildThresholdHistoryEntry({
          gesture, direction, percent, multiplier: multipliers[gesture], fpRate: rate, sampleSize,
        });

        window.GestureReadOverlay?.notifyThresholdAdapted(entry);

        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.THRESHOLD_ADAPTED, payload: entry })
          .catch((err) => console.warn("[GestureRead] failed to persist threshold history:", err.message));
      }
    }
  }

  // window.GestureReadLogger's own IIFE is async (it dynamic-imports constants.js too), so it may
  // not exist yet the instant this script runs even though it loads earlier in manifest.json.
  // Same retry pattern content.js uses for the gesture engine.
  function waitForLogger(callback, attemptsLeft = 20) {
    if (window.GestureReadLogger) {
      callback(window.GestureReadLogger);
      return;
    }
    if (attemptsLeft <= 0) {
      console.warn("[GestureRead] adaptiveThresholds: logger never became available, adaptation disabled.");
      return;
    }
    setTimeout(() => waitForLogger(callback, attemptsLeft - 1), 50);
  }

  waitForLogger((logger) => {
    const originalLog = logger.log;
    logger.log = function (type, confidence, meta) {
      recordEvent(type);
      return originalLog(type, confidence, meta);
    };
    console.log("[GestureRead] adaptive threshold engine attached to logger.");
  });

  setInterval(adapt, FP_CHECK_INTERVAL_MS);

  window.GestureReadAdaptiveThresholds = {
    getMultiplier: (gesture) => multipliers[gesture] ?? 1.0,
    getAllMultipliers: () => ({ ...multipliers }),
    _debugForceAdapt: adapt, // manual console testing
  };
})();