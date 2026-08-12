const Groq = require("groq-sdk");
const ChatMessage = require("../models/ChatMessage");
const Schedule = require("../models/Schedule");
const Goal = require("../models/Goal");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// GET /api/chat/:goalId — load chat history for this goal
exports.getHistory = async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      goalId: req.params.goalId,
      userId: req.user.id,
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/chat/:goalId — send a message, get AI's interpreted response + action
exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message required" });
    }

    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    const goal = await Goal.findOne({ _id: req.params.goalId, userId: req.user.id });
    if (!schedule || !goal) return res.status(404).json({ message: "Goal or schedule not found" });

    // Save the student's message first
    await ChatMessage.create({ userId: req.user.id, goalId: req.params.goalId, role: "user", content: message });

    // Build a summary of upcoming days so the AI has context
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingDays = schedule.days
      .filter((d) => new Date(d.date) >= today && !d.isRevisionDay)
      .slice(0, 7)
      .map((d) => ({
        dayId: d._id.toString(),
        date: new Date(d.date).toDateString(),
        tasks: d.tasks.map((t) => ({ taskId: t._id.toString(), subject: t.subject, topic: t.topic, completed: t.completed })),
      }));

    const prompt = `You are a friendly, knowledgeable study assistant helping a student prepare for "${goal.examName}".

The student's syllabus and subjects:
${goal.syllabusText}

The student's upcoming 7 days of study plan:
${JSON.stringify(upcomingDays, null, 2)}

The student just said: "${message}"

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
- Always make "reply" warm and supportive in tone, like a helpful study buddy — never robotic or overly formal.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);
    let scheduleChanged = false;

    // Execute the actual action — the AI decided WHAT, this code decides HOW
    if (aiResult.intent === "reduce_workload") {
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
    } else if (aiResult.intent === "mark_topic_done" && aiResult.taskId) {
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
    res.status(500).json({ message: error.message });
  }
};