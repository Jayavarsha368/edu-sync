const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSyllabus, syllabusForSubject, matchesSyllabusSubjects, matchesSyllabusTopics } = require("../utils/scheduler");

test("parses the supported subject and topic format", () => {
  const parsed = parseSyllabus("DSA (Weak): Arrays, Linked List\nDBMS (Medium): SQL");

  assert.deepEqual(parsed.map(({ subject, topics }) => ({ subject, topics })), [
    { subject: "DSA", topics: ["Arrays", "Linked List"] },
    { subject: "DBMS", topics: ["SQL"] },
  ]);
});

test("scopes question syllabus to the exact selected subject", () => {
  const syllabus = "DSA (Weak): Arrays, Linked List\nDBMS (Medium): SQL, Normalization";

  assert.equal(syllabusForSubject(syllabus, "DSA"), "DSA (weak): Arrays, Linked List");
  assert.equal(syllabusForSubject(syllabus, "dsa"), "DSA (weak): Arrays, Linked List");
  assert.equal(syllabusForSubject(syllabus, "DS"), "");
  assert.equal(syllabusForSubject(syllabus, "All"), syllabus);
});

test("reports no topics for empty or unsupported syllabus text", () => {
  assert.equal(parseSyllabus("").some(({ topics }) => topics.length), false);
  assert.equal(parseSyllabus("1. Arrays\n2. Linked Lists").some(({ topics }) => topics.length), false);
});

test("requires syllabus topics for every listed subject", () => {
  const parsed = parseSyllabus("DSA (Weak): Arrays\nDBMS (Medium): SQL");

  assert.equal(matchesSyllabusSubjects(["DSA", "DBMS"], parsed), true);
  assert.equal(matchesSyllabusSubjects(["DSA", "OS"], parsed), false);
});

test("accepts only an exact ordering of all syllabus topics", () => {
  const parsed = parseSyllabus("DSA (Weak): Arrays, Stacks");

  assert.equal(matchesSyllabusTopics([
    { subject: "DSA", topic: "Stacks" },
    { subject: "DSA", topic: "Arrays" },
  ], parsed), true);
  assert.equal(matchesSyllabusTopics([
    { subject: "DSA", topic: "Arrays" },
    { subject: "DSA", topic: "Stacks" },
    { subject: "DSA", topic: "Queues" },
  ], parsed), false);
  assert.equal(matchesSyllabusTopics([
    { subject: "DSA", topic: "Arrays" },
    { subject: "DSA", topic: "Queues" },
  ], parsed), false);
});