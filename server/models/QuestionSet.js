const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: String,
  options: [String], // only used for MCQ
  answer: String,
});

const QuestionSetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: "Goal", required: true },
    subject: { type: String, default: "All" },
    markType: { type: String, enum: ["mcq", "1", "2", "7", "14"], required: true },
    questions: [QuestionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuestionSet", QuestionSetSchema);