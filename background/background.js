// Empty shell, just proves the service worker registers and stays alive.
// Later it will route messages between popup <-> content scripts <-> storage.
// It should never do heavy computation itself.

console.log("GestureRead background service worker started.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("[GestureRead] background service worker installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[GestureRead] background received message:", message);
  // No routing logic yet, just confirms the message channel works.
  sendResponse({ ok: true });
  return true; // keep the channel open for async response
});
