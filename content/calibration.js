// Runs in the content script's isolated world.
// 1) On load, fetches the saved calibration profile and merges it over the hardcoded defaults from constants.js, exposing the merged thresholds via window.GestureReadCalibration 
//    so gestureEngine.js can read live-calibrated values instead of the constants directly.
// 2) Listens for CALIBRATION_UPDATED (sent by calibrationPage.js right after a save) and
//    reloads, so a recalibration takes effect on this tab without a page refresh.
// 3) While the calibration wizard is capturing a gesture on THIS tab, relays live landmark
//    frames out via chrome.runtime.sendMessage so calibrationPage.js can read them directly.

(async function () {
  const {
    MESSAGE_TYPES,
    PINCH_ENTER,
    PINCH_EXIT,
    BRIGHTNESS_MOVE_THRESHOLD,
  } = await import(chrome.runtime.getURL("utils/constants.js"));

  const DEFAULT_THRESHOLDS = {
    pinchEnter: PINCH_ENTER,
    pinchExit: PINCH_EXIT,
    brightnessMoveThreshold: BRIGHTNESS_MOVE_THRESHOLD,
  };

  let capturing = false;
  let currentThresholds = { ...DEFAULT_THRESHOLDS };

  function mergeThresholds(profile) {
    if (!profile) return { ...DEFAULT_THRESHOLDS };
    return {
      pinchEnter: typeof profile.pinchEnter === "number" ? profile.pinchEnter : DEFAULT_THRESHOLDS.pinchEnter,
      pinchExit: typeof profile.pinchExit === "number" ? profile.pinchExit : DEFAULT_THRESHOLDS.pinchExit,
      brightnessMoveThreshold:
        typeof profile.brightnessMoveThreshold === "number"
          ? profile.brightnessMoveThreshold
          : DEFAULT_THRESHOLDS.brightnessMoveThreshold,
    };
  }

  async function loadCalibration() {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_CALIBRATION });
      if (!response?.ok) {
        console.warn("[GestureRead] failed to load calibration:", response?.error);
        return null;
      }
      return response.data; // null if never calibrated
    } catch (err) {
      console.error("[GestureRead] loadCalibration failed:", err);
      return null;
    }
  }

  function applyCalibration(profile) {
    currentThresholds = mergeThresholds(profile);
    if (!profile) {
      console.log("[GestureRead] no saved calibration profile — using default thresholds:", currentThresholds);
      return;
    }
    console.log("[GestureRead] calibration profile applied:", currentThresholds);
  }

  async function reloadCalibration() {
    applyCalibration(await loadCalibration());
  }

  function handleLandmarksFrame(event) {
    if (!capturing) return;
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CALIBRATION_LANDMARK_FRAME,
      payload: { landmarks: event.detail?.landmarks ?? null },
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.START_CALIBRATION_CAPTURE) {
      capturing = true;
      window.GestureReadGestureEngine?.pauseForCalibration();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.STOP_CALIBRATION_CAPTURE) {
      capturing = false;
      window.GestureReadGestureEngine?.resumeFromCalibration();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.CALIBRATION_UPDATED) {
      reloadCalibration();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  window.addEventListener("gestureread:landmarks", handleLandmarksFrame);

  window.GestureReadCalibration = {
    getThresholds: () => currentThresholds,
  };

  reloadCalibration();
})();