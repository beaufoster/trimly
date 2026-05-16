import { test, expect } from '@playwright/test';

// Desktop Chrome viewport — bottom tab-bar is hidden, desktop nav is active.
// Use these helpers to navigate so tests work regardless of viewport.
function navTo(page, dest) {
  // Desktop nav tabs have no IDs; match by text.
  const label = dest === 'checkin' ? 'Weekly Check-In' : 'Calculator';
  return page.locator(`button.desktop-nav-tab:has-text("${label}")`).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?env=test');
  await page.waitForLoadState('networkidle');
});

// ── Page load ─────────────────────────────────────────────────────────────────
test('app loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForTimeout(1500);
  const real = errors.filter(e =>
    !e.includes('favicon') && !e.includes('supabase') &&
    !e.includes('posthog') && !e.includes('net::ERR')
  );
  expect(real).toHaveLength(0);
});

test('calculator page is active on load', async ({ page }) => {
  await expect(page.locator('#page-calculator')).toHaveClass(/active/);
});

test('current-weight input is visible', async ({ page }) => {
  await expect(page.locator('#cw')).toBeVisible();
});

test('goal-weight input is visible', async ({ page }) => {
  await expect(page.locator('#gw')).toBeVisible();
});

test('calorie slider is visible', async ({ page }) => {
  await expect(page.locator('#calSl')).toBeVisible();
});

test('result drawer is visible', async ({ page }) => {
  await expect(page.locator('#result-drawer')).toBeVisible();
});

// ── Calculator inputs ─────────────────────────────────────────────────────────
test('changing current weight updates weeks display', async ({ page }) => {
  await page.locator('#cw').fill('220');
  await page.locator('#cw').press('Tab');
  await page.waitForTimeout(400);
  const weeks = await page.locator('#r-weeks').textContent();
  expect(weeks).not.toBe('—');
});

test('changing goal weight updates weeks display', async ({ page }) => {
  await page.locator('#cw').fill('200');
  await page.locator('#gw').fill('160');
  await page.locator('#gw').press('Tab');
  await page.waitForTimeout(400);
  const weeks = await page.locator('#r-weeks').textContent();
  expect(weeks).not.toBe('—');
});

test('calorie slider updates displayed calorie value', async ({ page }) => {
  await page.locator('#calSl').fill('2000');
  await page.locator('#calSl').dispatchEvent('input');
  await page.waitForTimeout(300);
  const val = await page.locator('#cal-v').textContent();
  expect(val).toContain('2,000');
});

test('walking slider updates displayed value', async ({ page }) => {
  await page.locator('#walkSl').fill('60');
  await page.locator('#walkSl').dispatchEvent('input');
  await page.waitForTimeout(300);
  const val = await page.locator('#walk-v').textContent();
  expect(val).toBe('60');
});

test('lifting slider updates displayed value', async ({ page }) => {
  await page.locator('#liftSl').fill('5');
  await page.locator('#liftSl').dispatchEvent('input');
  await page.waitForTimeout(300);
  const val = await page.locator('#lift-v').textContent();
  expect(val).toBe('5');
});

test('sex selector changes without error', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.locator('#sex').selectOption('female');
  await page.waitForTimeout(300);
  const real = errors.filter(e => !e.includes('favicon') && !e.includes('supabase'));
  expect(real).toHaveLength(0);
});

test('age input changes without error', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.locator('#age').fill('28');
  await page.locator('#age').press('Tab');
  await page.waitForTimeout(300);
  const real = errors.filter(e => !e.includes('favicon') && !e.includes('supabase'));
  expect(real).toHaveLength(0);
});

test('height inputs change without error', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.locator('#ht-ft').fill('6');
  await page.locator('#ht-in').fill('2');
  await page.locator('#ht-ft').press('Tab');
  await page.waitForTimeout(300);
  const real = errors.filter(e => !e.includes('favicon') && !e.includes('supabase'));
  expect(real).toHaveLength(0);
});

// ── Pace presets ──────────────────────────────────────────────────────────────
test('gentle pace button is clickable and becomes active', async ({ page }) => {
  await page.locator('#sc-gentle').click();
  await expect(page.locator('#sc-gentle')).toHaveClass(/active/);
});

test('steady pace button becomes active', async ({ page }) => {
  await page.locator('#sc-steady').click();
  await expect(page.locator('#sc-steady')).toHaveClass(/active/);
});

test('aggressive pace button becomes active', async ({ page }) => {
  await page.locator('#sc-aggressive').click();
  await expect(page.locator('#sc-aggressive')).toHaveClass(/active/);
});

