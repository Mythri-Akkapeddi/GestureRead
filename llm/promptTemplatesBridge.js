// anchorExtractor.js is a classic content script and can't `import` promptTemplates.js (which uses export/import). 
// This loads it the same way other files here dynamic-import constants.js, and hangs the result on window for anchorExtractor.js to call.
(async function () {
  const mod = await import(chrome.runtime.getURL("llm/promptTemplate.js"));
  window.GestureReadLLMPrompts = mod;
})();