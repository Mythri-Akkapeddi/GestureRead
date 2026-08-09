// Low-level wrappers around chrome.storage.local. It just reads/writes storage safely.
// Other modules should not directly manipulate storage keys. They should use these functions instead.
// This gives GestureRead one consistent storage layer.


import { STORAGE_KEYS, MAX_GESTURE_LOGS } from "./constants.js";

async function getValue(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] !== undefined ? result[key] : fallback;
}

// async function getValue(key, fallback = null) {
//     try {
//         const result = await chrome.storage.local.get(key);
//         if (result[key] === undefined) {
//             return fallback;
//         }
//         return result[key];
//     } catch (error) {
//         console.error(`[GestureRead] Failed to read storage key "${key}":`, error);
//         return fallback;
//     }
// }

async function setValue(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (err) {
    console.error(`[GestureRead] storage.set failed for "${key}":`, err);
    return false;
  }
}

// --- Calibration ---
export async function getCalibration() {
  return getValue(STORAGE_KEYS.CALIBRATION_PROFILE, null);
}
export async function saveCalibration(profile) {
  return setValue(STORAGE_KEYS.CALIBRATION_PROFILE, profile);
}

// --- Thresholds ---
export async function getThresholds() {
  return getValue(STORAGE_KEYS.GESTURE_THRESHOLDS, null);
}
export async function saveThresholds(thresholds) {
  return setValue(STORAGE_KEYS.GESTURE_THRESHOLDS, thresholds);
}

// --- Gesture logs ---
export async function appendGestureLog(entry) {
  const logs = await getValue(STORAGE_KEYS.GESTURE_LOGS, []);
  logs.push(entry);

  const trimmed =
    logs.length > MAX_GESTURE_LOGS ? logs.slice(logs.length - MAX_GESTURE_LOGS) : logs;

  const ok = await setValue(STORAGE_KEYS.GESTURE_LOGS, trimmed);
  if (!ok) {
    // Likely a quota error — trim harder and retry once.
    console.warn("[GestureRead] Storage write failed. Attempting emergency trim.");
    const emergencyTrim = trimmed.slice(Math.floor(trimmed.length / 2));
    await setValue(STORAGE_KEYS.GESTURE_LOGS, emergencyTrim);
    return emergencyTrim;
  }
  return trimmed;
}

export async function getGestureLogs(sessionId) {
  const logs = await getValue(STORAGE_KEYS.GESTURE_LOGS, []);
  if (!sessionId) return logs;
  return logs.filter((log) => log.sessionId === sessionId);
}

export async function clearLogs() {
  return setValue(STORAGE_KEYS.GESTURE_LOGS, []);
}

// --- User preferences ---
export async function getUserPreferences() {
  return getValue(STORAGE_KEYS.USER_PREFERENCES, {});
}
export async function saveUserPreferences(prefs) {
  return setValue(STORAGE_KEYS.USER_PREFERENCES, prefs);
}

// --- Session history ---
export async function getSessionHistory() {
  return getValue(STORAGE_KEYS.SESSION_HISTORY, []);
}
export async function saveSessionHistory(history) {
  return setValue(STORAGE_KEYS.SESSION_HISTORY, history);
}

// --- LLM model choice ---
export async function getLLMModel() {
  return getValue(STORAGE_KEYS.LLM_MODEL, null);
}
export async function saveLLMModel(model) {
  return setValue(STORAGE_KEYS.LLM_MODEL, model);
}