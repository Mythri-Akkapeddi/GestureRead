// Owns gesture-log batch ingestion + running counters.
// background.js routes LOG_GESTURE_BATCH here instead of touching storage/counters directly, like background/storage.js.

import * as storageHelpers from "../utils/storageHelpers.js";

export async function handleGestureLogBatch(message) {
  const entries = message.payload?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: "LOG_GESTURE_BATCH payload missing entries[]" };
  }

  const savedLogs = await storageHelpers.appendGestureLogs(entries);
  const counters = await storageHelpers.incrementGestureCounters(entries);

  return { ok: true, data: { storedCount: savedLogs.length, counters } };
}