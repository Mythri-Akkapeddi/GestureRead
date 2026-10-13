// Runs in the content script's isolated world.
// Receives wrist position/velocity variance from the overlay (overlay/smoothing.js) via overlayController.js's "gestureread:variance" relay.
// First FATIGUE_BASELINE_SECONDS of readings establish this user's personal baseline, everyone's natural hand tremor differs, so an absolute variance threshold would misfire for most people.
// After that, every reading is scored as a multiplier against that baseline:
//   score = (positionVariance / baselinePosition) * FATIGUE_POSITION_WEIGHT + (velocityVariance / baselineVelocity) * FATIGUE_VELOCITY_WEIGHT
// A score of 1.0 means "same as baseline." FATIGUE_MULTIPLIER_THRESHOLD (2.0) means "twice as shaky as when the session started."

(async function () {
  const {
    FATIGUE_BASELINE_SECONDS,
    FATIGUE_CHECK_INTERVAL_MS,
    FATIGUE_MULTIPLIER_THRESHOLD,
    FATIGUE_POSITION_WEIGHT,
    FATIGUE_VELOCITY_WEIGHT,
  } = await import(chrome.runtime.getURL("utils/constants.js"));

  const baselineSamples = { position: [], velocity: [] };
  let baselineStartedAt = null;
  let baseline = null; // { position, velocity } — set once, when the baseline window closes

  let latest = { positionVariance: 0, velocityVariance: 0 };
  let latestScore = 0;

  function handleVarianceFrame(event) {
    const { positionVariance, velocityVariance } = event.detail || {};
    if (typeof positionVariance !== "number" || typeof velocityVariance !== "number") return;

    latest = { positionVariance, velocityVariance };

    if (baseline !== null) return; // baseline already locked in, nothing left to collect

    if (baselineStartedAt === null) {
      baselineStartedAt = Date.now();
      console.log(`[GestureRead] fatigue baseline capture started (${FATIGUE_BASELINE_SECONDS}s)...`);
    }

    baselineSamples.position.push(positionVariance);
    baselineSamples.velocity.push(velocityVariance);

    const elapsedSec = (Date.now() - baselineStartedAt) / 1000;
    if (elapsedSec >= FATIGUE_BASELINE_SECONDS) {
      baseline = {
        // Guard against a perfectly still baseline (variance of 0) causing a divide-by-zero that would make every later reading score as "infinitely fatigued."
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

  function tick() {
    if (!baseline) return; // still collecting baseline samples, nothing to score yet
    latestScore = computeFatigueScore();
    const flag = latestScore >= FATIGUE_MULTIPLIER_THRESHOLD ? " ⚠️ fatigued" : "";
    console.log(`[GestureRead] fatigue score: ${latestScore.toFixed(2)}x${flag}`);
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