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

// Session history list. Groups flat log entries by sessionId for the advanced dashboard.
function buildSessionSummary(logs) {
  const bySession = {};
  for (const entry of logs) {
    if (!entry.sessionId) continue;
    if (!bySession[entry.sessionId]) {
      bySession[entry.sessionId] = {
        sessionId: entry.sessionId,
        eventCount: 0,
        firstTimestamp: entry.timestamp,
        lastTimestamp: entry.timestamp,
        correctedCount: 0,
      };
    }
    const s = bySession[entry.sessionId];
    s.eventCount++;
    s.firstTimestamp = Math.min(s.firstTimestamp, entry.timestamp);
    s.lastTimestamp = Math.max(s.lastTimestamp, entry.timestamp);
    if (entry.corrected) s.correctedCount++;
  }
  return Object.values(bySession).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}