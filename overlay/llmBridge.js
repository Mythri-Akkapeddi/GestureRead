// Runs inside the overlay iframe (same extension-page context as engine.js).
// Owns the single WebLLM worker instance for this tab, both the popup's "Analyze Page" button and the settings page's "Test" button go through this one instance, relayed via overlayController.js, so the ~1GB model is only ever loaded once per tab.

(function () {
  let worker = null;
  let initPromise = null;
  const pendingGenerations = new Map(); // requestId -> {resolve, reject}

  function createWorker() {
    const url = chrome.runtime.getURL("llm/webllmWorker.js");
    const w = new Worker(url, { type: "module" });
    w.onmessage = handleWorkerMessage;
    w.onerror = (err) => console.error("[GestureRead] webllm worker error:", err);
    return w;
  }

  function handleWorkerMessage(event) {
    const { type, payload, error } = event.data || {};

    if (type === "INIT_PROGRESS") {
      window.parent.postMessage(
        { source: "gestureread-overlay", type: "LLM_INIT_PROGRESS", payload },
        "*"
      );
      return;
    }
    if (type === "INIT_COMPLETE") {
      window.parent.postMessage({ source: "gestureread-overlay", type: "LLM_INIT_COMPLETE" }, "*");
      return;
    }
    if (type === "INIT_ERROR") {
      window.parent.postMessage({ source: "gestureread-overlay", type: "LLM_INIT_ERROR", error }, "*");
      return;
    }
    if (type === "GENERATE_RESULT") {
      const entry = pendingGenerations.get(payload.requestId);
      if (entry) {
        entry.resolve(payload.text);
        pendingGenerations.delete(payload.requestId);
      }
      return;
    }
    if (type === "GENERATE_ERROR") {
      const entry = pendingGenerations.get(payload.requestId);
      if (entry) {
        entry.reject(new Error(payload.error));
        pendingGenerations.delete(payload.requestId);
      }
      return;
    }
  }

  async function checkWebGPU() {
    if (!("gpu" in navigator)) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  async function initLLM(modelId) {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const hasWebGPU = await checkWebGPU();
      if (!hasWebGPU) {
        window.parent.postMessage(
          { source: "gestureread-overlay", type: "LLM_INIT_ERROR", error: "no-webgpu" },
          "*"
        );
        throw new Error("WebGPU unavailable");
      }

      worker = worker || createWorker();
      worker.postMessage({ type: "INIT", payload: { modelId } });

      // Resolve the outer promise once INIT_COMPLETE/INIT_ERROR arrives.
      await new Promise((resolve, reject) => {
        const onMsg = (event) => {
          const data = event.data;
          if (data?.type === "INIT_COMPLETE") {
            worker.removeEventListener("message", onMsg);
            resolve();
          } else if (data?.type === "INIT_ERROR") {
            worker.removeEventListener("message", onMsg);
            reject(new Error(data.error));
          }
        };
        worker.addEventListener("message", onMsg);
      });
    })();

    return initPromise;
  }

  let requestCounter = 0;
  function generateLLM(messages, options) {
    if (!worker) return Promise.reject(new Error("LLM not initialized"));
    const requestId = `llm_${Date.now()}_${requestCounter++}`;
    return new Promise((resolve, reject) => {
      pendingGenerations.set(requestId, { resolve, reject });
      worker.postMessage({ type: "GENERATE", payload: { requestId, messages, options } });
    });
  }
  
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "gestureread-content") return;
    if (data.type === "LLM_INIT") initLLM(data.payload.modelId);
    if (data.type === "LLM_GENERATE") {
      generateLLM(data.payload.messages, data.payload.options)
        .then((text) => {
          window.parent.postMessage(
            { source: "gestureread-overlay", type: "LLM_GENERATE_RESULT", payload: { requestId: data.payload.requestId, text } },
            "*"
          );
        })
        .catch((err) => {
          window.parent.postMessage(
            { source: "gestureread-overlay", type: "LLM_GENERATE_ERROR", payload: { requestId: data.payload.requestId, error: err.message } },
            "*"
          );
        });
    }
  });

  window.GestureReadLLM = { initLLM, generateLLM, checkWebGPU };
})();