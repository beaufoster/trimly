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
    const bmr = calcBMR(180, 69, 35, 'male');
    expect(bmr).toBeCloseTo(1742, 0);
  });

  it('female formula', () => {
    const bmr = calcBMR(150, 65, 30, 'female');
    expect(bmr).toBeCloseTo(1401, 0);
  });

  it('higher weight → higher BMR (male)', () => {
    expect(calcBMR(250, 69, 35, 'male')).toBeGreaterThan(calcBMR(150, 69, 35, 'male'));
  });

  it('older age → lower BMR', () => {
    expect(calcBMR(180, 69, 60, 'male')).toBeLessThan(calcBMR(180, 69, 25, 'male'));
  });

  it('taller → higher BMR', () => {
    expect(calcBMR(180, 75, 35, 'male')).toBeGreaterThan(calcBMR(180, 60, 35, 'male'));
  });

  it('female BMR lower than male for same stats', () => {
    expect(calcBMR(150, 65, 30, 'female')).toBeLessThan(calcBMR(150, 65, 30, 'male'));
  });

  it('returns positive number', () => {
    expect(calcBMR(100, 60, 20, 'female')).toBeGreaterThan(0);
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
    const weeks = simulateLoss(200, 100, 3000, 0, 1.4, 35, 69, 'male', 0.1);
    expect(weeks.length).toBeLessThanOrEqual(520);
  });

  it('higher deficit → fewer weeks to goal', () => {
    const fast = simulateLoss(200, 170, 1500, 0, 1.4, 35, 69, 'male', 2);
    const slow = simulateLoss(200, 170, 2200, 0, 1.4, 35, 69, 'male', 2);
    expect(fast.length).toBeLessThan(slow.length);
  });

  it('exercise reduces weeks to goal', () => {
    const withEx = simulateLoss(200, 170, 1800, 200, 1.4, 35, 69, 'male', 2);
    const noEx   = simulateLoss(200, 170, 1800, 0,   1.4, 35, 69, 'male', 2);
    expect(withEx.length).toBeLessThan(noEx.length);
  });

  it('each week number is sequential', () => {
    const weeks = simulateLoss(200, 170, 1800, 0, 1.4, 35, 69, 'male', 2);
    weeks.forEach((w, i) => expect(w.week).toBe(i + 1));
  });

  it('weight is always decreasing', () => {
    const weeks = simulateLoss(200, 170, 1800, 0, 1.4, 35, 69, 'male', 2);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].weight).toBeLessThanOrEqual(weeks[i-1].weight);
    }
  });

  it('final weight is at or below goal', () => {
    const weeks = simulateLoss(200, 170, 1800, 0, 1.4, 35, 69, 'male', 2);
    if (weeks.length) expect(weeks[weeks.length-1].weight).toBeLessThanOrEqual(170.5);
  });

  it('female simulation works', () => {
    const weeks = simulateLoss(160, 130, 1400, 0, 1.4, 30, 65, 'female', 1.5);
    expect(weeks.length).toBeGreaterThan(0);
  });
});

// ── addWeeks ─────────────────────────────────────────────────────────────────
describe('addWeeks', () => {
  it('adds whole weeks', () => {
    const d = new Date('2025-01-01');
    expect(addWeeks(d, 4).toISOString().slice(0,10)).toBe('2025-01-29');
  });

  it('rounds fractional weeks', () => {
    const d = new Date('2025-01-01');
    expect(addWeeks(d, 1.9).toISOString().slice(0,10)).toBe('2025-01-14');
  });

  it('adding 0 weeks returns same date', () => {
    const d = new Date('2025-06-15');
    expect(addWeeks(d, 0).toISOString().slice(0,10)).toBe('2025-06-15');
  });

  it('handles year boundary', () => {
    const d = new Date('2024-12-25');
    expect(addWeeks(d, 2).toISOString().slice(0,10)).toBe('2025-01-08');
  });

  it('does not mutate input date', () => {
    const d = new Date('2025-01-01');
    const before = d.toISOString();
    addWeeks(d, 3);
    expect(d.toISOString()).toBe(before);
  });
});

