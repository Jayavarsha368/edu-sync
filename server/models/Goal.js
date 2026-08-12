const mongoose = require("mongoose");

const GoalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    examName: String,
    course: String,
    semester: String,
    startDate: Date,
    examDate: Date,
    dailyStudyHours: Number,
    targetScore: Number,
    subjects: [String],
    syllabusText: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Goal", GoalSchema);