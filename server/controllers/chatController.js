const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const OpenAI = require("openai");
const { callOllama } = require("../utils/ollama");
const ChatMessage = require("../models/ChatMessage");
const Schedule = require("../models/Schedule");
const Goal = require("../models/Goal");

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey, timeout: 60_000, maxRetries: 0 }) : null;
const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const configuredProvider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

function normalizeAiText(rawResponse) {
  if (typeof rawResponse === "string") return rawResponse;

  if (rawResponse && typeof rawResponse === "object") {
    if (typeof rawResponse.message?.content === "string") return rawResponse.message.content;
    if (typeof rawResponse.content === "string") return rawResponse.content;
    if (Array.isArray(rawResponse.content)) {
      const combined = rawResponse.content
        .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
        .join("");
      if (combined.trim()) return combined;
    }
  }

  return "";
}

function parseStructuredAiResponse(rawResponse, fallbackMessage = "Hello! I’m here to help with your study plan.") {
  const responseText = normalizeAiText(rawResponse);
  const cleanedText = responseText.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();

  if (!cleanedText) {
    return { intent: "general_reply", reply: fallbackMessage };
  }

  try {
    const parsed = JSON.parse(cleanedText);
    if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
      return {
        intent: parsed.intent || "general_reply",
        reply: parsed.reply.trim(),
        daysToReduce: parsed.daysToReduce,
        taskId: parsed.taskId,
      };
    }

    if (parsed && typeof parsed.content === "string" && parsed.content.trim()) {
      return { intent: "general_reply", reply: parsed.content.trim() };
    }
  } catch (error) {
    // Fall through to regex extraction below when the model returns text around JSON.
  }

  const replyMatch = cleanedText.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (replyMatch) {
    const matchText = replyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    const intentMatch = cleanedText.match(/"intent"\s*:\s*"([^"]+)"/);
    return { intent: intentMatch ? intentMatch[1] : "general_reply", reply: matchText };
  }

  const intentMatch = cleanedText.match(/"intent"\s*:\s*"([^"]+)"/);
  return {
    intent: intentMatch ? intentMatch[1] : "general_reply",
    reply: fallbackMessage,
  };
}

