// No logic yet. Just confirms the popup can talk to the background worker.
console.log("[GestureRead] popup opened");

chrome.runtime.sendMessage({ type: "PING_FROM_POPUP" }, (response) => {
  console.log("[GestureRead] background responded:", response);
});
