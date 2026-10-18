// Runs in the content script's isolated world. Loaded as a classic script (not a module) like the rest of content/, so content.js can call window.GestureReadAnchorExtractor directly without an import.

(function () {
  const MAX_CHARS = 16000; // ~4000 tokens at a rough 4-chars/token estimate

  function cleanPageText(rawText) {
    if (!rawText) return "";
    const collapsed = rawText
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return collapsed.length > MAX_CHARS ? collapsed.slice(0, MAX_CHARS) : collapsed;
  }

  function extractPageText() {
    const raw = document.body?.innerText ?? "";
    return cleanPageText(raw);
  }

  window.GestureReadAnchorExtractor = { cleanPageText, extractPageText };
})();