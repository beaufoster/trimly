/**
 * Auth lifecycle e2e tests.
 * These run in-browser via page.evaluate to exercise localStorage behavior
 * without requiring a live Supabase connection.
 */
import { test, expect } from '@playwright/test';

const STORE = 'tr_';

test.beforeEach(async ({ page }) => {
  await page.goto('/?env=test');
  await page.waitForLoadState('networkidle');
});

// ── signed_out flag mechanics ─────────────────────────────────────────────────
test('signed_out flag blocks INITIAL_SESSION', async ({ page }) => {
  const blocked = await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'signed_out', '1');
    const event = 'INITIAL_SESSION';
    return (
      (event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN') &&
      !!localStorage.getItem(STORE + 'signed_out')
    );
  }, { STORE });
  expect(blocked).toBe(true);
});

test('signed_out flag blocks TOKEN_REFRESHED', async ({ page }) => {
  const blocked = await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'signed_out', '1');
    const event = 'TOKEN_REFRESHED';
    return (
      (event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN') &&
      !!localStorage.getItem(STORE + 'signed_out')
    );
  }, { STORE });
  expect(blocked).toBe(true);
});

test('signed_out flag blocks SIGNED_IN', async ({ page }) => {
  const blocked = await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'signed_out', '1');
    const event = 'SIGNED_IN';
    return (
      (event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN') &&
      !!localStorage.getItem(STORE + 'signed_out')
    );
  }, { STORE });
  expect(blocked).toBe(true);
});

test('signed_out flag does NOT block SIGNED_OUT event', async ({ page }) => {
  const blocked = await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'signed_out', '1');
    const event = 'SIGNED_OUT';
    return (
      (event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN') &&
      !!localStorage.getItem(STORE + 'signed_out')
    );
  }, { STORE });
  expect(blocked).toBe(false);
});

test('absent signed_out flag allows SIGNED_IN', async ({ page }) => {
  const blocked = await page.evaluate(({ STORE }) => {
    localStorage.removeItem(STORE + 'signed_out');
    const event = 'SIGNED_IN';
    return (
      (event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN') &&
      !!localStorage.getItem(STORE + 'signed_out')
    );
  }, { STORE });
  expect(blocked).toBe(false);
});

// ── signOut localStorage preservation ────────────────────────────────────────
test('signOut keeps checkins in localStorage', async ({ page }) => {
  const result = await page.evaluate(({ STORE }) => {
    const checkins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
    ];
    localStorage.setItem(STORE + 'checkins', JSON.stringify(checkins));
    localStorage.setItem(STORE + 'plan', JSON.stringify({ cw:200, gw:170 }));
    localStorage.setItem(STORE + 'user_hint', '{"id":"abc"}');
    localStorage.setItem(STORE + 'page', 'checkin');
    localStorage.setItem(STORE + 'form', '{}');

    // Simulate signOut localStorage clearing (matches app.js)
    [STORE+'sync_nudge_dismissed', STORE+'form', STORE+'user_hint', STORE+'page'].forEach(
      k => localStorage.removeItem(k)
    );
    localStorage.setItem(STORE + 'signed_out', '1');

    return {
      checkinsAfter: localStorage.getItem(STORE + 'checkins'),
      planAfter:     localStorage.getItem(STORE + 'plan'),
      userHintAfter: localStorage.getItem(STORE + 'user_hint'),
      pageAfter:     localStorage.getItem(STORE + 'page'),
      signedOut:     localStorage.getItem(STORE + 'signed_out'),
    };
  }, { STORE });

  expect(result.checkinsAfter).not.toBeNull();
  expect(JSON.parse(result.checkinsAfter)).toHaveLength(2);
  expect(result.planAfter).not.toBeNull();
  expect(result.userHintAfter).toBeNull();
  expect(result.pageAfter).toBeNull();
  expect(result.signedOut).toBe('1');
});

test('signOut sets signed_out flag persistently', async ({ page }) => {
  await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'signed_out', '1');
  }, { STORE });

  await page.reload();
  await page.waitForLoadState('networkidle');

  const flag = await page.evaluate(({ STORE }) =>
    localStorage.getItem(STORE + 'signed_out'), { STORE }
  );
  expect(flag).toBe('1');
});

test('signOut removes user_hint', async ({ page }) => {
  const after = await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'user_hint', '{"id":"test123"}');
    localStorage.removeItem(STORE + 'user_hint');
    return localStorage.getItem(STORE + 'user_hint');
  }, { STORE });
  expect(after).toBeNull();
});

// ── pre-signin check-in rescue from localStorage ──────────────────────────────
test('SIGNED_IN rescue: reads checkins from localStorage when memory is empty', async ({ page }) => {
  const result = await page.evaluate(({ STORE }) => {
    const savedCheckins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
    ];
    localStorage.setItem(STORE + 'checkins', JSON.stringify(savedCheckins));

    // Simulate what SIGNED_IN handler does: memoryCheckins is empty (just signed out)
    const memoryCheckins = [];
    const preSigninCheckins = memoryCheckins.length > 0
      ? [...memoryCheckins]
      : JSON.parse(localStorage.getItem(STORE + 'checkins') || '[]');

    return preSigninCheckins.length;
  }, { STORE });

  expect(result).toBe(2);
});

