import { describe, it, expect } from 'vitest';
import {
  KG_TO_LBS,
  calcBMR,
  simulateLoss,
  addWeeks,
  calcStreakFromEntries,
  linearRegression,
  calcTrendFromEntries,
} from '../../src/js/utils.js';

// ── calcBMR ──────────────────────────────────────────────────────────────────
describe('calcBMR', () => {
  it('male formula', () => {
    // 180 lbs → 81.647 kg, 69 in → 175.26 cm, age 35
    // 10*81.647 + 6.25*175.26 - 5*35 + 5 ≈ 1742
    const bmr = calcBMR(180, 69, 35, 'male');
    expect(bmr).toBeCloseTo(1742, 0);
  });

  it('female formula', () => {
    // 150 lbs → 68.039 kg, 65 in → 165.1 cm, age 30
    // 10*68.039 + 6.25*165.1 - 5*30 - 161 ≈ 1401
    const bmr = calcBMR(150, 65, 30, 'female');
    expect(bmr).toBeCloseTo(1401, 0);
  });
});

// ── simulateLoss ─────────────────────────────────────────────────────────────
describe('simulateLoss', () => {
  it('returns weekly snapshots decreasing toward goal', () => {
    const weeks = simulateLoss(200, 170, 1800, 0, 1.4, 35, 69, 'male', 2);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks[0].week).toBe(1);
    const last = weeks[weeks.length - 1];
    expect(last.weight).toBeCloseTo(170, 0);
  });

  it('returns empty when already at goal', () => {
    const weeks = simulateLoss(170, 170, 1800, 0, 1.4, 35, 69, 'male', 2);
    expect(weeks).toHaveLength(0);
  });

  it('caps at 520 weeks', () => {
    // Eating at TDEE — no deficit, should cap
    const weeks = simulateLoss(200, 100, 3000, 0, 1.4, 35, 69, 'male', 0.1);
    expect(weeks.length).toBeLessThanOrEqual(520);
  });
});

// ── addWeeks ─────────────────────────────────────────────────────────────────
describe('addWeeks', () => {
  it('adds whole weeks', () => {
    const d = new Date('2025-01-01');
    const result = addWeeks(d, 4);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-29');
  });

  it('rounds fractional weeks', () => {
    const d = new Date('2025-01-01');
    // 1.9 * 7 = 13.3 → rounds to 13 days → Jan 14
    const result = addWeeks(d, 1.9);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-14');
  });
});

// ── calcStreakFromEntries ─────────────────────────────────────────────────────
describe('calcStreakFromEntries', () => {
  it('returns 0 for empty checkins', () => {
    expect(calcStreakFromEntries([])).toBe(0);
  });

  it('returns 1 for a single recent checkin', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(calcStreakFromEntries([{ date: today, weight: 180 }])).toBe(1);
  });

  it('returns 0 when last checkin is too old', () => {
    expect(calcStreakFromEntries([{ date: '2020-01-01', weight: 180 }])).toBe(0);
  });

  it('counts consecutive weekly checkins', () => {
    const now = Date.now();
    const checkins = [0, 7, 14, 21].map(daysAgo => ({
      date: new Date(now - daysAgo * 86400000).toISOString().slice(0, 10),
      weight: 180,
    }));
    expect(calcStreakFromEntries(checkins)).toBe(4);
  });

  it('breaks streak on gap', () => {
    const now = Date.now();
    // 0, 7, 21 days ago — gap between 7 and 21 breaks streak
    const checkins = [0, 7, 21].map(daysAgo => ({
      date: new Date(now - daysAgo * 86400000).toISOString().slice(0, 10),
      weight: 180,
    }));
    expect(calcStreakFromEntries(checkins)).toBe(2);
  });
});

// ── linearRegression ─────────────────────────────────────────────────────────
describe('linearRegression', () => {
  it('returns null for fewer than 2 points', () => {
    expect(linearRegression([])).toBeNull();
    expect(linearRegression([{ x: 0, y: 100 }])).toBeNull();
  });

  it('computes correct slope and intercept for perfect line', () => {
    // y = -1.5x + 200
    const pts = [0, 4, 8, 12].map(x => ({ x, y: -1.5 * x + 200 }));
    const reg = linearRegression(pts);
    expect(reg.slope).toBeCloseTo(-1.5, 5);
    expect(reg.intercept).toBeCloseTo(200, 5);
  });

  it('returns null for identical x values', () => {
    const pts = [{ x: 5, y: 100 }, { x: 5, y: 90 }];
    expect(linearRegression(pts)).toBeNull();
  });
});

// ── calcTrendFromEntries ──────────────────────────────────────────────────────
describe('calcTrendFromEntries', () => {
  it('returns null for fewer than 3 checkins', () => {
    expect(calcTrendFromEntries([], 150)).toBeNull();
    expect(calcTrendFromEntries([{ date: '2025-01-01', weight: 180 }], 150)).toBeNull();
  });

  it('returns slope and projection for declining trend', () => {
    const dates = ['2025-01-01', '2025-01-08', '2025-01-15', '2025-01-22'];
    const checkins = dates.map((date, i) => ({ date, weight: 200 - i * 1.5 }));
    const result = calcTrendFromEntries(checkins, 170);
    expect(result).not.toBeNull();
    expect(result.slope).toBeLessThan(0);
    expect(result.weeksToGoal).toBeGreaterThan(0);
    expect(result.projGoalDate).toBeInstanceOf(Date);
  });

  it('returns null weeksToGoal when trend is flat/gaining', () => {
    const dates = ['2025-01-01', '2025-01-08', '2025-01-15'];
    const checkins = dates.map(date => ({ date, weight: 180 }));
    const result = calcTrendFromEntries(checkins, 150);
    expect(result).not.toBeNull();
    expect(result.weeksToGoal).toBeNull();
  });

  it('includes n (number of points) in result', () => {
    const dates = ['2025-01-01', '2025-01-08', '2025-01-15', '2025-01-22'];
    const checkins = dates.map((date, i) => ({ date, weight: 200 - i * 1.5 }));
    const result = calcTrendFromEntries(checkins, 170);
    expect(result.n).toBe(4);
  });
});
