const Groq = require("groq-sdk");
const QuestionSet = require("../models/QuestionSet");
const Goal = require("../models/Goal");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const COUNT_BY_TYPE = { mcq: 10, "1": 10, "2": 8, "7": 5, "14": 3 };

const INSTRUCTIONS_BY_TYPE = {
  mcq: "Generate multiple-choice questions. Each must have exactly 4 options and one correct answer.",
  "1": "Generate 1-mark questions — short, direct, testing a single fact or definition. Answers should be 1-2 sentences.",
  "2": "Generate 2-mark questions — slightly more detail than 1-mark, testing understanding of a concept. Answers should be 2-4 sentences.",
  "7": "Generate 7-mark questions — these require a structured, detailed answer covering multiple points, like 'Explain X with its types/advantages' or 'Describe the process of Y'. Answers should be a well-organized paragraph or short-point list covering several aspects.",
  "14": "Generate 14-mark questions — these are the most comprehensive, essay-style questions covering an entire topic or unit in depth, often combining multiple sub-parts (e.g., 'Explain X in detail, including its architecture, advantages, and applications'). Answers should be thorough, well-structured, and cover multiple sub-points comprehensively.",
};

// POST /api/questions/:goalId  { subject, markType }
exports.generateQuestions = async (req, res) => {
  try {
    const { subject, markType } = req.body;
    if (!markType || !COUNT_BY_TYPE[markType]) {
      return res.status(400).json({ message: "Invalid or missing markType" });
    }

    const goal = await Goal.findOne({ _id: req.params.goalId, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    const syllabusScope = subject && subject !== "All"
      ? goal.syllabusText.split("\n").filter((line) => line.toLowerCase().includes(subject.toLowerCase())).join("\n")
      : goal.syllabusText;

    if (!syllabusScope || !syllabusScope.trim()) {
      return res.status(400).json({ message: "No syllabus content found for this subject" });
    }

    const count = COUNT_BY_TYPE[markType];
    const isMCQ = markType === "mcq";

    const prompt = `You are an exam question paper setter for the subject/syllabus below.

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

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return res.status(500).json({ message: "AI did not return valid questions. Try again." });
    }

    const questionSet = await QuestionSet.create({
      userId: req.user.id,
      goalId: req.params.goalId,
      subject: subject || "All",
      markType,
      questions: parsed.questions,
    });

    res.json({ message: "Questions generated", questionSet });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to generate questions" });
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