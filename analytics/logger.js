// Runs in the content script's isolated world, loaded before gestureEngine.js so window.GestureReadLogger exists by the time any gesture fires.
// No import/export but still uses a dynamic import() for constants.js since that works in any script type.
// Buffers gesture events client-side and flushes them to background in batches so that it doesn't hit chrome.storage.local on every single trigger.

(async function () {
  const { MESSAGE_TYPES } = await import(chrome.runtime.getURL("utils/constants.js"));

  const FLUSH_INTERVAL_MS = 2000;
  const MAX_BUFFER_SIZE = 50;

  const sessionId = generateSessionId();
  let buffer = [];

  function log(type, confidence, meta = {}) {
    buffer.push({
      type,
      confidence: typeof confidence === "number" ? Number(confidence.toFixed(3)) : null,
      timestamp: Date.now(),
      sessionId,
      url: window.location.href,
      ...meta,
    });
    if (buffer.length >= MAX_BUFFER_SIZE) flush();
  }

  // marks the most recent not-yet-flushed entry of `type` as corrected, if it's still in the local buffer and recent. 
  // Returns false if it already flushed to background (too late to tag it retroactively) — correctionEngine.js logs a standalone "correction" event in that case instead.
  function markCorrected(type, withinMs = 10000) {
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i].type === type) {
        if (buffer[i].corrected) return false;
        if (Date.now() - buffer[i].timestamp <= withinMs) {
          buffer[i].corrected = true;
          return true;
        }
        return false;
      }
    }
    return false;
  }

  async function flush() {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.LOG_GESTURE_BATCH,
        payload: { entries: batch },
      });
      if (!response?.ok) {
        console.warn("[GestureRead] gesture log batch failed, re-queuing:", response?.error);
        buffer = batch.concat(buffer);
      }
    } catch (err) {
      console.warn("[GestureRead] gesture log batch failed (channel closed?), re-queuing:", err.message);
      buffer = batch.concat(buffer);
    }
  }

  setInterval(flush, FLUSH_INTERVAL_MS);
  window.addEventListener("pagehide", flush);

  window.GestureReadLogger = { log, flush, markCorrected, getSessionId: () => sessionId };
})();