import { MESSAGE_TYPES } from "../utils/constants.js";

const COUNTDOWN_MS = 3000;
const CAPTURE_DURATION_MS = 3000;

const targetTabId = Number(new URLSearchParams(location.search).get("tabId"));

const STEPS = [
  { id: "scroll", label: "Scroll", emoji: "🖐️",
    instructions: "Hold your hand open, palm facing the camera, fingers spread, and move it slowly up and down.",
    extractSignal: (lm) => lm[0].y },
  { id: "pinch", label: "Zoom (Pinch)", emoji: "🤏",
    instructions: "Bring your thumb and index finger together like you're pinching something, and hold it.",
    extractSignal: (lm) => euclideanDistance(lm[4], lm[8]) },
  { id: "brightness", label: "Brightness", emoji: "👍",
    instructions: "Make a fist with just your thumb sticking out, then move your thumb up and down.",
    extractSignal: (lm) => lm[4].y },
  { id: "point", label: "Point", emoji: "👆",
    instructions: "Extend only your index finger, other fingers curled, and hold still.",
    extractSignal: null },
  { id: "fist", label: "Fist", emoji: "✊",
    instructions: "Curl all fingers into a closed fist and hold still.",
    extractSignal: null },
  { id: "toggle", label: "On/Off Toggle", emoji: "✌️",
    instructions: "Hold up a peace sign — index and middle extended, ring and pinky curled — and hold it steady.",
    extractSignal: null },
];

let currentStep = 0;
let isCapturing = false;
let capturedThisStep = false;
let liveSamples = [];
let results = STEPS.map((s) => ({ id: s.id, skipped: true, samples: [] }));

const els = {};

function cacheElements() {
  els.stepLabel = document.getElementById("gr-step-label");
  els.progressDots = document.getElementById("gr-progress-dots");
  els.emoji = document.getElementById("gr-gesture-emoji");
  els.title = document.getElementById("gr-gesture-title");
  els.instructions = document.getElementById("gr-gesture-instructions");
  els.countdown = document.getElementById("gr-countdown");
  els.backBtn = document.getElementById("gr-back-btn");
  els.skipBtn = document.getElementById("gr-skip-btn");
  els.nextBtn = document.getElementById("gr-next-btn");
  els.doneScreen = document.getElementById("gr-done-screen");
  els.wizard = document.getElementById("gr-wizard");
  els.recalibrateBtn = document.getElementById("gr-recalibrate-btn");
}

function renderProgressDots() {
  els.progressDots.innerHTML = "";
  STEPS.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "gr-dot" + (i === currentStep ? " gr-dot-active" : i < currentStep ? " gr-dot-done" : "");
    els.progressDots.appendChild(dot);
  });
}

function renderStep() {
  const step = STEPS[currentStep];
  capturedThisStep = false;
  els.stepLabel.textContent = `Step ${currentStep + 1} of ${STEPS.length}`;
  els.emoji.textContent = step.emoji;
  els.title.textContent = step.label;
  els.instructions.textContent = step.instructions;
  els.countdown.textContent = "";
  els.backBtn.disabled = currentStep === 0 || isCapturing;
  els.skipBtn.disabled = isCapturing;
  els.nextBtn.disabled = false;
  els.nextBtn.textContent = "Capture";
  renderProgressDots();

  els.emoji.classList.remove("gr-pulse");
  void els.emoji.offsetWidth;
  els.emoji.classList.add("gr-pulse");
}

function advance() {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    renderStep();
  } else {
    finishWizard();
  }
}

function goSkip() {
  if (isCapturing) return;
  results[currentStep].skipped = true;
  advance();
}

function goBack() {
  if (currentStep > 0 && !isCapturing) {
    currentStep--;
    renderStep();
  }
}

// Single entry point for the Next button. Before a capture exists for this step, it captures.
// Once it does, it advances. 
function handleNextClick() {
  if (isCapturing) return;
  if (!capturedThisStep) {
    goCapture();
  } else {
    advance();
  }
}

