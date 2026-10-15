// Runs inside the overlay iframe. Two kinds of UI live here:
//  - passive badges (queued, auto-dismiss, not clickable), like the "threshold adapted" notices.
//  - a single interactive prompt (not queued, clickable) like the fatigue nudge and the "wrong gesture? undo" prompt (Day 25). Only one shows at a time; a newer one replaces whatever's currently up. hud.js calls into whichever one applies when a message arrives.

(function () {
  const BADGE_CONTAINER_ID = "gr-notifications";
  const PROMPT_CONTAINER_ID = "gr-prompt";

  let MAX_VISIBLE = 2;
  let DISMISS_MS = 3000;
  let CORRECTION_PROMPT_MS = 4000;
  let FATIGUE_PROMPT_MS = 8000;

  (async function loadConfig() {
    try {
      const {
        MAX_NOTIFICATIONS,
        NOTIFICATION_DISMISS_MS,
        CORRECTION_WINDOW_MS,
        FATIGUE_NUDGE_TIMEOUT_MS,
      } = await import(chrome.runtime.getURL("utils/constants.js"));
      MAX_VISIBLE = MAX_NOTIFICATIONS;
      DISMISS_MS = NOTIFICATION_DISMISS_MS;
      CORRECTION_PROMPT_MS = CORRECTION_WINDOW_MS;
      FATIGUE_PROMPT_MS = FATIGUE_NUDGE_TIMEOUT_MS;
    } catch (err) {
      console.warn("[GestureRead] notifications: using default config, constants import failed:", err.message);
    }
  })();

  let badgeContainer = null;
  let promptContainer = null;
  let queue = [];
  let visibleCount = 0;
  let activePromptTimeoutId = null;

  function initContainers() {
    badgeContainer = document.getElementById(BADGE_CONTAINER_ID);
    promptContainer = document.getElementById(PROMPT_CONTAINER_ID);
  }

  // --- passive badges ---

  function showBadge(message) {
    if (!badgeContainer) initContainers();
    if (!badgeContainer) return;
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
    badgeContainer.appendChild(badge);

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

  // --- interactive prompt ---

  function showPrompt({ id, message, buttons, timeoutMs, onTimeout }) {
    if (!promptContainer) initContainers();
    if (!promptContainer) return;

    clearPrompt();

    const el = document.createElement("div");
    el.className = "gr-prompt";
    el.dataset.promptId = id;

    const text = document.createElement("span");
    text.className = "gr-prompt-text";
    text.textContent = message;
    el.appendChild(text);

    for (const btn of buttons) {
      const button = document.createElement("button");
      button.className = "gr-prompt-btn";
      button.textContent = btn.label;
      button.addEventListener("click", () => {
        clearPrompt();
        btn.onClick();
      });
      el.appendChild(button);
    }

    promptContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("gr-prompt-visible"));

    activePromptTimeoutId = setTimeout(() => {
      clearPrompt();
      onTimeout?.();
    }, timeoutMs);
  }

  function clearPrompt() {
    if (activePromptTimeoutId) {
      clearTimeout(activePromptTimeoutId);
      activePromptTimeoutId = null;
    }
    if (promptContainer) promptContainer.innerHTML = "";
  }

  function showFatigueNudge(score) {
    showPrompt({
      id: "fatigue",
      message: `You seem fatigued (${score.toFixed(1)}x your baseline). Simplify gestures?`,
      buttons: [
        { label: "Yes", onClick: () => respondReducedPrecision(true) },
        { label: "Later", onClick: () => respondReducedPrecision(false) },
      ],
      timeoutMs: FATIGUE_PROMPT_MS,
      onTimeout: () => respondReducedPrecision(false),
    });
  }

  function showCorrectionPrompt(gesture) {
    const label = gesture.charAt(0).toUpperCase() + gesture.slice(1);
    showPrompt({
      id: `correction-${gesture}`,
      message: `Wrong? ${label} didn't mean to trigger.`,
      buttons: [{ label: "↩ Undo", onClick: () => respondCorrection(gesture, true) }],
      timeoutMs: CORRECTION_PROMPT_MS,
      onTimeout: () => respondCorrection(gesture, false),
    });
  }

  function hideCorrectionPrompt(gesture) {
    if (promptContainer?.firstElementChild?.dataset.promptId === `correction-${gesture}`) {
      clearPrompt();
    }
  }

  function respondReducedPrecision(accepted) {
    window.parent.postMessage(
      { source: "gestureread-overlay", type: "REDUCED_PRECISION_RESPONSE", payload: { accepted } },
      "*"
    );
  }

  function respondCorrection(gesture, accepted) {
    window.parent.postMessage(
      { source: "gestureread-overlay", type: "CORRECTION_RESPONSE", payload: { gesture, accepted } },
      "*"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContainers);
  } else {
    initContainers();
  }

  window.GestureReadNotifications = {
    showBadge,
    showFatigueNudge,
    showCorrectionPrompt,
    hideCorrectionPrompt,
  };
})();