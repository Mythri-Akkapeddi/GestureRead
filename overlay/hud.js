// Orchestrator for the overlay iframe. Right now it just proves the handshake with the content script works and flips the status dot. 
// skeletonCanvas/confidenceBar/notifications will be implemented later
(function () {
  const statusDot = document.getElementById("gr-status-dot");

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "gestureread-content") return;

    if (data.type === "CONTENT_READY") {
      console.log("[GestureRead HUD] handshake received from content script");
      if (statusDot) statusDot.classList.add("on");

      window.parent.postMessage(
        { source: "gestureread-overlay", type: "OVERLAY_READY" },
        "*"
      );
    }
  });
})();