import assert from 'node:assert/strict';
import test from 'node:test';
import { TrailRun } from '../games/timberline-dash/trail.js';

// Drive the ordinary one-button input against the real Cannon world.
function followTrail(run, limit, skip = '') {
  let last = '';
  for (let frame = 0; frame < limit && !run.failure; frame++) {
    const next = run.upcoming();
    if (run.sliding && next.kind !== 'slide') run.release();
    const id = run.index + next.kind;
    const lead = next.kind === 'jump' ? .38 : .75;
    if (id !== last && next.kind !== skip && next.remaining < run.speed * lead) {
      run.press();
      if (next.kind !== 'slide') run.release();
      last = id;
    }
    run.tick();
    if (!run.missed) assert.ok(run.footY > -.1, 'Fox fell through a trestle');
  }
}

test('the one-button runner clears repeated bends and lands on perpendicular decks at full speed', () => {
  const events = new Set();
  const run = new TrailRun(35, event => events.add(event));
  followTrail(run, 11000);
  assert.equal(run.failure, '');
  assert.ok(run.index > 20);
  assert.ok(run.speed > 11.7);
  assert.ok(run.sections.length <= 5);
  assert.deepEqual([...events].sort(), ['corner', 'jump', 'slide', 'turn']);
});

for (const kind of ['jump', 'slide', 'turn']) {
  test('missing the required ' + kind + ' ends the run', () => {
    const run = new TrailRun(194);
    followTrail(run, 1000, kind);
    assert.equal(run.failure, kind);
    assert.equal(run.index, 0);
    if (kind === 'turn') assert.ok(run.footY < -1.7);
  });
}
