const Goal = require("../models/Goal");
const Schedule = require("../models/Schedule");
const { generateScheduleWithAI } = require("../utils/aiScheduler");
const { parseSyllabus, matchesSyllabusSubjects } = require("../utils/scheduler");

exports.createGoal = async (req, res) => {
  try {
    const { examName, course, semester, startDate, examDate, dailyStudyHours, targetScore, subjects, syllabusText } = req.body;

    const parsedSyllabus = parseSyllabus(syllabusText);
    if (!parsedSyllabus.some(({ topics }) => topics.length > 0)) {
      return res.status(400).json({
        message: "Add syllabus topics using 'Subject (Weak/Medium/Strong): topic, topic' before generating a plan.",
      });
    }
    if (!matchesSyllabusSubjects(subjects, parsedSyllabus)) {
      return res.status(400).json({ message: "Add syllabus topics for every subject listed before generating a plan." });
    }

    const goal = await Goal.create({
      userId: req.user.id, examName, course, semester, startDate, examDate,
      dailyStudyHours, targetScore, subjects, syllabusText,
    });

    const { days, generatedBy } = await generateScheduleWithAI({
      startDate: goal.startDate, examDate: goal.examDate,
      dailyStudyHours: goal.dailyStudyHours, syllabusText: goal.syllabusText, examName: goal.examName,
    });

    const schedule = await Schedule.create({ userId: req.user.id, goalId: goal._id, days });

    res.json({
      message: generatedBy === "ai" ? "AI generated your study plan" : "Study plan generated",
      goal, schedule,
    });
  } catch (error) {
    console.error("[createGoal]", error.message);
    res.status(500).json({ message: error.message || "Failed to create goal" });
  }
};

exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.user.id }).sort({ examDate: 1 });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    res.json(goal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    const { examName, course, semester, startDate, examDate, dailyStudyHours, targetScore, subjects, syllabusText } = req.body;
    const parsedSyllabus = parseSyllabus(syllabusText);
    if (!parsedSyllabus.some(({ topics }) => topics.length > 0)) {
      return res.status(400).json({
        message: "Add syllabus topics using 'Subject (Weak/Medium/Strong): topic, topic' before generating a plan.",
      });
    }
    if (!matchesSyllabusSubjects(subjects, parsedSyllabus)) {
      return res.status(400).json({ message: "Add syllabus topics for every subject listed before generating a plan." });
    }

    goal.examName = examName;
    goal.course = course;
    goal.semester = semester;
    goal.startDate = startDate;
    goal.examDate = examDate;
    goal.dailyStudyHours = dailyStudyHours;
    goal.targetScore = targetScore;
    goal.subjects = subjects;
    goal.syllabusText = syllabusText;
    await goal.save();

    const { days, generatedBy } = await generateScheduleWithAI({
      startDate: goal.startDate, examDate: goal.examDate,
      dailyStudyHours: goal.dailyStudyHours, syllabusText: goal.syllabusText, examName: goal.examName,
    });

    await Schedule.findOneAndDelete({ goalId: goal._id });
    const schedule = await Schedule.create({ userId: req.user.id, goalId: goal._id, days });

    res.json({
      message: generatedBy === "ai" ? "AI updated your study plan" : "Study plan updated",
      goal, schedule,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    await Schedule.findOneAndDelete({ goalId: req.params.id });
    res.json({ message: "Goal deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ message: "Subject name required" });

    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    goal.syllabusText = goal.syllabusText
      .split("\n")
      .filter((line) => {
        const namePart = line.split(":")[0].replace(/\(.*?\)/, "").trim().toLowerCase();
        return namePart !== subject.trim().toLowerCase();
      })
      .join("\n");

    goal.subjects = (goal.subjects || []).filter(
      (s) => s.trim().toLowerCase() !== subject.trim().toLowerCase()
    );

    await goal.save();

    const schedule = await Schedule.findOne({ goalId: goal._id });
    if (schedule) {
      schedule.days.forEach((day) => {
        day.tasks = day.tasks.filter((t) => t.subject !== subject);
        if (day.tasks.length === 0 && !day.isRevisionDay) {
          day.tasks.push({ subject: "Buffer", topic: "Free day / catch-up", completed: false });
        }
        const allDone = day.tasks.every((t) => t.completed);
        const someDone = day.tasks.some((t) => t.completed);
        day.dayStatus = allDone ? "completed" : someDone ? "partial" : "pending";
      });
      await schedule.save();
    }

    res.json({ message: `${subject} removed from your plan`, goal, schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};