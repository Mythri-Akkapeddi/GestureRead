export function buildTestMessages() {
  return [
    { role: "system", content: "You are a concise assistant. Answer in one short sentence." },
    { role: "user", content: "Say hello and confirm you're running locally in the browser." },
  ];
}