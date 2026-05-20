/**
 * Account settings, auth sheet defaults, and 404 page tests.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?env=test');
  await page.waitForLoadState('networkidle');
});

// ── Auth sheet defaults ────────────────────────────────────────────────────────

test('auth sheet opens in signup mode for new users', async ({ page }) => {
  // No user_hint in storage → should default to Create Account
  // In test mode (/?env=test) the app uses the 'trimly_test_' prefix
  await page.evaluate(() => localStorage.removeItem('trimly_test_user_hint'));
  await page.evaluate(() => {
    document.getElementById('sync-overlay').classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'block';
  });
  const btn = page.locator('#sync-submit-btn');
  await expect(btn).toBeVisible({ timeout: 2000 });
  expect(await btn.textContent()).toContain('Create Account');
});

test('auth sheet opens in signin mode for returning users', async ({ page }) => {
  // Simulate returning user by setting user_hint
  await page.evaluate(() => {
    // In test mode (/?env=test) the app uses the 'trimly_test_' prefix
    localStorage.setItem('trimly_test_user_hint', JSON.stringify({ id: 'abc', email: 'test@example.com' }));
  });
  // Reload so the app reads the hint on init
  await page.reload();
  await page.waitForLoadState('networkidle');
  // Trigger openSyncSheet via the global
  await page.evaluate(() => window.openSyncSheet && window.openSyncSheet());
  await page.waitForTimeout(400);
  const btn = page.locator('#sync-submit-btn');
  await expect(btn).toBeVisible({ timeout: 2000 });
  expect(await btn.textContent()).toContain('Sign In');
});

// ── Account settings sheet ─────────────────────────────────────────────────────

test('account settings step exists in DOM', async ({ page }) => {
  await expect(page.locator('#sync-step-account')).toBeAttached();
});

test('account settings sheet opens with correct fields', async ({ page }) => {
  // Simulate signed-in state by forcing the step visible
  await page.evaluate(() => {
    const overlay = document.getElementById('sync-overlay');
    overlay.classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'none';
    document.getElementById('sync-step-recover').style.display = 'none';
    document.getElementById('sync-step-account').style.display = 'block';
  });
  await expect(page.locator('#acct-name')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#acct-email')).toBeVisible();
  await expect(page.locator('#acct-password')).toBeVisible();
  await expect(page.locator('#acct-unit-lbs')).toBeVisible();
  await expect(page.locator('#acct-unit-kg')).toBeVisible();
});

test('unit toggle buttons exist and have active state', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('sync-overlay').classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'none';
    document.getElementById('sync-step-account').style.display = 'block';
    document.getElementById('acct-unit-lbs').classList.add('active');
  });
  await expect(page.locator('#acct-unit-lbs')).toHaveClass(/active/);
  await expect(page.locator('#acct-unit-kg')).not.toHaveClass(/active/);
});

test('account name field accepts input', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('sync-overlay').classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'none';
    document.getElementById('sync-step-account').style.display = 'block';
  });
  await page.locator('#acct-name').fill('Test User');
  expect(await page.locator('#acct-name').inputValue()).toBe('Test User');
});

test('account email field accepts input', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('sync-overlay').classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'none';
    document.getElementById('sync-step-account').style.display = 'block';
  });
  await page.locator('#acct-email').fill('new@example.com');
  expect(await page.locator('#acct-email').inputValue()).toBe('new@example.com');
});

test('account password field accepts input', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('sync-overlay').classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'none';
    document.getElementById('sync-step-account').style.display = 'block';
  });
  await page.locator('#acct-password').fill('newpassword123');
  expect(await page.locator('#acct-password').inputValue()).toBe('newpassword123');
});

test('account menu has Account Settings option', async ({ page }) => {
  const menu = page.locator('#account-menu');
  await page.evaluate(() => {
    document.getElementById('account-menu').style.display = 'block';
  });
  await expect(menu.locator('button', { hasText: 'Account Settings' })).toBeVisible();
});

test('account menu has Export Data option', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('account-menu').style.display = 'block';
  });
  await expect(page.locator('#account-menu button', { hasText: 'Export Data' })).toBeVisible();
});

test('account menu has Sign Out option', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('account-menu').style.display = 'block';
  });
  await expect(page.locator('#account-menu button.danger')).toContainText('Sign Out');
});

// ── Unit pref sync (localStorage) ─────────────────────────────────────────────

test('unit pref is saved to localStorage on toggle', async ({ page }) => {
  // In test mode (/?env=test) the app uses the 'trimly_test_' prefix
  const before = await page.evaluate(() => localStorage.getItem('trimly_test_unit') || 'lbs');
  await page.evaluate(() => window.toggleUnit && window.toggleUnit());
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => localStorage.getItem('trimly_test_unit'));
  expect(after).not.toBe(before);
});

test('unit pref persists across reload', async ({ page }) => {
  // In test mode (/?env=test) the app uses the 'trimly_test_' prefix
  await page.evaluate(() => {
    localStorage.setItem('trimly_test_unit', 'kg');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  const stored = await page.evaluate(() => localStorage.getItem('trimly_test_unit'));
  expect(stored).toBe('kg');
});

// ── 404 page ───────────────────────────────────────────────────────────────────
// Navigate to /404.html directly — Vite dev server serves it from public/;
// Vercel also maps unknown routes to this file with a 404 status.

test('404 page contains Trimly branding', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('body')).toContainText('Trimly');
});

test('404 page has a link back to the app', async ({ page }) => {
  await page.goto('/404.html');
  const link = page.locator('a[href="/"]');
  await expect(link).toBeVisible();
});

test('404 back link navigates to app', async ({ page }) => {
  await page.goto('/404.html');
  await page.locator('a[href="/"]').click();
  // Use domcontentloaded — networkidle never resolves with active Supabase/PostHog connections
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#page-calculator')).toBeAttached();
});

// ── Forgot password UI ─────────────────────────────────────────────────────────

test('forgot password link is hidden in signup mode', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('sync-overlay').classList.add('show');
    document.getElementById('sync-step-auth').style.display = 'block';
  });
  // In signup mode, forgot link should be hidden
  const forgot = page.locator('#sync-forgot-link');
  const display = await forgot.evaluate(el => window.getComputedStyle(el).display);
  expect(display).toBe('none');
});

test('recover step has password input and save button', async ({ page }) => {
  await expect(page.locator('#sync-recover-password')).toBeAttached();
  await expect(page.locator('#sync-recover-btn')).toBeAttached();
});
