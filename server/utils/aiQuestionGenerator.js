const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const OpenAI = require("openai");
const { callOllama } = require("./ollama");

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey, timeout: 60_000, maxRetries: 0 }) : null;
const aiModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const configuredProvider = (process.env.AI_PROVIDER || "ollama").toLowerCase();
const localAiModel = process.env.LOCAL_AI_MODEL || "llama3.2:3b";

const QUESTION_CONFIG = {
  topic: {
    markType: "2",
    count: 5,
    instruction: "Generate 5 focused practice questions that test understanding of this one topic. Give concise answers of 2-4 sentences.",
  },
  chapter: {
    markType: "mcq",
    count: 10,
    instruction: "Generate 10 multiple-choice questions that test the complete chapter. Each question must have exactly 4 options and one correct answer.",
  },
};

function normalizeAiText(rawResponse) {
  if (typeof rawResponse === "string") return rawResponse;
  if (rawResponse && typeof rawResponse === "object") {
    if (typeof rawResponse.message?.content === "string") return rawResponse.message.content;
    if (typeof rawResponse.content === "string") return rawResponse.content;
    if (Array.isArray(rawResponse.content)) {
      return rawResponse.content
        .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
        .join("");
    }
  }
  return "";
}


async function requestAI(messages, options = {}) {
  const preferredProvider = configuredProvider === "openai" ? "openai" : "ollama";
  const orderedProviders = preferredProvider === "openai"
    ? ["openai"]
    : ["ollama", ...(openaiApiKey ? ["openai"] : [])];
  let lastError = null;

  for (const provider of orderedProviders) {
    try {
      if (provider === "ollama") {
        return await callOllama(messages, options);
      }

      if (!openai) {
        throw new Error("OpenAI API key is missing.");
      }

      const completion = await openai.chat.completions.create({
        model: aiModel,
        messages,
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (content && content.trim()) return content;
      throw new Error("OpenAI returned an empty response.");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No AI provider is available right now.");
}

async function generateQuestions({ syllabus, subject, topic, scope }) {
  const config = QUESTION_CONFIG[scope];
  if (!config) throw new Error(`Unknown question scope: ${scope}`);

  const chapterText = Array.isArray(topic) ? topic.map((item) => `- ${item}`).join("\n") : topic;
  const prompt = `You are a patient exam tutor.

Subject/chapter: ${subject}
${scope === "topic" ? `Topic to practice: ${topic}` : `Completed chapter topics:\n${chapterText}`}

Relevant syllabus:
${syllabus}

${config.instruction}
Use only the supplied syllabus and completed topics. Do not invent unrelated content.
Respond with ONLY valid JSON in exactly this shape:
{
  "questions": [
    ${scope === "chapter"
      ? '{ "question": "...", "options": ["A", "B", "C", "D"], "answer": "the correct option text" }'
      : '{ "question": "...", "answer": "..." }'}
  ]
}
Return exactly ${config.count} questions.`;

  const raw = await requestAI([{ role: "user", content: prompt }], {
    num_predict: scope === "topic" ? 256 : 512,
  });
  if (!raw) throw new Error("AI returned an empty question response.");

  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    const fallbackMatch = cleaned.match(/"questions"\s*:\s*\[(.*)\]/s);
    if (!fallbackMatch) throw new Error("AI did not return valid practice questions.");
    parsed = { questions: JSON.parse(`[${fallbackMatch[1]}]`) };
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("AI did not return valid practice questions.");
  }

  return { markType: config.markType, questions: parsed.questions.slice(0, config.count) };
}

module.exports = { generateQuestions, requestAI };