// ── calcStreakFromEntries ─────────────────────────────────────────────────────
describe('calcStreakFromEntries', () => {
  it('returns 0 for empty checkins', () => {
    expect(calcStreakFromEntries([])).toBe(0);
  });

  it('returns 1 for a single recent checkin', () => {
    const today = new Date().toISOString().slice(0,10);
    expect(calcStreakFromEntries([{ date: today, weight: 180 }])).toBe(1);
  });

  it('returns 0 when last checkin is too old', () => {
    expect(calcStreakFromEntries([{ date: '2020-01-01', weight: 180 }])).toBe(0);
  });

  it('counts consecutive weekly checkins', () => {
    const now = Date.now();
    const checkins = [0,7,14,21].map(d => ({
      date: new Date(now - d*86400000).toISOString().slice(0,10), weight: 180,
    }));
    expect(calcStreakFromEntries(checkins)).toBe(4);
  });

  it('breaks streak on gap', () => {
    const now = Date.now();
    const checkins = [0,7,21].map(d => ({
      date: new Date(now - d*86400000).toISOString().slice(0,10), weight: 180,
    }));
    expect(calcStreakFromEntries(checkins)).toBe(2);
  });

  it('handles unsorted input (still counts correctly)', () => {
    const now = Date.now();
    const checkins = [7,0,14].map(d => ({
      date: new Date(now - d*86400000).toISOString().slice(0,10), weight: 180,
    }));
    expect(calcStreakFromEntries(checkins)).toBe(3);
  });

  it('long streak of 10 weeks', () => {
    const now = Date.now();
    const checkins = Array.from({length:10},(_,i) => ({
      date: new Date(now - i*7*86400000).toISOString().slice(0,10), weight: 180,
    }));
    expect(calcStreakFromEntries(checkins)).toBe(10);
  });
});

// ── linearRegression ─────────────────────────────────────────────────────────
describe('linearRegression', () => {
  it('returns null for empty array', () => {
    expect(linearRegression([])).toBeNull();
  });

  it('returns null for single point', () => {
    expect(linearRegression([{ x:0, y:100 }])).toBeNull();
  });

  it('computes correct slope and intercept for perfect line', () => {
    const pts = [0,4,8,12].map(x => ({ x, y: -1.5*x + 200 }));
    const reg = linearRegression(pts);
    expect(reg.slope).toBeCloseTo(-1.5, 5);
    expect(reg.intercept).toBeCloseTo(200, 5);
  });

  it('returns null for identical x values', () => {
    expect(linearRegression([{x:5,y:100},{x:5,y:90}])).toBeNull();
  });

  it('flat data produces slope near 0', () => {
    const pts = [0,1,2,3,4].map(x => ({ x, y: 150 }));
    expect(Math.abs(linearRegression(pts).slope)).toBeCloseTo(0, 5);
  });

  it('handles negative slope', () => {
    const pts = [0,7,14,21].map((x,i) => ({ x, y: 200 - i*2 }));
    expect(linearRegression(pts).slope).toBeLessThan(0);
  });

  it('handles positive slope (gaining weight)', () => {
    const pts = [0,7,14,21].map((x,i) => ({ x, y: 150 + i*2 }));
    expect(linearRegression(pts).slope).toBeGreaterThan(0);
  });

  it('result has slope and intercept properties', () => {
    const pts = [{x:0,y:100},{x:7,y:98}];
    const reg = linearRegression(pts);
    expect(reg).toHaveProperty('slope');
    expect(reg).toHaveProperty('intercept');
  });
});

// ── calcTrendFromEntries ──────────────────────────────────────────────────────
describe('calcTrendFromEntries', () => {
  it('returns null for fewer than 3 checkins', () => {
    expect(calcTrendFromEntries([], 150)).toBeNull();
    expect(calcTrendFromEntries([{date:'2025-01-01',weight:180}], 150)).toBeNull();
    expect(calcTrendFromEntries([{date:'2025-01-01',weight:180},{date:'2025-01-08',weight:179}], 150)).toBeNull();
  });

  it('returns result with 3 checkins', () => {
    const dates = ['2025-01-01','2025-01-08','2025-01-15'];
    const checkins = dates.map((d,i) => ({ date:d, weight:200-i*1.5 }));
    expect(calcTrendFromEntries(checkins, 170)).not.toBeNull();
  });

  it('returns slope and projection for declining trend', () => {
    const dates = ['2025-01-01','2025-01-08','2025-01-15','2025-01-22'];
    const checkins = dates.map((date,i) => ({ date, weight: 200-i*1.5 }));
    const result = calcTrendFromEntries(checkins, 170);
    expect(result.slope).toBeLessThan(0);
    expect(result.weeksToGoal).toBeGreaterThan(0);
    expect(result.projGoalDate).toBeInstanceOf(Date);
  });

  it('returns null weeksToGoal when flat/gaining', () => {
    const dates = ['2025-01-01','2025-01-08','2025-01-15'];
    const checkins = dates.map(date => ({ date, weight: 180 }));
    const result = calcTrendFromEntries(checkins, 150);
    expect(result.weeksToGoal).toBeNull();
  });

  it('includes n in result', () => {
    const dates = ['2025-01-01','2025-01-08','2025-01-15','2025-01-22'];
    const checkins = dates.map((date,i) => ({ date, weight: 200-i*1.5 }));
    expect(calcTrendFromEntries(checkins, 170).n).toBe(4);
  });

  it('already past goal → weeksToGoal null or zero', () => {
    const dates = ['2025-01-01','2025-01-08','2025-01-15'];
    const checkins = dates.map((date,i) => ({ date, weight: 150-i }));
    const result = calcTrendFromEntries(checkins, 160);
    expect(result.weeksToGoal == null || result.weeksToGoal <= 0).toBe(true);
  });
});
