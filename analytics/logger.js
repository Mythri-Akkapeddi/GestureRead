// Runs in the content script's isolated world, loaded before gestureEngine.js so window.GestureReadLogger exists by the time any gesture fires.
// No import/export but still uses a dynamic import() for constants.js since that works in any script type.
// Buffers gesture events client-side and flushes them to background in batches so that it doesn't hit chrome.storage.local on every single trigger.

(async function () {
  const { MESSAGE_TYPES } = await import(chrome.runtime.getURL("utils/constants.js"));

  const FLUSH_INTERVAL_MS = 2000;
  const MAX_BUFFER_SIZE = 50; // flush early if this fills up, instead of waiting for the timer

  const sessionId = generateSessionId(); // from utils/helpers.js, one session per page load
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
  window.addEventListener("pagehide", flush); // best-effort flush on navigation/tab close

  window.GestureReadLogger = { log, flush, getSessionId: () => sessionId };
})();