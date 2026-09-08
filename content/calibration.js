// Runs in the content script's isolated world (same constraint as gestureEngine.js, so constants.js is loaded via dynamic import, not a static import).
// Two responsibilities:
// 1) On load, ask background for a saved calibration profile and hand it to applyCalibration().
//    applyCalibration is a stub, gestureEngine.js doesn't read personalized thresholds yet.
// 2) While the calibration wizard (settings.html) is capturing a gesture on THIS tab, relay live
//    landmark frames from the "gestureread:landmarks" window event out via chrome.runtime.sendMessage,
//    so calibrationPage.js (a normal extension page) can read them directly.

(async function () {
  const { MESSAGE_TYPES } = await import(chrome.runtime.getURL("utils/constants.js"));

  let capturing = false;

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
    if (!profile) {
      console.log("[GestureRead] no saved calibration profile — using default thresholds.");
      return;
    }
    // Stub, later day wires this into gestureEngine.js's live thresholds.
    console.log("[GestureRead] loaded calibration profile (not yet applied to gestureEngine):", profile);
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
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.STOP_CALIBRATION_CAPTURE) {
      capturing = false;
      sendResponse({ ok: true });
      return false;
    }
    return false; // let content.js's own listener (if any) handle other types
  });

  window.addEventListener("gestureread:landmarks", handleLandmarksFrame);

  loadCalibration().then(applyCalibration);
})();