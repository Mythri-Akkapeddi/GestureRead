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
  
  function parseAnchorsResponse(raw) {
    if (!raw) return [];
    // Strip markdown fences if the model adds them despite instructions.
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      const parsed = JSON.parse(stripped);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((a) => a && typeof a.title === "string" && typeof a.anchorText === "string");
    } catch (err) {
      console.warn("[GestureRead] anchor JSON parse failed:", err.message, "\nraw:", raw);
      return [];
    }
  }

  async function requestAnchors(pageText) {
    // window.GestureReadLLMPrompts is exposed below via a small bridge so this file doesn't need to be a module to use promptTemplates.js's exports.
    const messages = window.GestureReadLLMPrompts.buildAnchorMessages(pageText);
    const raw = await window.GestureReadOverlay.generateLLM(messages, { temperature: 0.1, maxTokens: 800 });
    return parseAnchorsResponse(raw);
  }
  
  window.GestureReadAnchorExtractor = { cleanPageText, extractPageText, parseAnchorsResponse, requestAnchors };
})();