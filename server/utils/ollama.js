function getOllamaChatUrl(configuredUrl = process.env.OLLAMA_URL) {
  const baseUrl = (configuredUrl || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  if (/\/api\/chat$/i.test(baseUrl)) return baseUrl;
  if (/\/api$/i.test(baseUrl)) return `${baseUrl}/chat`;
  return `${baseUrl}/api/chat`;
}

function getResponseText(response) {
  if (typeof response === "string") return response;
  if (typeof response?.message?.content === "string") return response.message.content;
  if (typeof response?.content === "string") return response.content;
  if (Array.isArray(response?.content)) {
    return response.content
      .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

async function callOllama(messages, options = {}) {
  const url = getOllamaChatUrl();
  const model = process.env.LOCAL_AI_MODEL || "llama3.2:3b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {

    console.log("Sending request to Ollama...");
console.log("URL:", url);
console.log("MODEL:", model);
console.log("MESSAGE LENGTH:", JSON.stringify(messages).length);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false, options }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status}): ${await response.text()}`);
    }

    const result = await response.json();

console.log("OLLAMA RESPONSE RECEIVED");

const content = getResponseText(result);
    if (content.trim()) return content;
    throw new Error("Ollama returned an empty response.");
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Ollama request timed out at ${url}.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not connect to Ollama at ${url}. Make sure Ollama is running. ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callOllama, getOllamaChatUrl, getResponseText };