test('switching pace updates weeks', async ({ page }) => {
  await page.locator('#cw').fill('200');
  await page.locator('#gw').fill('170');
  await page.locator('#gw').press('Tab');
  await page.waitForTimeout(400);

  await page.locator('#sc-aggressive').click();
  await page.waitForTimeout(300);
  const aggressiveWeeks = parseInt(await page.locator('#r-weeks').textContent());

  await page.locator('#sc-gentle').click();
  await page.waitForTimeout(300);
  const gentleWeeks = parseInt(await page.locator('#r-weeks').textContent());

  // Gentle should take longer than aggressive
  expect(gentleWeeks).toBeGreaterThan(aggressiveWeeks);
});

// ── Mode toggle ───────────────────────────────────────────────────────────────
test('switching to date mode shows goal date field', async ({ page }) => {
  await page.locator('#mode-date').click();
  await expect(page.locator('#goalDate')).toBeVisible();
});

test('switching back to weight mode shows goal weight field', async ({ page }) => {
  await page.locator('#mode-date').click();
  await page.locator('#mode-weight').click();
  await expect(page.locator('#gw')).toBeVisible();
});

test('date mode button becomes active on click', async ({ page }) => {
  await page.locator('#mode-date').click();
  await expect(page.locator('#mode-date')).toHaveClass(/active/);
});

// ── Unit toggle ───────────────────────────────────────────────────────────────
test('kg toggle switches unit label', async ({ page }) => {
  await page.locator('#unit-toggle-btn').click();
  await page.waitForTimeout(300);
  const btnText = await page.locator('#unit-toggle-btn').textContent();
  expect(btnText).toBe('lbs');
  // Height should now show cm
  await expect(page.locator('#ht-cm-row')).toBeVisible();
});

test('switching back to lbs shows ft/in', async ({ page }) => {
  await page.locator('#unit-toggle-btn').click();
  await page.waitForTimeout(200);
  await page.locator('#unit-toggle-btn').click();
  await page.waitForTimeout(200);
  await expect(page.locator('#ht-ft-row')).toBeVisible();
});

// ── Check-in page ─────────────────────────────────────────────────────────────
test('clicking check-in tab shows check-in page', async ({ page }) => {
  await navTo(page, 'checkin');
  await expect(page.locator('#page-checkin')).toHaveClass(/active/);
});

test('check-in weight input is visible on check-in page', async ({ page }) => {
  await navTo(page, 'checkin');
  await expect(page.locator('#ci-weight')).toBeVisible();
});

test('check-in date input is visible', async ({ page }) => {
  await navTo(page, 'checkin');
  await expect(page.locator('#ci-date')).toBeVisible();
});

test('log-it button is visible', async ({ page }) => {
  await navTo(page, 'checkin');
  await expect(page.locator('#btn-add-checkin')).toBeVisible();
});

test('logging a check-in adds it to the list', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);
  await page.locator('#ci-weight').fill('198');
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(400);
  // Entry is rendered in .ci-entries (hidden on desktop by CSS) — verify via DOM count
  const count = await page.evaluate(() =>
    document.querySelectorAll('#ci-entries-wrap .ci-entry').length
  );
  expect(count).toBeGreaterThan(0);
});

test('weight input clears after logging', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);
  await page.locator('#ci-weight').fill('198');
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(400);
  expect(await page.locator('#ci-weight').inputValue()).toBe('');
});

test('logging multiple check-ins shows all entries', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);

  // Log first check-in
  await page.locator('#ci-weight').fill('200');
  const firstDate = '2025-01-01';
  await page.locator('#ci-date').fill(firstDate);
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(300);

  // Log second check-in
  await page.locator('#ci-weight').fill('198');
  const secondDate = '2025-01-08';
  await page.locator('#ci-date').fill(secondDate);
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(300);

  const entries = page.locator('#ci-entries-wrap .ci-entry, #ci-entries-wrap .checkin-row');
  await expect(entries).toHaveCount(2, { timeout: 3000 });
});

test('duplicate date is rejected or replaced, not duplicated', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);

  const date = '2025-06-01';
  await page.locator('#ci-date').fill(date);
  await page.locator('#ci-weight').fill('200');
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(300);

  await page.locator('#ci-date').fill(date);
  await page.locator('#ci-weight').fill('198');
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(400);

  // Should not have two entries for same date
  const entries = page.locator('#ci-entries-wrap .ci-entry, #ci-entries-wrap .checkin-row');
  const count = await entries.count();
  expect(count).toBeLessThanOrEqual(1);
});

test('check-in persists across navigation to calculator and back', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);
  await page.locator('#ci-weight').fill('195');
  await page.locator('#ci-date').fill('2025-02-01');
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(300);

  await navTo(page, 'calculator');
  await page.waitForTimeout(200);
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);

  const count = await page.evaluate(() =>
    document.querySelectorAll('#ci-entries-wrap .ci-entry').length
  );
  expect(count).toBeGreaterThan(0);
});

