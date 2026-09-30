const Schedule = require("../models/Schedule");
const Goal = require("../models/Goal");
const QuestionSet = require("../models/QuestionSet");
const { generateQuestions } = require("../utils/aiQuestionGenerator");

const NON_STUDY_SUBJECTS = new Set(["Rest", "Rescheduled", "Buffer", "Revision"]);

async function generatePracticeForCompletedTask({ schedule, goal, task }) {
  if (!task.completed || NON_STUDY_SUBJECTS.has(task.subject)) return [];

  const generatedSets = [];
  const topicExists = await QuestionSet.exists({
    goalId: goal._id,
    userId: goal.userId,
    scope: "topic",
    subject: task.subject,
    topic: task.topic,
  });

  if (!topicExists) {
    const topicResult = await generateQuestions({
      syllabus: goal.syllabusText,
      subject: task.subject,
      topic: task.topic,
      scope: "topic",
    });
    generatedSets.push(await QuestionSet.create({
      userId: goal.userId,
      goalId: goal._id,
      subject: task.subject,
      scope: "topic",
      topic: task.topic,
      markType: topicResult.markType,
      questions: topicResult.questions,
    }));
  }

  const subjectTasks = schedule.days
    .flatMap((day) => day.tasks)
    .filter((item) => item.subject === task.subject);
  const chapterComplete = subjectTasks.length > 0 && subjectTasks.every((item) => item.completed);
  const chapterExists = await QuestionSet.exists({
    goalId: goal._id,
    userId: goal.userId,
    scope: "chapter",
    subject: task.subject,
  });

  if (chapterComplete && !chapterExists) {
    const chapterTopics = [...new Set(subjectTasks.map((item) => item.topic))];
    const chapterResult = await generateQuestions({
      syllabus: goal.syllabusText,
      subject: task.subject,
      topic: chapterTopics,
      scope: "chapter",
    });
    generatedSets.push(await QuestionSet.create({
      userId: goal.userId,
      goalId: goal._id,
      subject: task.subject,
      scope: "chapter",
      markType: chapterResult.markType,
      questions: chapterResult.questions,
    }));
  }

  return generatedSets;
}

