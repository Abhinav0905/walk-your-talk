import {test} from "node:test";
import assert from "node:assert/strict";
import {PalaceModel, SAMPLE_TOAST, type Grade} from "../Assets/Scripts/PalaceModel.ts";

function built(): PalaceModel {
  const m = new PalaceModel();
  m.start();
  for (let i = 0; i < m.count; i++) m.place(i);
  return m;
}

function walked(m = built()): PalaceModel {
  for (const i of [...m.queue]) m.arrive(i);
  return m;
}

function recall(m: PalaceModel, grades: Grade[]): void {
  m.beginRecall();
  for (const [k, i] of [...m.queue].entries()) {
    m.reveal(i);
    m.grade(i, grades[k]);
  }
}

test("the sample talk is five short beats with distinct images", () => {
  assert.equal(SAMPLE_TOAST.length, 5);
  assert.equal(new Set(SAMPLE_TOAST.map(b => b.image)).size, 5);
  for (const b of SAMPLE_TOAST) assert.ok(b.cue.split(" ").length <= 7, "glanceable cue: " + b.cue);
});

test("beats are placed strictly in route order", () => {
  const m = new PalaceModel();
  assert.equal(m.place(0).kind, "ignored", "cannot place before starting");
  m.start();
  assert.equal(m.place(2).kind, "ignored", "cannot skip ahead");
  assert.equal(m.place(0).kind, "placed");
  assert.equal(m.place(0).kind, "ignored", "cannot place twice");
  assert.equal(m.focus, 1);
});

test("placing the last beat finishes the build and starts the walk", () => {
  const m = built();
  assert.equal(m.phase, "walk");
  assert.deepEqual(m.queue, [0, 1, 2, 3, 4]);
  assert.equal(m.focus, 0);
  assert.equal(m.log.at(-1)?.kind, "built");
});

test("only the next spot on the route counts as arriving", () => {
  const m = built();
  assert.equal(m.arrive(3).kind, "ignored");
  assert.equal(m.arrive(0).kind, "arrived");
  assert.equal(m.arrive(0).kind, "ignored", "no double arrival");
  assert.equal(m.focus, 1);
});

test("recall cannot start until the whole route is walked", () => {
  const m = built();
  m.arrive(0); m.arrive(1);
  assert.equal(m.beginRecall().kind, "ignored");
  m.arrive(2); m.arrive(3);
  assert.equal(m.arrive(4).kind, "walked");
  assert.equal(m.beginRecall().kind, "recallStarted");
});

test("a beat can only be graded after it is revealed", () => {
  const m = walked();
  m.beginRecall();
  assert.equal(m.grade(0, "got").kind, "ignored");
  m.reveal(0);
  assert.equal(m.grade(0, "got").kind, "graded");
  assert.equal(m.grade(0, "missed").kind, "ignored", "a grade is final");
});

test("first-pass score and missed beats are reported honestly", () => {
  const m = walked();
  recall(m, ["got", "got", "got", "missed", "got"]);
  assert.equal(m.phase, "debrief");
  assert.deepEqual(m.firstPassScore(), {got: 4, total: 5});
  assert.deepEqual(m.missed, [3]);
});

test("practice walks and recalls only the missed beats, first pass stays fixed", () => {
  const m = walked();
  recall(m, ["got", "missed", "got", "missed", "got"]);
  assert.equal(m.practiceMissed().kind, "practice");
  assert.equal(m.round, 2);
  assert.deepEqual(m.queue, [1, 3]);
  assert.equal(m.focus, 1);
  assert.equal(m.arrive(0).kind, "ignored", "recalled beats are not on the practice route");
  m.arrive(1); m.arrive(3);
  recall(m, ["got", "got"]);
  assert.equal(m.phase, "debrief");
  assert.deepEqual(m.passScore(), {got: 2, total: 2});
  assert.deepEqual(m.firstPassScore(), {got: 3, total: 5}, "practice never rewrites the first pass");
  assert.equal(m.practiceMissed().kind, "ignored", "nothing left to practice");
});

test("restart clears everything back to the intro", () => {
  const m = walked();
  recall(m, ["missed", "got", "got", "got", "got"]);
  m.restart();
  assert.equal(m.phase, "intro");
  assert.equal(m.focus, -1);
  assert.ok(m.placed.every(p => !p));
  assert.ok(m.firstPass.every(g => g === null));
  assert.equal(m.round, 1);
});

test("every random action sequence keeps the model consistent", () => {
  // Small seeded fuzz: whatever the user pinches, state never contradicts itself.
  let seed = 7;
  const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let run = 0; run < 400; run++) {
    const m = new PalaceModel();
    for (let step = 0; step < 60; step++) {
      const i = rand(5);
      switch (rand(8)) {
        case 0: m.start(); break;
        case 1: m.place(i); break;
        case 2: m.arrive(i); break;
        case 3: m.beginRecall(); break;
        case 4: m.reveal(i); break;
        case 5: m.grade(i, rand(2) ? "got" : "missed"); break;
        case 6: m.practiceMissed(); break;
        case 7: if (rand(10) === 0) m.restart(); break;
      }
      // Invariants
      if (m.phase === "build") assert.ok(m.focus >= 0 && !m.placed[m.focus]);
      if (m.phase === "walk" || m.phase === "recall" || m.phase === "debrief") assert.ok(m.placed.every(Boolean));
      for (let k = 0; k < 5; k++) if (m.grades[k] !== null) assert.ok(m.revealed[k], "graded implies revealed");
      if (m.phase === "debrief") assert.ok(m.queue.every(k => m.grades[k] !== null));
      if (m.round === 1) for (let k = 0; k < 5; k++) if (m.firstPass[k] !== null) assert.equal(m.firstPass[k], m.grades[k]);
    }
  }
});
