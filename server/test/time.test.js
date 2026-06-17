import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayInTz, addDays, diffDays, weekdayInTz } from '../time.js';

test('dayInTz returns the local calendar day for the given timezone', () => {
  // 23:30 UTC is already the next calendar day in Berlin (+1).
  const instant = new Date('2026-01-15T23:30:00Z');
  assert.equal(dayInTz('UTC', instant), '2026-01-15');
  assert.equal(dayInTz('Europe/Berlin', instant), '2026-01-16');
});

test('addDays crosses month, year and leap-day boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29'); // leap year
  assert.equal(addDays('2026-06-17', 0), '2026-06-17');
});

test('diffDays is signed and handles boundaries', () => {
  assert.equal(diffDays('2026-01-01', '2026-01-10'), 9);
  assert.equal(diffDays('2026-01-10', '2026-01-01'), -9);
  assert.equal(diffDays('2026-06-17', '2026-06-17'), 0);
  assert.equal(diffDays('2025-12-31', '2026-01-01'), 1);
  assert.equal(diffDays('2024-02-28', '2024-03-01'), 2); // leap February
});

test('weekdayInTz: 0=Sunday … 6=Saturday', () => {
  // 2026-01-15 is a Thursday.
  assert.equal(weekdayInTz('UTC', new Date('2026-01-15T12:00:00Z')), 4);
  // 2026-01-18 is a Sunday.
  assert.equal(weekdayInTz('UTC', new Date('2026-01-18T12:00:00Z')), 0);
});

test('addDays and diffDays are inverse over a range', () => {
  let d = '2026-01-01';
  for (let i = 0; i < 70; i++) d = addDays(d, 1);
  assert.equal(diffDays('2026-01-01', d), 70);
});