exports.getSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { dayId, taskId, completed } = req.body;

    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });

    const day = schedule.days.id(dayId);
    if (!day) return res.status(404).json({ message: "Day not found" });

    const task = day.tasks.id(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.completed = completed;

    const allDone = day.tasks.every((t) => t.completed);
    const someDone = day.tasks.some((t) => t.completed);
    day.dayStatus = allDone ? "completed" : someDone ? "partial" : "pending";

    await schedule.save();
    let generatedSets = [];
    if (completed) {
      const goal = await Goal.findOne({ _id: req.params.goalId, userId: req.user.id });
      if (goal) {
        generatePracticeForCompletedTask({ schedule, goal, task })
          .catch((questionError) => console.error("Practice question generation failed:", questionError));
      }
    }
    res.json({
      message: completed ? "Task updated. Practice questions are generating in the background." : "Task updated",
      schedule,
      generatedSets,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.reallocateDay = async (req, res) => {
  try {
    const { dayId } = req.body;

    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });

    const dayIndex = schedule.days.findIndex((d) => d._id.toString() === dayId);
    if (dayIndex === -1) return res.status(404).json({ message: "Day not found" });

    const day = schedule.days[dayIndex];
    const pendingTasks = day.tasks.filter((t) => !t.completed);

    if (pendingTasks.length === 0) {
      return res.json({ message: "Nothing pending on this day", schedule });
    }

    const futureDays = schedule.days
      .map((d, idx) => ({ d, idx }))
      .filter(({ d, idx }) => idx > dayIndex && !d.isRevisionDay);

    if (futureDays.length === 0) {
      const lastStudyDay = [...schedule.days].reverse().find((d) => !d.isRevisionDay);
      if (lastStudyDay) {
        lastStudyDay.tasks.push(...pendingTasks.map((t) => ({ subject: t.subject, topic: t.topic, completed: false })));
      }
    } else {
      pendingTasks.forEach((task, i) => {
        const target = futureDays[i % futureDays.length].d;
        target.tasks.push({ subject: task.subject, topic: task.topic, completed: false });
      });
    }

    day.tasks = day.tasks.filter((t) => t.completed);
    if (day.tasks.length === 0) {
      day.tasks.push({ subject: "Rest", topic: "Rescheduled — no tasks left today", completed: true });
    }
    day.dayStatus = "completed";

    await schedule.save();
    res.json({ message: "Pending topics rescheduled successfully", schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.autoReschedulePastDays = async (req, res) => {
  try {
    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let anyRescheduled = false;

    for (let dayIndex = 0; dayIndex < schedule.days.length; dayIndex++) {
      const day = schedule.days[dayIndex];
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);

      if (dayDate >= today) break;
      if (day.isRevisionDay) continue;

      const pendingTasks = day.tasks.filter((t) => !t.completed);
      if (pendingTasks.length === 0) continue;

      anyRescheduled = true;

      const futureDays = schedule.days
        .map((d, idx) => ({ d, idx }))
        .filter(({ d, idx }) => idx > dayIndex && !d.isRevisionDay);

      if (futureDays.length === 0) {
        const lastStudyDay = [...schedule.days].reverse().find((d) => !d.isRevisionDay);
        if (lastStudyDay) {
          lastStudyDay.tasks.push(...pendingTasks.map((t) => ({ subject: t.subject, topic: t.topic, completed: false })));
        }
      } else {
        pendingTasks.forEach((task, i) => {
          const target = futureDays[i % futureDays.length].d;
          target.tasks.push({ subject: task.subject, topic: task.topic, completed: false });
        });
      }

      day.tasks = day.tasks.filter((t) => t.completed);
      if (day.tasks.length === 0) {
        day.tasks.push({ subject: "Rescheduled", topic: "Missed topics moved to upcoming days", completed: true });
      }
      day.dayStatus = "completed";
    }

    if (anyRescheduled) await schedule.save();

    res.json({ message: anyRescheduled ? "Missed topics were automatically rescheduled" : "Nothing to reschedule", schedule, rescheduled: anyRescheduled });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.completeDay = async (req, res) => {
  try {
    const { dayId, taskIds } = req.body;

    const schedule = await Schedule.findOne({ goalId: req.params.goalId, userId: req.user.id });
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });

    const dayIndex = schedule.days.findIndex((d) => d._id.toString() === dayId);
    if (dayIndex === -1) return res.status(404).json({ message: "Day not found" });

    const day = schedule.days[dayIndex];

    const pendingTasks = taskIds && taskIds.length
      ? day.tasks.filter((t) => taskIds.includes(t._id.toString()) && !t.completed)
      : day.tasks.filter((t) => !t.completed);

    if (pendingTasks.length === 0) {
      if (day.tasks.every((t) => t.completed)) day.dayStatus = "completed";
      await schedule.save();
      return res.json({ message: "Day marked as completed", schedule, movedCount: 0 });
    }

    let nextDay = null;
    for (let i = dayIndex + 1; i < schedule.days.length; i++) {
      if (!schedule.days[i].isRevisionDay) {
        nextDay = schedule.days[i];
        break;
      }
    }

    if (nextDay) {
      nextDay.tasks.push(...pendingTasks.map((t) => ({ subject: t.subject, topic: t.topic, completed: false })));
    } else {
      const lastStudyDay = [...schedule.days].reverse().find((d) => !d.isRevisionDay);
      if (lastStudyDay) {
        lastStudyDay.tasks.push(...pendingTasks.map((t) => ({ subject: t.subject, topic: t.topic, completed: false })));
      }
    }

    const movedIds = pendingTasks.map((t) => t._id.toString());
    day.tasks = day.tasks.filter((t) => !movedIds.includes(t._id.toString()));
    if (day.tasks.length === 0) {
      day.tasks.push({ subject: "Rescheduled", topic: "Unfinished topics moved to tomorrow", completed: true });
    }

    if (day.tasks.every((t) => t.completed)) day.dayStatus = "completed";

    await schedule.save();
    res.json({ message: `${pendingTasks.length} topic(s) moved to the next day`, schedule, movedCount: pendingTasks.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};