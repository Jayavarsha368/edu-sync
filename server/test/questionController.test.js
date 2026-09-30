const test = require("node:test");
const assert = require("node:assert/strict");
const { syllabusFromSchedule, questionGenerationError } = require("../controllers/questionController");

test("uses distinct scheduled topics for the selected subject", () => {
  const schedule = {
    days: [
      {
        tasks: [
          { subject: "EVS", topic: "Ecosystems" },
          { subject: "EVS", topic: "Ecosystems" },
          { subject: "EVS", topic: "Biodiversity" },
          { subject: "Math", topic: "Algebra" },
          { subject: "Buffer", topic: "Catch-up / light revision" },
        ],
      },
      { isRevisionDay: true, tasks: [{ subject: "EVS", topic: "Revision" }] },
    ],
  };

  assert.equal(syllabusFromSchedule(schedule, "EVS"), "EVS: Ecosystems, Biodiversity");
});

test("returns an actionable service error when AI credits are exhausted", () => {
  const failure = questionGenerationError({ status: 429, code: "insufficient_quota", message: "provider details" });

  assert.equal(failure.status, 503);
  assert.match(failure.message, /no credits remaining/i);
  assert.doesNotMatch(failure.message, /provider details/);
});

test("does not expose stack traces in question generation errors", () => {
  const failure = questionGenerationError({ message: "Unexpected provider failure", stack: "private stack" });

  assert.equal(failure.status, 500);
  assert.deepEqual(Object.keys(failure), ["status", "message"]);
});