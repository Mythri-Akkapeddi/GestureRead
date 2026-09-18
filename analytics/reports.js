// No import/export, loaded before adaptiveThresholds.js by manifest.json.
// Formats structured records for anything that needs to persist a summary of what the adaptive system did, so background/sessionManager.js always receives a stable shape. 
// Reused later by any future reporting/dashboard work.

function buildThresholdHistoryEntry({ gesture, direction, percent, multiplier, fpRate, sampleSize }) {
  return {
    gesture,
    direction,   // "tightened" | "loosened"
    percent,     // magnitude of this adjustment, whole-number percent
    multiplier: Number(multiplier.toFixed(3)),
    fpRate: Number(fpRate.toFixed(3)),
    sampleSize,
    timestamp: Date.now(),
  };
}