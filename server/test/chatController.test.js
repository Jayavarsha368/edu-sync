const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructuredAiResponse } = require('../controllers/chatController');

test('returns a friendly fallback when the model emits an empty JSON object', () => {
  const result = parseStructuredAiResponse('{}', 'hello');

  assert.equal(result.intent, 'general_reply');
  assert.match(result.reply, /hello|study assistant|help/i);
});

test('parses a valid JSON response from the model', () => {
  const result = parseStructuredAiResponse('{"intent":"general_reply","reply":"Hi! I am here to help."}');

  assert.equal(result.intent, 'general_reply');
  assert.equal(result.reply, 'Hi! I am here to help.');
});
