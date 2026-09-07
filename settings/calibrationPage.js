const STEPS = [
  { id: "scroll", label: "Scroll", emoji: "🖐️",
    instructions: "Hold your hand open, palm facing the camera, fingers spread. This is the pose used to scroll." },
  { id: "pinch", label: "Zoom (Pinch)", emoji: "🤏",
    instructions: "Bring your thumb and index finger together like you're pinching something. Used to zoom text in and out." },
  { id: "brightness", label: "Brightness", emoji: "👍",
    instructions: "Make a fist with just your thumb sticking out. Moving your thumb up/down adjusts screen brightness." },
  { id: "point", label: "Point", emoji: "👆",
    instructions: "Extend only your index finger, other fingers curled. Used to point at content." },
  { id: "fist", label: "Fist", emoji: "✊",
    instructions: "Curl all fingers into a closed fist. Reserved for future correction actions." },
  { id: "toggle", label: "On/Off Toggle", emoji: "✌️",
    instructions: "Hold up a peace sign — index and middle extended, ring and pinky curled — for 2 seconds to turn GestureRead on or off." },
];

let currentStep = 0;
const results = STEPS.map((s) => ({ id: s.id, skipped: true })); // Day 16 fills this in for real

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
  els.stepLabel.textContent = `Step ${currentStep + 1} of ${STEPS.length}`;
  els.emoji.textContent = step.emoji;
  els.title.textContent = step.label;
  els.instructions.textContent = step.instructions;
  els.countdown.textContent = "";
  els.backBtn.disabled = currentStep === 0;
  els.nextBtn.textContent = currentStep === STEPS.length - 1 ? "Finish" : "Next";
  renderProgressDots();

  els.emoji.classList.remove("gr-pulse");
  void els.emoji.offsetWidth; // restart the CSS animation
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

function goNext() {
  results[currentStep].skipped = false;
  advance();
}

function goSkip() {
  results[currentStep].skipped = true;
  advance();
}

function goBack() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function finishWizard() {
  els.wizard.classList.add("gr-hidden");
  els.doneScreen.classList.remove("gr-hidden");
  console.log("[GestureRead] calibration wizard finished:", results);
}

function init() {
  cacheElements();
  els.backBtn.addEventListener("click", goBack);
  els.skipBtn.addEventListener("click", goSkip);
  els.nextBtn.addEventListener("click", goNext);
  renderStep();
}

document.addEventListener("DOMContentLoaded", init);