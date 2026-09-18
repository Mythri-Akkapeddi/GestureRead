// Runs inside the overlay iframe. Shows small badges in the corner, queued so at most MAX_NOTIFICATIONS show at once.
// hud.js calls showBadge() whenever a THRESHOLD_ADAPTED message arrives from the content script.

(function () {
  const CONTAINER_ID = "gr-notifications";

  let MAX_VISIBLE = 2;
  let DISMISS_MS = 3000;

  (async function loadConfig() {
    try {
      const { MAX_NOTIFICATIONS, NOTIFICATION_DISMISS_MS } = await import(chrome.runtime.getURL("utils/constants.js"));
      MAX_VISIBLE = MAX_NOTIFICATIONS;
      DISMISS_MS = NOTIFICATION_DISMISS_MS;
    } catch (err) {
      console.warn("[GestureRead] notifications: using default config, constants import failed:", err.message);
    }
  })();

  let container = null;
  let queue = [];
  let visibleCount = 0;

  function initContainer() {
    container = document.getElementById(CONTAINER_ID);
  }

  function showBadge(message) {
    if (!container) initContainer();
    if (!container) return;
    queue.push(message);
    drainQueue();
  }

  function drainQueue() {
    while (queue.length > 0 && visibleCount < MAX_VISIBLE) {
      renderBadge(queue.shift());
    }
  }

  function renderBadge(message) {
    visibleCount++;
    const badge = document.createElement("div");
    badge.className = "gr-badge";
    badge.textContent = message;
    container.appendChild(badge);

    requestAnimationFrame(() => badge.classList.add("gr-badge-visible"));

    setTimeout(() => {
      badge.classList.remove("gr-badge-visible");
      setTimeout(() => {
        badge.remove();
        visibleCount--;
        drainQueue();
      }, 200);
    }, DISMISS_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContainer);
  } else {
    initContainer();
  }

  window.GestureReadNotifications = { showBadge };
})();