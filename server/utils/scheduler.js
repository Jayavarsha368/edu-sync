function parseSyllabus(syllabusText) {
  return syllabusText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [subjectPart, topicsPart] = line.split(":");
      const match = subjectPart.match(/^(.*?)\s*\((weak|medium|strong)\)\s*$/i);

      let subject = subjectPart.trim();
      let level = "medium";

      if (match) {
        subject = match[1].trim();
        level = match[2].toLowerCase();
      }

      const topics = (topicsPart || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      return { subject, level, topics };
    });
}

function weightFor(level) {
  if (level === "weak") return 3;
  if (level === "strong") return 1;
  return 2;
}

function weightedInterleave(parsedSyllabus) {
  const state = parsedSyllabus.map((s) => ({
    subject: s.subject,
    topics: [...s.topics],
    weight: weightFor(s.level),
    credit: 0,
  }));

  const totalWeight = state.reduce((sum, s) => sum + s.weight, 0);
  const result = [];
  let remaining = state.reduce((sum, s) => sum + s.topics.length, 0);

  while (remaining > 0) {
    state.forEach((s) => {
      if (s.topics.length > 0) s.credit += s.weight;
    });

    let chosen = null;
    state.forEach((s) => {
      if (s.topics.length > 0 && (!chosen || s.credit > chosen.credit)) chosen = s;
    });

    if (!chosen) break;

    result.push({ subject: chosen.subject, topic: chosen.topics.shift() });
    chosen.credit -= totalWeight;
    remaining--;
  }

  return result;
}

// THE RELIABLE PART: guarantees every single topic gets placed somewhere
// between startDate and examDate — never silently dropped.
function distributeAcrossDays({ startDate, examDate, orderedTopics }) {
  const start = new Date(startDate);
  const end = new Date(examDate);

  const totalDays = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  const revisionDays = Math.max(1, Math.round(totalDays * 0.15));
  const studyDays = Math.max(1, totalDays - revisionDays);

  const totalTopics = orderedTopics.length;

  // Key fix: figure out how many topics MUST go on each study day
  // so that all topics fit within the available study days — never fewer.
  const topicsPerDay = totalTopics > 0
    ? Math.max(1, Math.ceil(totalTopics / studyDays))
    : 1;

  const queue = [...orderedTopics];
  const days = [];
  let topicIndex = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);

    const isRevisionDay = i >= studyDays;

    if (isRevisionDay) {
      days.push({
        date,
        isRevisionDay: true,
        tasks: [{ subject: "Revision", topic: "Revise weak/completed topics", completed: false }],
        dayStatus: "pending",
      });
      continue;
    }

    let tasksForDay = queue.slice(topicIndex, topicIndex + topicsPerDay)
      .map((t) => ({ subject: t.subject, topic: t.topic, completed: false }));
    topicIndex += topicsPerDay;

    // Only reached if there are literally more study days than topics (rare) —
    // give light revision instead of an empty day.
    if (tasksForDay.length === 0 && queue.length > 0) {
      const loopIndex = topicIndex % queue.length;
      const t = queue[loopIndex];
      tasksForDay = [{ subject: t.subject, topic: `Revise: ${t.topic}`, completed: false }];
    }

    days.push({
      date,
      isRevisionDay: false,
      tasks: tasksForDay.length
        ? tasksForDay
        : [{ subject: "Buffer", topic: "Catch-up / light revision", completed: false }],
      dayStatus: "pending",
    });
  }

  return days;
}

function generateSchedule({ startDate, examDate, dailyStudyHours, syllabusText }) {
  const parsed = parseSyllabus(syllabusText);
  const orderedTopics = weightedInterleave(parsed);
  return distributeAcrossDays({ startDate, examDate, orderedTopics });
}

module.exports = { parseSyllabus, weightedInterleave, distributeAcrossDays, generateSchedule };