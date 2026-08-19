// content/smoothing.js
// Rolling average smoothing over the last N landmark frames.
// The real smoothing algorithm will be developed later.
// For now it remembers recent landmark frames, returns the latest frame, exposes a jitter API for future fatigue detection

(function () {
  const DEFAULT_HISTORY_SIZE = 5;
  let history = [];
  let historySize = DEFAULT_HISTORY_SIZE;

  function setHistorySize(n) {
    historySize = n;
  }

  function addFrame(landmarks) {
    if (!landmarks) return null;

    history.push(landmarks);
    if (history.length > historySize) {
      history.shift();
    }

    // Placeholder: returns the latest raw frame unchanged for now.
    return landmarks;
  }

  function getJitterVariance() {
    // Placeholder — real implementation needed by fatigueMonitor.js
    return 0;
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