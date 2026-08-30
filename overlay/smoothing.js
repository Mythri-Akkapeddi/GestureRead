// Runs inside the overlay iframe alongside engine.js
// Rolling average over the last N landmark frames (N=5 default), averages each of the 21 landmark points' x/y/z across the history window to cut jitter from raw MediaPipe output.
// getJitterVariance computes from wrist-Y spread across the current history window using standardDeviation from utils/math.js. Nothing uses it yet, fatigueMonitor.js will

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

  function getJitterVariance() {
    if (history.length < 2) return 0;
    // Landmark 0 = wrist.
    const wristYs = history.map((frame) => frame[0].y);
    return standardDeviation(wristYs);
  }

  function reset() {
    history = [];
  }

  window.GestureReadSmoothing = {
    addFrame,
    getJitterVariance,
    setHistorySize,
    reset,
  };
})();