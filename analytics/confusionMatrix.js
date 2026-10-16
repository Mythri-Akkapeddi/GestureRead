import { getGestureLogs } from "../utils/storageHelpers.js";

const GESTURE_TYPES = ["scroll", "pinch", "brightness"];

// The correction workflow never records what the user meant instead, only whether a trigger was wrong.
// So this is the equivalent given the data actually logged: per-gesture correct vs corrected counts, with precision/recall/F1 derived from that.
export async function buildConfusionMatrix() {
  const logs = await getGestureLogs();
  const matrix = {};

  for (const gesture of GESTURE_TYPES) {
    const engages = logs.filter((l) => l.type === `${gesture}_engage`);
    const tp = engages.filter((l) => !l.corrected).length;
    const fp = engages.filter((l) => l.corrected).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = precision;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    matrix[gesture] = { tp, fp, precision, recall, f1, total: tp + fp };
  }

  return matrix;
}