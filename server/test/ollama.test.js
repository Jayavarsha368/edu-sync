const test = require("node:test");
const assert = require("node:assert/strict");
const { callOllama, getOllamaChatUrl, getResponseText } = require("../utils/ollama");

test("normalizes Ollama server URLs to the chat endpoint", () => {
  assert.equal(getOllamaChatUrl("http://localhost:11434"), "http://localhost:11434/api/chat");
  assert.equal(getOllamaChatUrl("http://localhost:11434/api"), "http://localhost:11434/api/chat");
  assert.equal(getOllamaChatUrl("http://localhost:11434/api/chat/"), "http://localhost:11434/api/chat");
});

test("extracts Ollama chat response content", () => {
  assert.equal(getResponseText({ message: { content: "Ready" } }), "Ready");
  assert.equal(getResponseText({ content: [{ text: "Ready" }] }), "Ready");
});

test("sends non-streaming chat requests to the configured Ollama model", async (context) => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.OLLAMA_URL;
  const originalModel = process.env.LOCAL_AI_MODEL;
  let request;

  context.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = originalUrl;
    if (originalModel === undefined) delete process.env.LOCAL_AI_MODEL;
    else process.env.LOCAL_AI_MODEL = originalModel;
  });

  process.env.OLLAMA_URL = "http://localhost:11434";
  process.env.LOCAL_AI_MODEL = "test-model";
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ message: { content: "Ready" } }) };
  };

  const messages = [{ role: "user", content: "hello" }];
  assert.equal(await callOllama(messages, { num_predict: 128 }), "Ready");
  assert.equal(request.url, "http://localhost:11434/api/chat");
  assert.deepEqual(JSON.parse(request.options.body), {
    model: "test-model",
    messages,
    stream: false,
    options: { num_predict: 128 },
  });
});