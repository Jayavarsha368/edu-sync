const QuestionSet = require("../models/QuestionSet");
const Goal = require("../models/Goal");
const Schedule = require("../models/Schedule");
const { requestAI } = require("../utils/aiQuestionGenerator");
const { syllabusForSubject } = require("../utils/scheduler");

const COUNT_BY_TYPE = { mcq: 3, "1": 3, "2": 3, "7": 2, "14": 1 };

const INSTRUCTIONS_BY_TYPE = {
  mcq: "Generate multiple-choice questions. Each must have exactly 4 options and one correct answer.",
  "1": "Generate 1-mark questions — short, direct, testing a single fact or definition. Answers should be 1-2 sentences.",
  "2": "Generate 2-mark questions — slightly more detail than 1-mark, testing understanding of a concept. Answers should be 2-4 sentences.",
  "7": "Generate 7-mark questions — these require a structured, detailed answer covering multiple points, like 'Explain X with its types/advantages' or 'Describe the process of Y'. Answers should be a well-organized paragraph or short-point list covering several aspects.",
  "14": "Generate 14-mark questions — these are the most comprehensive, essay-style questions covering an entire topic or unit in depth, often combining multiple sub-parts (e.g., 'Explain X in detail, including its architecture, advantages, and applications'). Answers should be thorough, well-structured, and cover multiple sub-points comprehensively.",
};

function syllabusFromSchedule(schedule, requestedSubject) {
  const selectedSubject = typeof requestedSubject === "string" ? requestedSubject.trim().toLowerCase() : "all";
  const topicsBySubject = new Map();

  for (const day of schedule?.days || []) {
    if (day.isRevisionDay) continue;

    for (const task of day.tasks || []) {
      const subject = typeof task.subject === "string" ? task.subject.trim() : "";
      const topic = typeof task.topic === "string" ? task.topic.trim() : "";
      if (!subject || !topic || /^(revision|buffer)$/i.test(subject) || /^(revise:|revise weak\/completed topics|catch-up|free day)/i.test(topic)) continue;
      if (selectedSubject && selectedSubject !== "all" && subject.toLowerCase() !== selectedSubject) continue;

      if (!topicsBySubject.has(subject)) topicsBySubject.set(subject, new Set());
      topicsBySubject.get(subject).add(topic);
    }
  }

  return [...topicsBySubject]
    .map(([subject, topics]) => `${subject}: ${[...topics].join(", ")}`)
    .join("\n");
}

function questionGenerationError(error) {
  if (error.status === 429 || error.code === "insufficient_quota" || error.type === "insufficient_quota") {
    return {
      status: 503,
      message: "Question generation is temporarily unavailable because the AI account has no credits remaining. Add credits or configure another AI provider, then try again.",
    };
  }

  return { status: 500, message: error.message || "Failed to generate questions" };
}

// POST /api/questions/:goalId  { subject, markType }
exports.generateQuestions = async (req, res) => {
  try {
    const { subject, markType } = req.body;
    if (!markType || !COUNT_BY_TYPE[markType]) {
      return res.status(400).json({ message: "Invalid or missing markType" });
    }

    const goal = await Goal.findOne({ _id: req.params.goalId, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    const syllabusText = typeof goal.syllabusText === "string" ? goal.syllabusText.trim() : "";
    let syllabusScope = syllabusForSubject(syllabusText, subject);

    if (!syllabusScope || !syllabusScope.trim()) syllabusScope = syllabusText;

    if (!syllabusScope) {
      const schedule = await Schedule.findOne({ goalId: goal._id, userId: req.user.id });
      syllabusScope = syllabusFromSchedule(schedule, subject);
    }

    if (!syllabusScope || !syllabusScope.trim()) {
      if (subject && subject !== "All") {
        return res.status(400).json({
          message: `No syllabus topics were found for "${subject}". Check the subject name and syllabus format in this goal.`,
        });
      }
      return res.status(400).json({ message: "This goal has no syllabus text. Edit the goal and add the syllabus topics before generating questions." });
    }

    const count = COUNT_BY_TYPE[markType];

console.log("SYLLABUS PREVIEW:");
console.log(syllabusScope.substring(0, 500));

syllabusScope = syllabusScope.substring(0, 1000);

const isMCQ = markType === "mcq";

const prompt = `You are an exam question paper setter for the subject/syllabus below.

  ${subject && subject !== "All" ? `Selected subject: ${subject}\n` : ""}

Syllabus:
${syllabusScope}

Task: ${INSTRUCTIONS_BY_TYPE[markType]}


Generate exactly ${count} questions based ONLY on the topics in the syllabus above — do not invent unrelated topics.

Respond with ONLY valid JSON in exactly this shape:
{
  "questions": [
    ${isMCQ
      ? `{ "question": "...", "options": ["A", "B", "C", "D"], "answer": "the correct option text" }`
      : `{ "question": "...", "answer": "..." }`
    }
  ]
}

Make sure there are exactly ${count} questions in the array, each one distinct and covering different parts of the syllabus.`;

    console.log("================================");
console.log("SUBJECT:", subject);
console.log("MARK TYPE:", markType);
console.log("SYLLABUS LENGTH:", syllabusScope.length);
console.log("CALLING AI...");
console.log("================================");

const raw = await requestAI(
  [{ role: "user", content: prompt }],
  { num_predict: 256 }
);

console.log("================================");
console.log("AI RESPONSE:");
console.log(raw);
console.log("================================");
    if (!raw) throw new Error("AI returned an empty question response.");
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim());

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return res.status(500).json({ message: "AI did not return valid questions. Try again." });
    }

    const questionSet = await QuestionSet.create({
      userId: req.user.id,
      goalId: req.params.goalId,
      subject: subject || "All",
      scope: "manual",
      markType,
      questions: parsed.questions,
    });

    res.json({ message: "Questions generated", questionSet });
  } catch (error) {
  console.error("================================");
  console.error("QUESTION GENERATION ERROR");
  console.error(error);
  console.error("MESSAGE:", error.message);
  console.error("STACK:", error.stack);
  console.error("================================");

  const failure = questionGenerationError(error);
  res.status(failure.status).json({ message: failure.message });
}
};

// GET /api/questions/:goalId — list past generated sets for this goal
exports.getQuestionSets = async (req, res) => {
  try {
    const sets = await QuestionSet.find({ goalId: req.params.goalId, userId: req.user.id }).sort({ createdAt: -1 });
    res.json(sets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/questions/:goalId/:setId
exports.deleteQuestionSet = async (req, res) => {
  try {
    await QuestionSet.findOneAndDelete({ _id: req.params.setId, goalId: req.params.goalId, userId: req.user.id });
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.syllabusFromSchedule = syllabusFromSchedule;
exports.questionGenerationError = questionGenerationError;