async function goCapture() {
  if (isCapturing || !targetTabId) {
    if (!targetTabId) console.error("[GestureRead] no tabId in URL — open this page via the popup's Calibrate button.");
    return;
  }
  const stepIndexAtStart = currentStep; // snapshot — guards against currentStep changing mid-capture
  isCapturing = true;
  els.nextBtn.disabled = true;
  els.skipBtn.disabled = true;
  els.backBtn.disabled = true;

  for (let s = Math.ceil(COUNTDOWN_MS / 1000); s > 0; s--) {
    els.countdown.textContent = `Get ready… ${s}`;
    await sleep(1000);
  }

  liveSamples = [];
  await chrome.tabs.sendMessage(targetTabId, { type: MESSAGE_TYPES.START_CALIBRATION_CAPTURE });

  const liveCounterInterval = setInterval(() => {
    els.countdown.textContent = `Recording — hold the pose! (${liveSamples.length} frames)`;
  }, 150);

  await sleep(CAPTURE_DURATION_MS);
  clearInterval(liveCounterInterval);
  await chrome.tabs.sendMessage(targetTabId, { type: MESSAGE_TYPES.STOP_CALIBRATION_CAPTURE });

  const step = STEPS[stepIndexAtStart];
  const samples = step.extractSignal
    ? liveSamples.map(step.extractSignal).filter((v) => typeof v === "number")
    : liveSamples;

  results[stepIndexAtStart] = { id: step.id, skipped: false, samples };
  isCapturing = false;

  if (stepIndexAtStart !== currentStep) return;

  els.countdown.textContent = `✓ Captured ${liveSamples.length} frames`;
  capturedThisStep = true;
  els.nextBtn.disabled = false;
  els.nextBtn.textContent = currentStep === STEPS.length - 1 ? "Finish" : "Next →";
  els.backBtn.disabled = false;
  els.skipBtn.disabled = false;
}

function computeThresholds() {
  const profile = { calibratedAt: Date.now(), skipped: results.filter((r) => r.skipped).map((r) => r.id) };

  const pinch = results.find((r) => r.id === "pinch");
  if (pinch && !pinch.skipped && pinch.samples.length > 0) {
    const mean = rollingMean(pinch.samples);
    profile.pinchEnter = Number((mean * 1.15).toFixed(4));
    profile.pinchExit = Number((mean * 2.5).toFixed(4));
  }

  const brightness = results.find((r) => r.id === "brightness");
  if (brightness && !brightness.skipped && brightness.samples.length > 1) {
    const sd = standardDeviation(brightness.samples);
    profile.brightnessMoveThreshold = Number(Math.max(sd * 0.5, 0.004).toFixed(4));
  }

  const scroll = results.find((r) => r.id === "scroll");
  if (scroll && !scroll.skipped && scroll.samples.length > 1) {
    profile.scrollJitterBaseline = Number(standardDeviation(scroll.samples).toFixed(4));
  }

  return profile;
}

async function finishWizard() {
  els.wizard.classList.add("gr-hidden");
  els.doneScreen.classList.remove("gr-hidden");

  const profile = computeThresholds();
  console.log("[GestureRead] personalized thresholds:", profile);

  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SAVE_CALIBRATION, payload: profile });
    console.log("[GestureRead] calibration saved:", response);

    if (targetTabId) {
      try {
        await chrome.tabs.sendMessage(targetTabId, { type: MESSAGE_TYPES.CALIBRATION_UPDATED });
        console.log("[GestureRead] notified tab", targetTabId, "to reload calibration");
      } catch (err) {
        console.warn("[GestureRead] could not notify tab to reload calibration:", err.message);
      }
    }
  } catch (err) {
    console.error("[GestureRead] failed to save calibration:", err);
  }
}

function restartWizard() {
  currentStep = 0;
  results = STEPS.map((s) => ({ id: s.id, skipped: true, samples: [] }));
  els.doneScreen.classList.add("gr-hidden");
  els.wizard.classList.remove("gr-hidden");
  renderStep();
}

function handleLandmarkMessage(message, sender) {
  if (message.type !== MESSAGE_TYPES.CALIBRATION_LANDMARK_FRAME) return;
  if (sender.tab?.id !== targetTabId) return;
  if (!isCapturing) return;
  if (message.payload?.landmarks) liveSamples.push(message.payload.landmarks);
}

function init() {
  cacheElements();
  els.backBtn.addEventListener("click", goBack);
  els.skipBtn.addEventListener("click", goSkip);
  els.nextBtn.addEventListener("click", handleNextClick); // single listener
  els.recalibrateBtn.addEventListener("click", restartWizard);
  chrome.runtime.onMessage.addListener(handleLandmarkMessage);
  renderStep();
  window.addEventListener("beforeunload", () => {
    if (isCapturing && targetTabId) {
      chrome.tabs.sendMessage(targetTabId, { type: MESSAGE_TYPES.STOP_CALIBRATION_CAPTURE });
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

document.addEventListener("DOMContentLoaded", init);