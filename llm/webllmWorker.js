// Runs as a dedicated module Worker, created from inside overlay/llmBridge.js
// Mirrors the "dynamic import of a local bundle via chrome.runtime.getURL" pattern already used for constants.js and the MediaPipe bundle

let engine = null;
let currentModelId = null;

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type === "INIT") {
    await handleInit(payload);
    return;
  }

  if (type === "GENERATE") {
    await handleGenerate(payload);
    return;
  }
};

async function handleInit({ modelId }) {
  if (engine && currentModelId === modelId) {
    self.postMessage({ type: "INIT_COMPLETE" });
    return;
  }

  try {
    const webllm = await import(self.location.origin + "/assets/webllm/web-llm.js");
    // self.location.origin inside an extension worker is chrome-extension://<id>, so this resolves the same as chrome.runtime.getURL("assets/webllm/web-llm.js") would from a normal script context.

    engine = new webllm.MLCEngine();
    engine.setInitProgressCallback((report) => {
      self.postMessage({ type: "INIT_PROGRESS", payload: { text: report.text, progress: report.progress } });
    });

    await engine.reload(modelId);
    currentModelId = modelId;
    self.postMessage({ type: "INIT_COMPLETE" });
  } catch (err) {
    console.error("[GestureRead] webllmWorker init failed:", err);
    self.postMessage({ type: "INIT_ERROR", error: err.message });
  }
}

async function handleGenerate({ requestId, messages, options = {} }) {
  if (!engine) {
    self.postMessage({ type: "GENERATE_ERROR", payload: { requestId, error: "engine not initialized" } });
    return;
  }
  try {
    const response = await engine.chat.completions.create({
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1024,
    });
    const text = response.choices?.[0]?.message?.content ?? "";
    self.postMessage({ type: "GENERATE_RESULT", payload: { requestId, text } });
  } catch (err) {
    console.error("[GestureRead] webllmWorker generate failed:", err);
    self.postMessage({ type: "GENERATE_ERROR", payload: { requestId, error: err.message } });
  }
}