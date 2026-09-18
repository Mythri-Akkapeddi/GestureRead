// Owns the persisted history of adaptive-threshold adjustments.
// background.js routes THRESHOLD_ADAPTED here instead of touching storage directly, same pattern analyticsManager.js uses for gesture log batches.

import * as storageHelpers from "../utils/storageHelpers.js";

export async function handleThresholdAdapted(message) {
  const entry = message.payload;
  if (!entry || typeof entry.gesture !== "string") {
    return { ok: false, error: "THRESHOLD_ADAPTED payload missing a valid entry" };
  }

  const history = await storageHelpers.appendThresholdHistory(entry);
  return { ok: true, data: { historyLength: history.length } };
}