async function createChatCompletion(messages) {
  const providerOrder = [];
  if (configuredProvider === "ollama") providerOrder.push("ollama");
  if (openaiApiKey) providerOrder.push("openai");
  if (configuredProvider === "openai") providerOrder.push("openai");

  const orderedProviders = [...new Set(providerOrder)];
  let lastError = null;

  for (const provider of orderedProviders) {
    try {
      if (provider === "ollama") {
        return await callOllama(messages, { num_predict: 512 });
      }

      if (!openai) {
        throw new Error("OpenAI API key is missing.");
      }

      const completion = await openai.chat.completions.create({
        model: chatModel,
        messages,
        temperature: 0.4,
        max_tokens: 2048,
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

// GET /api/chat/:goalId — load chat history for this goal
exports.getHistory = async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      goalId: req.params.goalId,
      userId: req.user.id,
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error("CHATBOT ERROR:");
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/chat/:goalId — send a message, get AI's interpreted response + action
exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    if (!normalizedMessage) {
      return res.status(400).json({ message: "Message required" });
    }

    const goal = await Goal.findOne({ _id: req.params.goalId, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    const history = await ChatMessage.find({
      goalId: req.params.goalId,
      userId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    // Save the student's message first
    await ChatMessage.create({ userId: req.user.id, goalId: req.params.goalId, role: "user", content: normalizedMessage });

    // Build a summary of upcoming days so the AI has context
    const upcomingDays = [];
    if (schedule) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      upcomingDays.push(
        ...schedule.days
          .filter((d) => new Date(d.date) >= today && !d.isRevisionDay)
          .slice(0, 7)
          .map((d) => ({
            dayId: d._id.toString(),
            date: new Date(d.date).toDateString(),
            tasks: d.tasks.map((t) => ({ taskId: t._id.toString(), subject: t.subject, topic: t.topic, completed: t.completed })),
          }))
      );
    }

    const systemPrompt = `You are a friendly, knowledgeable study assistant helping a student prepare for "${goal.examName}".

The student's syllabus and subjects:
${goal.syllabusText}

The student's upcoming 7 days of study plan:
${JSON.stringify(upcomingDays, null, 2)}

Decide what they want and respond with ONLY valid JSON in this exact shape:
{
  "intent": "reduce_workload" | "mark_topic_done" | "answer_doubt" | "general_reply",
  "daysToReduce": <number, only if intent is reduce_workload, how many upcoming days to lighten, default 2>,
  "taskId": "<only if intent is mark_topic_done, the exact taskId of the topic they mean>",
  "reply": "<your actual response to show the student>"
}

Rules:
- If they express feeling overwhelmed, stressed, or say the plan is too hard/heavy, use "reduce_workload".
- If they say they completed/finished a specific topic, use "mark_topic_done" and pick the matching taskId from the list above.
- If they ask a question about a concept, topic, or anything from their syllabus (e.g. "explain X", "what is Y", "I have a doubt about Z", "how does this work"), use "answer_doubt" and give a genuinely helpful, clear, well-explained answer in "reply" — like a patient tutor would. Use simple language, examples where useful, and keep it focused (3-6 sentences, or a short list if it helps clarity).
- Otherwise use "general_reply" for greetings, encouragement, or anything else conversational.
- Use the conversation history to understand follow-up questions such as "why?", "can you explain that", or "give me an example". Answer the student's actual question, not just the latest keyword.
- If the question is not covered by the syllabus, say that clearly and give a useful general explanation without inventing course-specific facts.
- Only use "mark_topic_done" when an exact matching taskId exists in the study plan.
- Always make "reply" warm and supportive in tone, like a helpful study buddy — never robotic or overly formal.`;

    const rawResponse = await createChatCompletion([
      { role: "system", content: systemPrompt },
      ...history.reverse().map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: normalizedMessage },
    ]);

    const aiResult = parseStructuredAiResponse(rawResponse, `Hello! I’m here to help with your study plan. You can ask me to explain a topic, reduce the workload, or mark a task done.`);
    if (typeof aiResult.reply !== "string" || !aiResult.reply.trim()) {
      throw new Error("The AI returned an invalid reply. Please try again.");
    }
    let scheduleChanged = false;

    // Execute the actual action — the AI decided WHAT, this code decides HOW
    if (schedule && aiResult.intent === "reduce_workload") {
      const numDays = Math.min(aiResult.daysToReduce || 2, upcomingDays.length);
      const targetDayIds = upcomingDays.slice(0, numDays).map((d) => d.dayId);

      // Move roughly half of each targeted day's pending tasks further out
      for (const dayId of targetDayIds) {
        const day = schedule.days.id(dayId);
        if (!day) continue;
        const pending = day.tasks.filter((t) => !t.completed);
        const toMove = pending.slice(0, Math.ceil(pending.length / 2));
        if (toMove.length === 0) continue;

        const dayIndex = schedule.days.findIndex((d) => d._id.toString() === dayId);
        const futureDays = schedule.days
          .map((d, idx) => ({ d, idx }))
          .filter(({ d, idx }) => idx > dayIndex && !d.isRevisionDay);

        toMove.forEach((task, i) => {
          if (futureDays.length === 0) return;
          const target = futureDays[i % futureDays.length].d;
          target.tasks.push({ subject: task.subject, topic: task.topic, completed: false });
        });

        const movedIds = toMove.map((t) => t._id.toString());
        day.tasks = day.tasks.filter((t) => !movedIds.includes(t._id.toString()));
      }
      scheduleChanged = true;
    } else if (schedule && aiResult.intent === "mark_topic_done" && aiResult.taskId) {
      for (const day of schedule.days) {
        const task = day.tasks.id(aiResult.taskId);
        if (task) {
          task.completed = true;
          const allDone = day.tasks.every((t) => t.completed);
          day.dayStatus = allDone ? "completed" : "partial";
          scheduleChanged = true;
          break;
        }
      }
    }

    if (scheduleChanged) await schedule.save();

    // Save the AI's reply
    await ChatMessage.create({ userId: req.user.id, goalId: req.params.goalId, role: "assistant", content: aiResult.reply });

    res.json({ reply: aiResult.reply, intent: aiResult.intent, schedule: scheduleChanged ? schedule : undefined });
  } catch (error) {
    console.error("Chat request failed:", error);
    if (error.status === 429 || error.code === "insufficient_quota") {
      return res.status(503).json({
        message: "The study assistant is temporarily unavailable because the AI account has no credits remaining. Please add API credits and try again.",
      });
    }
    res.status(500).json({ message: error.message || "The study assistant could not answer right now." });
  }
};

module.exports = {
  getHistory: exports.getHistory,
  sendMessage: exports.sendMessage,
  parseStructuredAiResponse,
};