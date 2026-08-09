// For storage keys and message type strings.

export const STORAGE_KEYS = {
  CALIBRATION_PROFILE: "calibrationProfile",
  GESTURE_THRESHOLDS: "gestureThresholds",
  GESTURE_LOGS: "gestureLogs",
  SESSION_HISTORY: "sessionHistory",
  USER_PREFERENCES: "userPreferences",
  LLM_MODEL: "llmModel",
};

export const MESSAGE_TYPES = {
  PING_FROM_POPUP: "PING_FROM_POPUP",
  CONTENT_SCRIPT_READY: "CONTENT_SCRIPT_READY",
  GET_CALIBRATION: "GET_CALIBRATION",
  SAVE_CALIBRATION: "SAVE_CALIBRATION",
  GET_THRESHOLDS: "GET_THRESHOLDS",
  SAVE_THRESHOLDS: "SAVE_THRESHOLDS",
  APPEND_GESTURE_LOG: "APPEND_GESTURE_LOG",
  GET_GESTURE_LOGS: "GET_GESTURE_LOGS",
  CLEAR_LOGS: "CLEAR_LOGS",
};

// Cap on stored gesture log entries — trims oldest logs so we never hit
// chrome.storage.local's quota mid-session.
export const MAX_GESTURE_LOGS = 500;

export const MAX_NOTIFICATIONS = 2;
export const NOTIFICATION_DISMISS_MS = 3000;