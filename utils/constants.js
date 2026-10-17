// For storage keys and message type strings.

export const STORAGE_KEYS = {
  CALIBRATION_PROFILE: "calibrationProfile",
  GESTURE_THRESHOLDS: "gestureThresholds",
  GESTURE_LOGS: "gestureLogs",
  SESSION_HISTORY: "sessionHistory",
  USER_PREFERENCES: "userPreferences",
  LLM_MODEL: "llmModel",
  EXTENSION_ENABLED: "extensionEnabled",
  GESTURE_COUNTERS: "gestureCounters",
  THRESHOLD_HISTORY: "thresholdHistory",
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
  START_CALIBRATION_CAPTURE: "START_CALIBRATION_CAPTURE",
  STOP_CALIBRATION_CAPTURE: "STOP_CALIBRATION_CAPTURE",
  CALIBRATION_LANDMARK_FRAME: "CALIBRATION_LANDMARK_FRAME",
  CALIBRATION_UPDATED: "CALIBRATION_UPDATED", // to reload thresholds
  LOG_GESTURE_BATCH: "LOG_GESTURE_BATCH", 
  THRESHOLD_ADAPTED: "THRESHOLD_ADAPTED",
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

// Adaptive threshold engine tuning
export const FP_WINDOW_MS = 60000;             // rolling window used to compute the false-positive rate
export const FP_CHECK_INTERVAL_MS = 60000;     // how often the adaptive engine re-evaluates
export const FP_THRESHOLD_RATE = 0.3;          // tighten if FP rate above this
export const FP_LOOSEN_RATE = 0.1;             // loosen if FP rate below this
export const MIN_INTENTIONAL_GESTURE_MS = 400; // if engage->release faster than this then treated as accidental
export const MIN_SAMPLES_FOR_ADAPTATION = 5;   // don't trust a rate computed from too few cycles
export const ADAPTIVE_TIGHTEN_STEP = 0.05;     // 5% tighten per cycle
export const ADAPTIVE_LOOSEN_STEP = 0.025;     // loosens more slowly than it tightens
export const ADAPTIVE_MIN_MULTIPLIER = 0.5;    // hard floor
export const ADAPTIVE_MAX_MULTIPLIER = 1.5;    // hard ceiling

// Threshold adaptation persistence
export const MAX_THRESHOLD_HISTORY = 100; // cap so this never grows unbounded in storage

// Fatigue detection tuning
export const FATIGUE_BASELINE_SECONDS = 60;       // first 60s of variance readings become this user's personal baseline
export const FATIGUE_CHECK_INTERVAL_MS = 2000;    // how often to recompute/log the fatigue score once baseline is set
export const FATIGUE_MULTIPLIER_THRESHOLD = 2.0;  // score at/above this multiplier = flagged as fatigued
export const FATIGUE_POSITION_WEIGHT = 0.5;       // weight of position variance in the combined score
export const FATIGUE_VELOCITY_WEIGHT = 0.5;       // weight of velocity variance in the combined score

// Fatigue nudge 
export const FATIGUE_NUDGE_TIMEOUT_MS = 8000;       // how long the nudge stays up before auto-dismissing for later
export const FATIGUE_NUDGE_RESET_MULTIPLIER = 1.5;  // score must drop back below this before a new nudge can fire again (hysteresis, avoids flicker right at the threshold)

// "Wrong gesture?" undo workflow 
export const CORRECTION_WINDOW_MS = 4000;            // how long the undo prompt stays available after a gesture releases
export const CORRECTION_MIN_SCROLL_DELTA = 20;       // ignore trivial scrolls, not worth prompting
export const CORRECTION_MIN_ZOOM_DELTA = 0.03;       // zoom multiplier units
export const CORRECTION_MIN_BRIGHTNESS_DELTA = 0.03; // brightness units (0–1 scale)

// LLM backend
export const WEBLLM_MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"; // Apache-2.0, no usage restrictions
export const OLLAMA_DEFAULT_MODEL = "qwen2.5:1.5b";                  // same license, same model family
export const OLLAMA_DEFAULT_ENDPOINT = "http://localhost:11434";

STORAGE_KEYS.LLM_BACKEND = "llmBackend";       // "webllm" | "ollama" | "auto"
STORAGE_KEYS.OLLAMA_ENDPOINT = "ollamaEndpoint";

MESSAGE_TYPES.ANALYZE_PAGE = "ANALYZE_PAGE";
MESSAGE_TYPES.LLM_TEST_REQUEST = "LLM_TEST_REQUEST";