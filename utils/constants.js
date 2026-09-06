// For storage keys and message type strings.

export const STORAGE_KEYS = {
  CALIBRATION_PROFILE: "calibrationProfile",
  GESTURE_THRESHOLDS: "gestureThresholds",
  GESTURE_LOGS: "gestureLogs",
  SESSION_HISTORY: "sessionHistory",
  USER_PREFERENCES: "userPreferences",
  LLM_MODEL: "llmModel",
  EXTENSION_ENABLED: "extensionEnabled",
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
  GET_EXTENSION_STATE: "GET_EXTENSION_STATE",   
  SAVE_EXTENSION_STATE: "SAVE_EXTENSION_STATE", 
};

// Cap on stored gesture log entries, trims oldest logs so we never hit chrome.storage.local's quota mid-session.
export const MAX_GESTURE_LOGS = 500;

export const MAX_NOTIFICATIONS = 2;
export const NOTIFICATION_DISMISS_MS = 3000;

// Gesture tuning
export const PINCH_ENTER = 0.08; // normalized thumb–index distance to engage pinch
export const PINCH_EXIT = 0.18;  // must open back out past this before pinch disengages

// Brightness gesture tuning
export const BRIGHTNESS_MOVE_THRESHOLD = 0.008; // normalized thumb-tip Y movement per frame to register a change
export const BRIGHTNESS_SENSITIVITY = 2.5;       // multiplier translating thumb movement into a brightness delta

export const POINT_HOLD_MS = 800; // how long "point" must hold before it's confirmed

// Toggle gesture tuning
export const TOGGLE_HOLD_MS = 2000; // peace-sign hold duration required to flip on/off