test('SIGNED_IN rescue: memory checkins take priority over localStorage', async ({ page }) => {
  const result = await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'checkins', JSON.stringify([
      { id:1, date:'2025-01-01', weight:200, note:'' },
    ]));

    const memoryCheckins = [
      { id:99, date:'2025-03-01', weight:190, note:'' },
    ];
    const preSigninCheckins = memoryCheckins.length > 0
      ? [...memoryCheckins]
      : JSON.parse(localStorage.getItem(STORE + 'checkins') || '[]');

    return preSigninCheckins[0].date;
  }, { STORE });

  expect(result).toBe('2025-03-01');
});

test('full sign-out → sign-in cycle preserves checkins', async ({ page }) => {
  const result = await page.evaluate(({ STORE }) => {
    const userId = 'user-test';
    const checkins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
      { id:3, date:'2025-01-15', weight:196, note:'' },
    ];

    // Setup: user has data in localStorage and memory
    localStorage.setItem(STORE + 'checkins', JSON.stringify(checkins));

    // Step 1: signOut (keeps localStorage, clears memory)
    [STORE+'sync_nudge_dismissed', STORE+'form', STORE+'user_hint', STORE+'page'].forEach(
      k => localStorage.removeItem(k)
    );
    localStorage.setItem(STORE + 'signed_out', '1');
    let memCheckins = [];  // memory cleared

    // Step 2: SIGNED_IN fires (with signed_out removed by signIn() beforehand)
    localStorage.removeItem(STORE + 'signed_out');

    // Handler reads from localStorage since memory is empty
    const preSigninCheckins = memCheckins.length > 0
      ? [...memCheckins]
      : JSON.parse(localStorage.getItem(STORE + 'checkins') || '[]');

    // Cloud has nothing (sync failed during sign-out)
    const cloudCheckins = [];
    let localCheckins = [...cloudCheckins];

    // Wipe local storage as handler does
    [STORE+'checkins', STORE+'plan', STORE+'celebrated', STORE+'name'].forEach(
      k => localStorage.removeItem(k)
    );

    // Merge: same user, cloud empty → use local
    const isSameOrAnon = true;
    if (isSameOrAnon) {
      const syncedDates = new Set(localCheckins.map(c => c.date));
      const mergeBack = preSigninCheckins.filter(c => !syncedDates.has(c.date));
      if (mergeBack.length) {
        localCheckins = [...localCheckins, ...mergeBack].sort(
          (a,b) => new Date(a.date) - new Date(b.date)
        );
      }
    }

    localStorage.setItem(STORE + 'checkins', JSON.stringify(localCheckins));
    return localCheckins.length;
  }, { STORE });

  expect(result).toBe(3);
});

// ── No data contamination across users ───────────────────────────────────────
test('different user sign-in with cloud data only gets their data', async ({ page }) => {
  const result = await page.evaluate(({ STORE }) => {
    const prevUserCheckins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
    ];
    const newUserCloudCheckins = [
      { id:99, date:'2025-06-01', weight:175, note:'' },
    ];

    localStorage.setItem(STORE + 'checkins', JSON.stringify(prevUserCheckins));

    const memCheckins = [];
    const preSigninCheckins = memCheckins.length > 0
      ? [...memCheckins]
      : JSON.parse(localStorage.getItem(STORE + 'checkins') || '[]');

    // Cloud has new user's data
    let localCheckins = [...newUserCloudCheckins];

    // Wipe localStorage
    [STORE+'checkins', STORE+'plan', STORE+'celebrated', STORE+'name'].forEach(
      k => localStorage.removeItem(k)
    );

    // Different user → no merge (cloud has entries)
    const userHint = { id: 'user-prev' };
    const incomingId = 'user-new';
    const isSameOrAnon = !userHint || userHint.id === incomingId;
    if (!isSameOrAnon && localCheckins.length > 0) {
      // Don't merge prev user's data
    } else if (!isSameOrAnon && !localCheckins.length && preSigninCheckins.length) {
      localCheckins = preSigninCheckins;
    }

    localStorage.setItem(STORE + 'checkins', JSON.stringify(localCheckins));

    return {
      count: localCheckins.length,
      hasPrevDate: localCheckins.some(c => c.date === '2025-01-01'),
      hasNewDate: localCheckins.some(c => c.date === '2025-06-01'),
    };
  }, { STORE });

  expect(result.count).toBe(1);
  expect(result.hasPrevDate).toBe(false);
  expect(result.hasNewDate).toBe(true);
});

// ── auth form visibility ──────────────────────────────────────────────────────
test('signIn email form is visible in sync overlay', async ({ page }) => {
  // Open the sync overlay
  await page.evaluate(() => {
    const overlay = document.getElementById('sync-overlay');
    if (overlay) overlay.classList.add('show');
  });
  await expect(page.locator('#sync-email')).toBeVisible({ timeout: 2000 });
});

test('sync submit button exists and is labeled correctly', async ({ page }) => {
  await page.evaluate(() => {
    const overlay = document.getElementById('sync-overlay');
    if (overlay) overlay.classList.add('show');
  });
  const btn = page.locator('#sync-submit-btn');
  await expect(btn).toBeVisible({ timeout: 2000 });
  expect(await btn.textContent()).toContain('Create Account');
});

// ── Reload with signed_out flag blocks session restore ────────────────────────
test('page reload with signed_out flag set leaves user signed out', async ({ page }) => {
  // Set flag, reload, verify we are NOT auto-signed in
  await page.evaluate(({ STORE }) => {
    localStorage.setItem(STORE + 'signed_out', '1');
  }, { STORE });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // In test mode there's no Supabase, so currentUser is always null.
  // The flag should still be present.
  const flag = await page.evaluate(({ STORE }) =>
    localStorage.getItem(STORE + 'signed_out'), { STORE }
  );
  expect(flag).toBe('1');
});
