const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  subject: String,
  topic: String,
  completed: { type: Boolean, default: false },
});

const DaySchema = new mongoose.Schema({
  date: Date,
  isRevisionDay: { type: Boolean, default: false },
  tasks: [TaskSchema],
  dayStatus: { type: String, enum: ["pending", "completed", "partial"], default: "pending" },
});

const ScheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: "Goal", required: true, unique: true },
    days: [DaySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Schedule", ScheduleSchema);