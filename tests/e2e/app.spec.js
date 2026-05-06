import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Use test mode to isolate localStorage and suppress analytics
  await page.goto('/?env=test');
  await page.waitForLoadState('networkidle');
});

// ── Page load ─────────────────────────────────────────────────────────────────
test('app loads and shows calculator', async ({ page }) => {
  await expect(page.locator('#cw')).toBeVisible();
  await expect(page.locator('#gw')).toBeVisible();
  await expect(page.locator('#calSl')).toBeVisible();
});

test('About You inputs appear before results card', async ({ page }) => {
  const aboutYouY = await page.locator('#about-you-section, .about-you, #age').first().boundingBox();
  const resultsY = await page.locator('#plan-card, .plan-result, #results-card').first().boundingBox();
  if (aboutYouY && resultsY) {
    expect(aboutYouY.y).toBeLessThan(resultsY.y);
  }
});

// ── Calculator ────────────────────────────────────────────────────────────────
test('changing current weight updates projection', async ({ page }) => {
  const cwInput = page.locator('#cw');
  await cwInput.fill('200');
  await cwInput.press('Tab');
  // Results section should render something
  await expect(page.locator('#plan-card, #projection-section, .result-weeks')).toBeVisible({ timeout: 3000 });
});

test('sliders update without error', async ({ page }) => {
  const calSlider = page.locator('#calSl');
  await calSlider.fill('1600');
  // No JS errors - check console
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.waitForTimeout(300);
  expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
});

test('pace preset buttons are clickable', async ({ page }) => {
  const steadyBtn = page.locator('#sc-steady');
  await steadyBtn.click();
  await expect(steadyBtn).toHaveClass(/active/);
});

// ── Mode toggle ───────────────────────────────────────────────────────────────
test('mode toggle shows and hides goal date field', async ({ page }) => {
  const dateBtn = page.locator('#mode-date');
  await dateBtn.click();
  await expect(page.locator('#goalDate')).toBeVisible();

  const weightBtn = page.locator('#mode-weight');
  await weightBtn.click();
  await expect(page.locator('#gw')).toBeVisible();
});

// ── Check-in page ─────────────────────────────────────────────────────────────
test('navigates to check-in page', async ({ page }) => {
  await page.locator('#nav-checkin, [data-page="checkin"], .nav-checkin').first().click();
  await expect(page.locator('#checkin-weight, #checkin-form')).toBeVisible({ timeout: 3000 });
});

test('check-in form accepts weight and logs entry', async ({ page }) => {
  // First set a plan so check-in has something to compare against
  await page.locator('#cw').fill('200');
  await page.locator('#gw').fill('170');
  await page.locator('#cw').press('Tab');
  await page.waitForTimeout(300);

  await page.locator('#nav-checkin, [data-page="checkin"], .nav-checkin').first().click();
  await page.waitForTimeout(300);

  const wtInput = page.locator('#checkin-weight');
  await wtInput.fill('198');

  const logBtn = page.locator('#log-checkin-btn, button[onclick*="addCheckin"]').first();
  await logBtn.click();
  await page.waitForTimeout(300);

  // Entry should appear in history
  await expect(page.locator('.checkin-item, .checkin-row, .checkin-entry').first()).toBeVisible({ timeout: 3000 });
});

test('weight field clears after logging a check-in', async ({ page }) => {
  await page.locator('#nav-checkin, [data-page="checkin"], .nav-checkin').first().click();
  await page.waitForTimeout(300);

  const wtInput = page.locator('#checkin-weight');
  await wtInput.fill('198');

  const logBtn = page.locator('#log-checkin-btn, button[onclick*="addCheckin"]').first();
  await logBtn.click();
  await page.waitForTimeout(300);

  const val = await wtInput.inputValue();
  expect(val).toBe('');
});

// ── Input validation ──────────────────────────────────────────────────────────
test('implausible weight is rejected or clamped', async ({ page }) => {
  const cw = page.locator('#cw');
  await cw.fill('0');
  await cw.press('Tab');
  await page.waitForTimeout(300);
  // Either the value is clamped to minimum or an error is shown
  const val = parseFloat(await cw.inputValue());
  const hasError = await page.locator('.input-error, [data-error]').isVisible().catch(() => false);
  expect(val > 0 || hasError).toBeTruthy();
});

// ── Cookie banner ─────────────────────────────────────────────────────────────
test('cookie banner appears and can be dismissed', async ({ page }) => {
  // Cookie banner shows after 1.5s on first visit
  await page.waitForSelector('#cookie-banner, .cookie-banner', { timeout: 4000 });
  await page.locator('#cookie-accept, .cookie-accept, button:has-text("Got it")').first().click();
  await expect(page.locator('#cookie-banner, .cookie-banner')).not.toBeVisible({ timeout: 2000 });
});

// ── No JS errors on load ──────────────────────────────────────────────────────
test('no console errors on fresh load', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.waitForTimeout(2000);
  const realErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('supabase') &&
    !e.includes('posthog') &&
    !e.includes('net::ERR')
  );
  expect(realErrors).toHaveLength(0);
});
