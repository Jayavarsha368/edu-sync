const Groq = require("groq-sdk");
const { parseSyllabus, weightedInterleave, distributeAcrossDays } = require("./scheduler");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateScheduleWithAI({ startDate, examDate, dailyStudyHours, syllabusText, examName }) {
  const parsed = parseSyllabus(syllabusText);
  const fallbackOrder = weightedInterleave(parsed);

  let orderedTopics = fallbackOrder;
  let generatedBy = "fallback";

  try {
    const prompt = `You are a study planning assistant helping with: "${examName}".

Syllabus (format "Subject (Weak/Medium/Strong): topic, topic, ..."):
${syllabusText}

Decide the BEST ORDER to study these topics in, so that:
- Weak subjects are revisited more frequently, spaced throughout, not all at once.
- Related/foundational topics come before topics that depend on them.
- Subjects are interleaved (don't finish one subject before starting the next).

Return ONLY valid JSON, no explanation, in exactly this shape — include EVERY topic from the syllabus exactly once, do not skip any, do not summarize, do not truncate:
{
  "orderedTopics": [
    { "subject": "DSA", "topic": "Arrays" },
    { "subject": "DBMS", "topic": "ER Model" }
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(raw);

    const totalExpectedTopics = parsed.reduce((sum, s) => sum + s.topics.length, 0);

    if (
      Array.isArray(parsedResponse.orderedTopics) &&
      parsedResponse.orderedTopics.length >= totalExpectedTopics
    ) {
      orderedTopics = parsedResponse.orderedTopics.map((t) => ({
        subject: t.subject || "General",
        topic: t.topic || "Review",
      }));
      generatedBy = "ai";
    } else {
      console.log(
        `AI returned ${parsedResponse.orderedTopics?.length || 0} topics, expected ${totalExpectedTopics}. Using rule-based order instead.`
      );
    }
  } catch (error) {
    console.log("AI ordering failed, using rule-based fallback:", error.message);
  }

  const days = distributeAcrossDays({ startDate, examDate, orderedTopics });

  return { days, generatedBy };
}

module.exports = { generateScheduleWithAI };