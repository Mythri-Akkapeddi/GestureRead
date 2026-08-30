// Small math helpers shared by gestureEngine.js and later fatigueMonitor.js
// No import/export, loaded before overlayController.js / gestureEngine.js by manifest.json.

function euclideanDistance(a, b) {
  // a, b are MediaPipe landmark objects: { x, y, z } in normalized [0,1] coords.
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function standardDeviation(values) {
  // Used properly by fatigueMonitor.js (wrist position / velocity variance).
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
function rollingMean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}