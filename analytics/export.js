import { getGestureLogs } from "../utils/storageHelpers.js";

export async function exportLogsAsJSON() {
  const logs = await getGestureLogs();
  download(JSON.stringify(logs, null, 2), "gestureread-logs.json", "application/json");
}

export async function exportLogsAsCSV() {
  const logs = await getGestureLogs();
  if (logs.length === 0) {
    download("", "gestureread-logs.csv", "text/csv");
    return;
  }
  const keySet = new Set();
  logs.forEach((l) => Object.keys(l).forEach((k) => keySet.add(k)));
  const keys = Array.from(keySet);

  const rows = [keys.join(",")];
  for (const log of logs) {
    rows.push(keys.map((k) => csvEscape(log[k])).join(","));
  }
  download(rows.join("\n"), "gestureread-logs.csv", "text/csv");
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}