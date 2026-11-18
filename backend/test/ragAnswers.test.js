import test from 'node:test';
import assert from 'node:assert/strict';

// The Gemini client reads its key on import, so set one before loading the agent.
process.env.GEMINI_API_KEY = 'test-key';
const { answerQuestion } = await import('../src/agents/ragAgent.js');

const scanned = 'The access moditiers. in, va 5 a ies Ihe acess-, We aan tag the access esl. of fds, constr, pis ,and class by applying acess moditer on 3 There are. four Types of Java access. modifier CIORRRE nl. acess oll is acne any bio els ale vid mg 01 sgn: public class simple? Method Overriding in Java re IF subclass (child dass) has the same method as declned in the parent class, it is known as method overriding {in he In other wads, i} a subclass provides, the speific imp ementation of 4he method that had been declared by ones of ts patent class';
const clean = 'A class in Java is a blueprint that defines the fields and methods of objects. An object is an instance of a class. Method overriding happens when a subclass provides its own implementation of a parent method.';

const aiReplies = (answer) => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ answer, citations: [], confidence: 0 }) }] } }],
  }));
};
const aiIsDown = () => {
  globalThis.fetch = async () => new Response('busy', { status: 503 });
};
const ask = (question, text) => answerQuestion({ userId: 'rag-test', question, text, sourceName: 'Notes' });

// Runs first because a failed AI call pauses the client for the rest of the file.
test('an AI refusal is not replaced by keyword matches', async () => {
  aiReplies('NOT_FOUND');
  const result = await ask('what is class in java', clean);
  assert.equal(result.grounded, false);
  assert.deepEqual(result.citations, []);
  assert.doesNotMatch(result.answer, /blueprint/);
});

test('garbled OCR is not returned as an answer when AI is down', async () => {
  aiIsDown();
  const result = await ask('what is class in java', scanned);
  assert.equal(result.grounded, false);
  assert.deepEqual(result.citations, []);
  assert.doesNotMatch(result.answer, /declned|moditer/);
});

test('readable notes still answer when AI is down', async () => {
  aiIsDown();
  const result = await ask('what is class in java', clean);
  assert.equal(result.grounded, true);
  assert.equal(result.engine, 'extractive');
  assert.match(result.answer, /blueprint/);
});
