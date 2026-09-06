// Storage message handler.
// All chrome.storage.local access is owned by this module (via storageHelpers.js).
// background.js receives the message and calls handleStorageMessage() instead of touching storage itself, keeping background.js focused on routing.

import * as storageHelpers from "../utils/storageHelpers.js";
import { MESSAGE_TYPES } from "../utils/constants.js";

export async function handleStorageMessage(message) {
  switch (message.type) {
    case MESSAGE_TYPES.GET_CALIBRATION:
      return { ok: true, data: await storageHelpers.getCalibration() };

    case MESSAGE_TYPES.SAVE_CALIBRATION:
      return { ok: await storageHelpers.saveCalibration(message.payload) };

    case MESSAGE_TYPES.GET_THRESHOLDS:
      return { ok: true, data: await storageHelpers.getThresholds() };

    case MESSAGE_TYPES.SAVE_THRESHOLDS:
      return { ok: await storageHelpers.saveThresholds(message.payload) };

    case MESSAGE_TYPES.APPEND_GESTURE_LOG:
      return { ok: true, data: await storageHelpers.appendGestureLog(message.payload) };

    case MESSAGE_TYPES.GET_GESTURE_LOGS:
      return { ok: true, data: await storageHelpers.getGestureLogs(message.payload?.sessionId) };

    case MESSAGE_TYPES.CLEAR_LOGS:
      return { ok: await storageHelpers.clearLogs() };

    case MESSAGE_TYPES.GET_EXTENSION_STATE:
      return { ok: true, data: await storageHelpers.getExtensionEnabled() };

    case MESSAGE_TYPES.SAVE_EXTENSION_STATE:
      return { ok: await storageHelpers.saveExtensionEnabled(message.payload) };

    default:
      return { ok: false, error: `Unknown storage message type: ${message.type}` };
  }
}