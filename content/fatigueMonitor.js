// Runs in the content script's isolated world.
// Receives wrist position/velocity variance from the overlay (overlay/smoothing.js) via overlayController.js's "gestureread:variance" relay.
// First FATIGUE_BASELINE_SECONDS of readings establish this user's personal baseline, everyone's natural hand tremor differs, so an absolute variance threshold would misfire for most people.
// After that, every reading is scored as a multiplier against that baseline:
//   score = (positionVariance / baselinePosition) * FATIGUE_POSITION_WEIGHT + (velocityVariance / baselineVelocity) * FATIGUE_VELOCITY_WEIGHT
// A score of 1.0 means "same as baseline." FATIGUE_MULTIPLIER_THRESHOLD (2.0) means "twice as shaky as when the session started."

// Once the score crosses the threshold, offers the user Reduced Precision Mode via a HUD nudge (overlay/notifications.js). 
// fatigueNotified is a one-shot latch with hysteresis, it won't re-fire until the score has clearly recovered (below FATIGUE_NUDGE_RESET_MULTIPLIER), so a score hovering right at 2.0x doesn't spam a new nudge every 2s.

(async function () {
  const {
    FATIGUE_BASELINE_SECONDS,
    FATIGUE_CHECK_INTERVAL_MS,
    FATIGUE_MULTIPLIER_THRESHOLD,
    FATIGUE_POSITION_WEIGHT,
    FATIGUE_VELOCITY_WEIGHT,
    FATIGUE_NUDGE_RESET_MULTIPLIER,
  } = await import(chrome.runtime.getURL("utils/constants.js"));

  const baselineSamples = { position: [], velocity: [] };
  let baselineStartedAt = null;
  let baseline = null;

  let latest = { positionVariance: 0, velocityVariance: 0 };
  let latestScore = 0;
  let fatigueNotified = false;

  function handleVarianceFrame(event) {
    const { positionVariance, velocityVariance } = event.detail || {};
    if (typeof positionVariance !== "number" || typeof velocityVariance !== "number") return;

    latest = { positionVariance, velocityVariance };

    if (baseline !== null) return;

    if (baselineStartedAt === null) {
      baselineStartedAt = Date.now();
      console.log(`[GestureRead] fatigue baseline capture started (${FATIGUE_BASELINE_SECONDS}s)...`);
    }

    baselineSamples.position.push(positionVariance);
    baselineSamples.velocity.push(velocityVariance);

    const elapsedSec = (Date.now() - baselineStartedAt) / 1000;
    if (elapsedSec >= FATIGUE_BASELINE_SECONDS) {
      baseline = {
        position: rollingMean(baselineSamples.position) || 1e-9,
        velocity: rollingMean(baselineSamples.velocity) || 1e-9,
      };
      console.log("[GestureRead] fatigue baseline established:", baseline);
    }
  }

  function computeFatigueScore() {
    if (!baseline) return 0;
    const positionRatio = latest.positionVariance / baseline.position;
    const velocityRatio = latest.velocityVariance / baseline.velocity;
    return positionRatio * FATIGUE_POSITION_WEIGHT + velocityRatio * FATIGUE_VELOCITY_WEIGHT;
  }

  function maybeNotifyFatigue() {
    if (latestScore >= FATIGUE_MULTIPLIER_THRESHOLD && !fatigueNotified) {
      if (window.GestureReadGestureEngine?.isReducedPrecision()) return;
      fatigueNotified = true;
      console.log("[GestureRead] fatigue threshold crossed, showing nudge.");
      window.GestureReadLogger?.log("fatigue_detected", null, { score: Number(latestScore.toFixed(2)) });
      window.GestureReadOverlay?.notifyFatigueDetected(latestScore);
    } else if (latestScore < FATIGUE_NUDGE_RESET_MULTIPLIER) {
      fatigueNotified = false; // allow a fresh nudge once the score has clearly recovered
    }
  }

  function tick() {
    if (!baseline) return;
    latestScore = computeFatigueScore();
    const flag = latestScore >= FATIGUE_MULTIPLIER_THRESHOLD ? " ⚠️ fatigued" : "";
    console.log(`[GestureRead] fatigue score: ${latestScore.toFixed(2)}x${flag}`);
    maybeNotifyFatigue();
  }

  window.addEventListener("gestureread:variance", handleVarianceFrame);
  setInterval(tick, FATIGUE_CHECK_INTERVAL_MS);

  window.GestureReadFatigueMonitor = {
    getScore: () => latestScore,
    getBaseline: () => baseline,
    getLatestVariance: () => ({ ...latest }),
    isFatigued: () => latestScore >= FATIGUE_MULTIPLIER_THRESHOLD,
  };
})();