const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const OpenAI = require("openai");
const { callOllama } = require("./ollama");
const {
  parseSyllabus,
  matchesSyllabusTopics,
  weightedInterleave,
  distributeAcrossDays,
} = require("./scheduler");

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey, timeout: 60_000, maxRetries: 0 }) : null;
const aiModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const configuredProvider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

/**
 * Call whichever AI is configured (Ollama first if AI_PROVIDER=ollama, else OpenAI).
 * Falls back to the other provider if the first one fails.
 */
async function callAI(prompt) {
  const providerOrder = [];
  if (configuredProvider === "ollama") providerOrder.push("ollama");
  if (openaiApiKey) providerOrder.push("openai");
  if (configuredProvider === "openai" && !providerOrder.includes("openai")) providerOrder.push("openai");

  const orderedProviders = [...new Set(providerOrder)];
  let lastError = null;

  for (const provider of orderedProviders) {
    try {
      if (provider === "ollama") {
        return await callOllama([{ role: "user", content: prompt }], { num_predict: 4096 });
      }

      // OpenAI provider
      if (!openai) throw new Error("OpenAI API key is missing.");

      const completion = await openai.chat.completions.create({
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (content && content.trim()) return content;
      throw new Error("OpenAI returned an empty response.");
    } catch (error) {
      console.log(`AI provider "${provider}" failed for schedule generation: ${error.message}`);
      lastError = error;
    }
  }

  throw lastError || new Error("No AI provider is available right now.");
}

async function generateScheduleWithAI({ startDate, examDate, dailyStudyHours, syllabusText, examName }) {
  const parsed = parseSyllabus(syllabusText);
  const fallbackOrder = weightedInterleave(parsed);

  let orderedTopics = fallbackOrder;
  let generatedBy = "fallback";

  if (parsed.length === 0 || parsed.every((s) => s.topics.length === 0)) {
    console.log("Syllabus is empty — using fallback schedule.");
    return { days: distributeAcrossDays({ startDate, examDate, orderedTopics }), generatedBy };
  }

  try {
    const prompt = `You are a study planning assistant helping with: "${examName}".

Syllabus (format "Subject (Weak/Medium/Strong): topic, topic, ..."):
${syllabusText}

Decide the BEST ORDER to study these topics in, so that:
- Weak subjects are revisited more frequently, spaced throughout, not all at once.
- Related/foundational topics come before topics that depend on them.
- Subjects are interleaved (don't finish one subject before starting the next).

Return ONLY valid JSON, no explanation, in exactly this shape — include EVERY topic from the syllabus exactly once, do not skip any, do not summarize, do not truncate:
{
  "orderedTopics": [
    { "subject": "DSA", "topic": "Arrays" },
    { "subject": "DBMS", "topic": "ER Model" }
  ]
}`;

    const raw = await callAI(prompt);
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
    const parsedResponse = JSON.parse(cleaned);

    if (matchesSyllabusTopics(parsedResponse.orderedTopics, parsed)) {
      orderedTopics = parsedResponse.orderedTopics;
      generatedBy = "ai";
    } else {
      console.log("AI topic order did not exactly match the syllabus. Using rule-based order instead.");
    }
  } catch (error) {
    console.log("AI ordering failed, using rule-based fallback:", error.message);
  }

  const days = distributeAcrossDays({ startDate, examDate, orderedTopics });
  return { days, generatedBy };
}

module.exports = { generateScheduleWithAI };