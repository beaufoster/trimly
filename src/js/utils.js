// Pure logic functions — imported by app.js and by unit tests

export const KG_TO_LBS = 2.20462;

export function calcBMR(wt, ht, age, sex) {
  const kg = wt * 0.453592, cm = ht * 2.54;
  return sex === 'male'
    ? 10 * kg + 6.25 * cm - 5 * age + 5
    : 10 * kg + 6.25 * cm - 5 * age - 161;
}

export function simulateLoss(startWt, goalWt, calIntake, exPerDay, actMult, age, ht, sex, maxLbs) {
  const weeks = []; let wt = startWt, w = 0;
  while (wt > goalWt + 0.05 && w < 520) {
    const bmr = calcBMR(wt, ht, age, sex);
    const tdee = bmr * actMult + exPerDay;
    const safe = Math.max(calIntake, 1200);
    const def = Math.min(Math.max(tdee - safe, 0), maxLbs * 3500 / 7);
    const lb = Math.min((def * 7) / 3500, wt - goalWt);
    wt = Math.max(wt - lb, goalWt);
    weeks.push({ week: w + 1, weight: +wt.toFixed(1) });
    w++;
  }
  return weeks;
}

export function addWeeks(d, w) {
  const x = new Date(d);
  x.setDate(x.getDate() + Math.round(w * 7));
  return x;
}

// Streak from a checkins array — pure, no module state
export function calcStreakFromEntries(checkins) {
  if (!checkins.length) return 0;
  const sorted = [...checkins].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const d1 = new Date(sorted[i - 1].date + 'T12:00');
    const d2 = new Date(sorted[i].date + 'T12:00');
    const diff = (d1 - d2) / (7 * 24 * 3600 * 1000);
    if (diff >= 0.5 && diff <= 1.8) streak++;
    else break;
  }
  const lastDate = new Date(sorted[0].date + 'T12:00');
  const daysSince = (Date.now() - lastDate) / (24 * 3600 * 1000);
  if (daysSince > 10) return 0;
  return streak;
}

// Linear regression on {x,y} points — returns {slope, intercept} or null
export function linearRegression(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const sumX = pts.reduce((a, p) => a + p.x, 0);
  const sumY = pts.reduce((a, p) => a + p.y, 0);
  const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = pts.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// Trend projection from check-ins — pure version used in tests and app.js
export function calcTrendFromEntries(checkins, goalWt) {
  if (checkins.length < 3) return null;
  const sorted = [...checkins].sort((a, b) => new Date(a.date) - new Date(b.date));
  const origin = new Date(sorted[0].date + 'T12:00');
  const pts = sorted.map(ci => {
    const d = new Date(ci.date + 'T12:00');
    return { x: (d - origin) / (7 * 24 * 3600 * 1000), y: ci.weight };
  });
  const reg = linearRegression(pts);
  if (!reg) return null;
  const { slope, intercept } = reg;
  const n = pts.length;
  let weeksToGoal = null, projGoalDate = null;
  if (goalWt !== null && slope < -0.01) {
    const weeksFromOriginToGoal = (goalWt - intercept) / slope;
    const weeksFromNow = weeksFromOriginToGoal - pts[n - 1].x;
    if (weeksFromNow > 0 && weeksFromNow < 520) {
      weeksToGoal = Math.round(weeksFromNow);
      projGoalDate = addWeeks(new Date(), weeksFromNow);
    }
  }
  return { slope, weeksToGoal, projGoalDate, goalWt, n };
}