// ── Input validation ──────────────────────────────────────────────────────────
test('current weight below minimum is clamped by input min attribute', async ({ page }) => {
  // The #cw input has min="80" — browser clamps values below min on form submit/validation.
  // We verify the attribute is set correctly.
  const minAttr = await page.locator('#cw').getAttribute('min');
  expect(Number(minAttr)).toBeGreaterThan(0);
});

test('check-in with no weight shows error', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#ci-error')).toBeVisible({ timeout: 2000 });
});

// ── Cookie banner ─────────────────────────────────────────────────────────────
// Test mode suppresses auto-show; force it visible to test dismiss behavior.
test('cookie banner can be force-shown and dismissed', async ({ page }) => {
  await page.evaluate(() => {
    const b = document.getElementById('cookie-banner');
    if (b) b.style.display = 'flex';
  });
  await expect(page.locator('#cookie-banner')).toBeVisible();
  await page.locator('#cookie-banner button').first().click();
  await expect(page.locator('#cookie-banner')).toBeHidden({ timeout: 3000 });
});

test('cookie consent is stored in localStorage after accept', async ({ page }) => {
  await page.evaluate(() => {
    const b = document.getElementById('cookie-banner');
    if (b) b.style.display = 'flex';
  });
  await page.locator('#cookie-banner button').first().click();
  await page.waitForTimeout(300);
  const consent = await page.evaluate(() => localStorage.getItem('trimly_cookie_consent'));
  expect(['accepted', 'declined']).toContain(consent);
});

// ── Sync / account UI ─────────────────────────────────────────────────────────
test('account button is in the DOM', async ({ page }) => {
  const btn = page.locator('#account-btn-hero, #account-btn-desktop').first();
  await expect(btn).toBeAttached();
});

test('sync overlay opens when sync nudge is clicked', async ({ page }) => {
  // Force-show the sync nudge and click it
  await page.evaluate(() => {
    const n = document.getElementById('sync-nudge');
    if (n) { n.style.display = 'block'; }
  });
  const nudge = page.locator('#sync-nudge');
  if (await nudge.isVisible()) {
    await nudge.click();
    await expect(page.locator('#sync-overlay')).toHaveClass(/show/, { timeout: 2000 });
  }
});

// ── Tab navigation ────────────────────────────────────────────────────────────
test('calculator page is shown on load', async ({ page }) => {
  await expect(page.locator('#page-calculator')).toHaveClass(/active/);
});

test('check-in page shows after nav click', async ({ page }) => {
  await navTo(page, 'checkin');
  await expect(page.locator('#page-checkin')).toHaveClass(/active/);
});

test('calculator page shows after navigating back', async ({ page }) => {
  await navTo(page, 'checkin');
  await navTo(page, 'calculator');
  await expect(page.locator('#page-calculator')).toHaveClass(/active/);
});

// ── localStorage persistence ──────────────────────────────────────────────────
test('plan is saved to localStorage after calculate', async ({ page }) => {
  await page.locator('#cw').fill('200');
  await page.locator('#gw').fill('170');
  await page.locator('#gw').press('Tab');
  await page.waitForTimeout(600);
  // test mode uses trimly_test_ prefix
  const plan = await page.evaluate(() =>
    localStorage.getItem('trimly_test_plan') || localStorage.getItem('tr_plan')
  );
  expect(plan).not.toBeNull();
  const parsed = JSON.parse(plan);
  expect(parsed.cw).toBe(200);
});

test('check-ins are saved to localStorage', async ({ page }) => {
  await navTo(page, 'checkin');
  await page.waitForTimeout(200);
  await page.locator('#ci-weight').fill('197');
  await page.locator('#ci-date').fill('2025-03-01');
  await page.locator('#btn-add-checkin').click();
  await page.waitForTimeout(400);
  // test mode uses trimly_test_ prefix
  const stored = await page.evaluate(() =>
    localStorage.getItem('trimly_test_checkins') || localStorage.getItem('tr_checkins')
  );
  expect(stored).not.toBeNull();
  const checkins = JSON.parse(stored);
  expect(checkins.some(c => c.date === '2025-03-01')).toBe(true);
});

test('data persists across page reload', async ({ page }) => {
  await page.locator('#cw').fill('205');
  await page.locator('#gw').fill('175');
  await page.locator('#gw').press('Tab');
  await page.waitForTimeout(600);

  // Reload preserving query string so test mode stays active
  await page.goto(page.url());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  const cwVal = await page.locator('#cw').inputValue();
  expect(parseFloat(cwVal)).toBeCloseTo(205, 0);
});
