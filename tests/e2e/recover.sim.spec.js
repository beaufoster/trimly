import { test, expect } from '@playwright/test';

test('simulate password recovery UI shows reset form', async ({ page }) => {
  await page.goto('/?env=test');
  await page.waitForLoadState('networkidle');

  // Simulate Supabase PASSWORD_RECOVERY handling by showing the recover step
  await page.evaluate(() => {
    const ov = document.getElementById('sync-overlay');
    if (ov) ov.classList.add('show');
    const authStep = document.getElementById('sync-step-auth');
    const recStep = document.getElementById('sync-step-recover');
    if (authStep) authStep.style.display = 'none';
    if (recStep) recStep.style.display = 'block';
  });

  await page.waitForSelector('#sync-step-recover', { state: 'visible' });
  const visible = await page.isVisible('#sync-step-recover');
  expect(visible).toBe(true);
});
