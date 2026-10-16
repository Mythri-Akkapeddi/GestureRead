import { getGestureLogs, getGestureCounters } from "../utils/storageHelpers.js";

const GESTURE_TYPES = ["scroll", "pinch", "brightness"];

export async function computeSummary() {
  const logs = await getGestureLogs();
  const counters = await getGestureCounters();

  const engageEvents = logs.filter((l) => GESTURE_TYPES.some((g) => l.type === `${g}_engage`));
  const totalTriggers = engageEvents.length;
  const correctedEngages = engageEvents.filter((l) => l.corrected).length;
  const standaloneCorrections = logs.filter((l) => l.type === "correction" && l.standalone).length;
  const totalFalseTriggers = correctedEngages + standaloneCorrections;

  const successCount = totalTriggers - correctedEngages;
  const successRate = totalTriggers > 0 ? successCount / totalTriggers : 1;

  const perGesture = {};
  for (const gesture of GESTURE_TYPES) {
    const events = logs.filter((l) => l.type === `${gesture}_engage`);
    const corrected = events.filter((l) => l.corrected).length;
    perGesture[gesture] = {
      triggers: events.length,
      corrected,
      successRate: events.length > 0 ? (events.length - corrected) / events.length : 1,
    };
  }

  // Heuristic: treat 10 threshold adaptations as "fully learned" for now.
  // Should tune this once real usage data is there , therefore it's a placeholder, not a derived constant.
  const adaptations = logs.filter((l) => l.type === "threshold_adapted").length;
  const learningProgress = Math.min(1, adaptations / 10);

  return { totalTriggers, successCount, successRate, totalFalseTriggers, perGesture, learningProgress, counters };
}