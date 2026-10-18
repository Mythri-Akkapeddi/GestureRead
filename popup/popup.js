// No logic yet. Just confirms the popup can talk to the background worker.
console.log("[GestureRead] popup opened");

chrome.runtime.sendMessage({ type: "PING_FROM_POPUP" }, (response) => {
  console.log("[GestureRead] background responded:", response);
});

document.getElementById("gr-calibrate-btn").addEventListener("click", async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = chrome.runtime.getURL(`settings/settings.html?tabId=${activeTab.id}`);
  chrome.windows.create({
    url,
    type: "popup",
    width: 480,
    height: 640,
    left: 40,
    top: 40,
  });
});

document.getElementById("gr-analyze-btn").addEventListener("click", async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(activeTab.id, { type: "ANALYZE_PAGE" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("[GestureRead] analyze page failed:", chrome.runtime.lastError.message);
      return;
    }
    console.log("[GestureRead] analyze result:", response);
  });
});