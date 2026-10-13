// Runs inside the overlay iframe alongside engine.js
// Rolling average over the last N landmark frames (N=5 default), averages each of the 21 landmark points' x/y/z across the history window to cut jitter from raw MediaPipe output.
// getWristPositionVariance / getWristVelocityVariance compute from the RAW (pre-smoothing) history window, since smoothed data would mask the jitter fatigueMonitor.js is trying to detect.

(function () {
  const DEFAULT_HISTORY_SIZE = 5;
  let history = [];
  let historySize = DEFAULT_HISTORY_SIZE;

  function setHistorySize(n) {
    historySize = n;
    if (history.length > historySize) {
      history = history.slice(history.length - historySize);
    }
  }

  function addFrame(landmarks) {
    if (!landmarks) return null;

    history.push(landmarks);
    if (history.length > historySize) {
      history.shift();
    }

    return averageLandmarks(history);
  }

  function averageLandmarks(frames) {
    const numPoints = frames[0].length;
    const averaged = new Array(numPoints);

    for (let i = 0; i < numPoints; i++) {
      let sumX = 0, sumY = 0, sumZ = 0;
      for (const frame of frames) {
        sumX += frame[i].x;
        sumY += frame[i].y;
        sumZ += frame[i].z ?? 0;
      }
      averaged[i] = {
        x: sumX / frames.length,
        y: sumY / frames.length,
        z: sumZ / frames.length,
      };
    }
    return averaged;
  }

  // Position (tremor) variance: how much the wrist's Y position spreads out across the current history window. A steady hand holds this low; fatigue/shake pushes it up.
  function getWristPositionVariance() {
    if (history.length < 2) return 0;
    const wristYs = history.map((frame) => frame[0].y);
    return computeVariance(wristYs);
  }

  // Velocity variance: how much frame-to-frame wrist displacement varies. Distinct from position variance — a slow steady drift has low velocity variance even with some position spread; a jittery shake has high velocity variance.
  function getWristVelocityVariance() {
    if (history.length < 3) return 0;
    const velocities = [];
    for (let i = 1; i < history.length; i++) {
      velocities.push(euclideanDistance(history[i - 1][0], history[i][0]));
    }
    return computeVariance(velocities);
  }

  function getJitterVariance() {
    return getWristPositionVariance();
  }

  function reset() {
    history = [];
  }

  window.GestureReadSmoothing = {
    addFrame,
    getJitterVariance,
    getWristPositionVariance,
    getWristVelocityVariance,
    setHistorySize,
    reset,
  };
})();