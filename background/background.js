// background/background.js
// Routes messages between popup <-> content scripts <-> storage.
// Does NOT do heavy computation

import { MESSAGE_TYPES } from "../utils/constants.js";
import { handleStorageMessage } from "./storage.js";

console.log("[GestureRead] background service worker started.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("[GestureRead] background service worker installed");
});

const STORAGE_MESSAGE_TYPES = new Set([
  MESSAGE_TYPES.GET_CALIBRATION,
  MESSAGE_TYPES.SAVE_CALIBRATION,
  MESSAGE_TYPES.GET_THRESHOLDS,
  MESSAGE_TYPES.SAVE_THRESHOLDS,
  MESSAGE_TYPES.APPEND_GESTURE_LOG,
  MESSAGE_TYPES.GET_GESTURE_LOGS,
  MESSAGE_TYPES.CLEAR_LOGS,
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const from = sender.tab ? `tab ${sender.tab.id}` : "popup";
  console.log("[GestureRead] background received message:", message, "from", from);

  if (message.type === MESSAGE_TYPES.PING_FROM_POPUP) {
    sendResponse({ ok: true, message: "pong from background" });
    return false; // synchronous response, no need to keep the channel open
  }

  if (message.type === MESSAGE_TYPES.CONTENT_SCRIPT_READY) {
    sendResponse({ ok: true, message: `background acknowledged content script on ${message.payload?.url}` });
    return false;
  }

  if (STORAGE_MESSAGE_TYPES.has(message.type)) {
    handleStorageMessage(message)
      .then(sendResponse)
      .catch((err) => {
        console.error("[GestureRead] storage message failed:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep the channel open for the async response above
  }

  sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
  return false;
});