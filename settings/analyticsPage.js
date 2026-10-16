import { computeSummary } from "../analytics/metrics.js";

const els = {};

function cacheElements() {
  els.tabCalibrationBtn = document.getElementById("gr-tab-btn-calibration");
  els.tabAnalyticsBtn = document.getElementById("gr-tab-btn-analytics");
  els.tabCalibration = document.getElementById("gr-tab-calibration");
  els.tabAnalytics = document.getElementById("gr-tab-analytics");

  els.cardTriggers = document.getElementById("gr-card-triggers");
  els.cardSuccess = document.getElementById("gr-card-success");
  els.cardFalseTriggers = document.getElementById("gr-card-false-triggers");
  els.progressBar = document.getElementById("gr-progress-bar-fill");
  els.progressLabel = document.getElementById("gr-progress-label");
  els.perGestureList = document.getElementById("gr-per-gesture-list");

  els.advancedToggle = document.getElementById("gr-advanced-toggle");
  els.advancedBody = document.getElementById("gr-advanced-body");
  els.refreshBtn = document.getElementById("gr-refresh-btn");
}

function switchTab(tab) {
  const isAnalytics = tab === "analytics";
  els.tabAnalytics.classList.toggle("gr-hidden", !isAnalytics);
  els.tabCalibration.classList.toggle("gr-hidden", isAnalytics);
  els.tabAnalyticsBtn.classList.toggle("gr-tab-active", isAnalytics);
  els.tabCalibrationBtn.classList.toggle("gr-tab-active", !isAnalytics);
  if (isAnalytics) renderDashboard();
}

async function renderDashboard() {
  const summary = await computeSummary();

  els.cardTriggers.textContent = String(summary.totalTriggers);
  els.cardSuccess.textContent = `${Math.round(summary.successRate * 100)}%`;
  els.cardFalseTriggers.textContent = String(summary.totalFalseTriggers);

  const pct = Math.round(summary.learningProgress * 100);
  els.progressBar.style.width = `${pct}%`;
  els.progressLabel.textContent = `Learning Progress ${pct}%`;

  els.perGestureList.innerHTML = "";
  for (const [gesture, stats] of Object.entries(summary.perGesture)) {
    const li = document.createElement("li");
    li.textContent = `${capitalize(gesture)}: ${stats.triggers} triggers, ${Math.round(stats.successRate * 100)}% success`;
    els.perGestureList.appendChild(li);
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function init() {
  cacheElements();
  els.tabCalibrationBtn.addEventListener("click", () => switchTab("calibration"));
  els.tabAnalyticsBtn.addEventListener("click", () => switchTab("analytics"));
  els.advancedToggle.addEventListener("click", () => {
    els.advancedBody.classList.toggle("gr-hidden");
  });
  els.refreshBtn.addEventListener("click", renderDashboard);
}

document.addEventListener("DOMContentLoaded", init);