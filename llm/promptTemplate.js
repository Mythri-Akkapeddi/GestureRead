export function buildTestMessages() {
  return [
    { role: "system", content: "You are a concise assistant. Answer in one short sentence." },
    { role: "user", content: "Say hello and confirm you're running locally in the browser." },
  ];
}

const SYSTEM_PROMPT = `You extract navigation anchors from web page text for a hands-free reading tool.

Given the page text, return 4 to 6 anchors: short labeled jump points a reader would want to navigate to (section starts, topic shifts, key claims). Each anchor's "anchorText" must be copied VERBATIM from the page text — a short exact phrase (6-12 words) that appears in the text unchanged, so it can be located later.

Respond with ONLY a JSON array, no prose, no markdown code fences, no explanation. Exact format:
[{"title": "Short Label", "anchorText": "exact phrase copied from the page"}, ...]`;

const FEW_SHOT_USER = `Page text:
The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower. Locally nicknamed "La dame de fer", it was constructed from 1887 to 1889 as the entrance to the 1889 World's Fair. Although initially criticized by some of France's leading artists and intellectuals for its design, it has become a global cultural icon of France. The tower is 330 metres tall and was the tallest man-made structure in the world for 41 years.`;

const FEW_SHOT_ASSISTANT = `[{"title": "Location & Naming", "anchorText": "wrought-iron lattice tower on the Champ de Mars"}, {"title": "Construction", "anchorText": "constructed from 1887 to 1889 as the entrance"}, {"title": "Reception", "anchorText": "initially criticized by some of France's leading artists"}, {"title": "Height Record", "anchorText": "was the tallest man-made structure in the world"}]`;

export function buildAnchorMessages(pageText) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: FEW_SHOT_USER },
    { role: "assistant", content: FEW_SHOT_ASSISTANT },
    { role: "user", content: `Page text:\n${pageText}` },
  ];
}