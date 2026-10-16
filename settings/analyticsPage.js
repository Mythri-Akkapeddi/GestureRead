import { computeSummary } from "../analytics/metrics.js";
import { buildConfusionMatrix } from "../analytics/confusionMatrix.js";
import { exportLogsAsJSON, exportLogsAsCSV } from "../analytics/export.js";
import { getGestureLogs, getThresholdHistory } from "../utils/storageHelpers.js";

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

  await renderAdvanced();
}

async function renderAdvanced() {
  const [matrix, logs, history] = await Promise.all([
    buildConfusionMatrix(),
    getGestureLogs(),
    getThresholdHistory(),
  ]);

  renderConfusionTable(matrix);
  renderSessionList(buildSessionSummary(logs)); // global from analytics/reports.js
  drawThresholdChart(document.getElementById("gr-threshold-chart"), history);
  drawConfidenceHistogram(document.getElementById("gr-confidence-chart"), logs);
}

function renderConfusionTable(matrix) {
  let html = "<table class='gr-matrix'><thead><tr><th>Gesture</th><th>Correct</th><th>False trigger</th>" +
    "<th>Precision</th><th>Recall</th><th>F1</th></tr></thead><tbody>";
  for (const [gesture, m] of Object.entries(matrix)) {
    const color = m.precision >= 0.9 ? "#22c55e" : m.precision >= 0.7 ? "#facc15" : "#ef4444";
    html += `<tr><td>${capitalize(gesture)}</td><td>${m.tp}</td><td>${m.fp}</td>` +
      `<td style="color:${color}">${(m.precision * 100).toFixed(0)}%</td>` +
      `<td style="color:${color}">${(m.recall * 100).toFixed(0)}%</td>` +
      `<td style="color:${color}">${(m.f1 * 100).toFixed(0)}%</td></tr>`;
  }
  html += "</tbody></table>";
  document.getElementById("gr-confusion-table").innerHTML = html;
}

function renderSessionList(sessions) {
  const el = document.getElementById("gr-session-list");
  el.innerHTML = "";
  if (sessions.length === 0) {
    el.innerHTML = "<li>No sessions recorded yet.</li>";
    return;
  }
  for (const s of sessions.slice(0, 20)) {
    const li = document.createElement("li");
    const duration = formatDuration(s.lastTimestamp - s.firstTimestamp);
    li.textContent = `${new Date(s.firstTimestamp).toLocaleString()} — ${s.eventCount} events, ${s.correctedCount} corrected, ${duration}`;
    el.appendChild(li);
  }
}

// --- hand-rolled canvas charts — no CDN libraries, extension_pages CSP blocks remote scripts ---

function drawThresholdChart(canvas, history) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (history.length === 0) {
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("No threshold adaptations yet.", 10, 20);
    return;
  }

  const padding = 24;
  const w = canvas.width - padding * 2;
  const h = canvas.height - padding * 2;
  const points = history.slice(-50);
  const minM = Math.min(...points.map((p) => p.multiplier));
  const maxM = Math.max(...points.map((p) => p.multiplier));
  const range = maxM - minM || 1;

  ctx.strokeStyle = "#374151";
  ctx.strokeRect(padding, padding, w, h);

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * w;
    const y = padding + h - ((p.multiplier - minM) / range) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#f9fafb";
  ctx.font = "11px sans-serif";
  ctx.fillText(maxM.toFixed(2), 2, padding + 4);
  ctx.fillText(minM.toFixed(2), 2, padding + h);
}

function drawConfidenceHistogram(canvas, logs) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const confidences = logs.map((l) => l.confidence).filter((c) => typeof c === "number");
  if (confidences.length === 0) {
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("No confidence data yet.", 10, 20);
    return;
  }

  const bucketCount = 5;
  const buckets = new Array(bucketCount).fill(0);
  for (const c of confidences) {
    buckets[Math.min(bucketCount - 1, Math.floor(c * bucketCount))]++;
  }

  const padding = 24;
  const w = canvas.width - padding * 2;
  const h = canvas.height - padding * 2;
  const maxCount = Math.max(...buckets, 1);
  const barWidth = w / bucketCount;

  ctx.strokeStyle = "#374151";
  ctx.strokeRect(padding, padding, w, h);

  buckets.forEach((count, i) => {
    const barHeight = (count / maxCount) * h;
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(padding + i * barWidth + 4, padding + h - barHeight, barWidth - 8, barHeight);
  });

  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px sans-serif";
  for (let i = 0; i < bucketCount; i++) {
    ctx.fillText(`${i * 20}-${(i + 1) * 20}%`, padding + i * barWidth, padding + h + 14);
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

function init() {
  cacheElements();
  els.tabCalibrationBtn.addEventListener("click", () => switchTab("calibration"));
  els.tabAnalyticsBtn.addEventListener("click", () => switchTab("analytics"));
  els.advancedToggle.addEventListener("click", () => {
    els.advancedBody.classList.toggle("gr-hidden");
  });
  document.getElementById("gr-export-json-btn").addEventListener("click", exportLogsAsJSON);
  document.getElementById("gr-export-csv-btn").addEventListener("click", exportLogsAsCSV);
  els.refreshBtn.addEventListener("click", renderDashboard);
}

document.addEventListener("DOMContentLoaded", init);