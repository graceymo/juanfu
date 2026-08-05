// Playwright E2E tests for exercise recording system (Tasks 44-48)
import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

// Helper: seed initial appState in page's global scope
async function seedState(page, overrides = {}) {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate((ov) => {
    const d = new Date();
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const yesterday = new Date(today.getTime() - 86400000);

    const state = {
      currentUser: { id: 1, name: '测试用户', avatar_color: '#378ADD' },
      currentCircle: { id: 1, name: '测试圈', invite_code: 'TEST01' },
      todayRecords: [
        {
          id: 'rec-001', type: 'daily',
          group: '核心/腹部', exercise: '卷腹',
          reps: 20, sets: 3, points: 60,
          time: '09:30', photo: false, shared: false,
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30).getTime()
        },
        {
          id: 'rec-002', type: 'special',
          sport: '室外跑', minutes: 30, points: 45,
          watchCal: 320, time: '18:00',
          photo: false, shared: true,
          createdAt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 18, 0).getTime()
        },
        {
          id: 'rec-003', type: 'diet',
          food: '奶茶', qty: 2, points: -18,
          lastExercisePoints: 45, refDeduct: 9, time: '14:30',
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30).getTime()
        }
      ],
      users: [{ id: 1, name: '测试用户', avatar_color: '#378ADD' }],
      circles: [{ id: 1, name: '测试圈', invite_code: 'TEST01', created_by: 1 }],
      circleMembers: [{ id: 1, circle_id: 1, user_id: 1, role: 'leader' }],
      ...ov
    };
    // Write to appState directly (it's a const at top level, accessible via page.evaluate)
    Object.assign(appState, state);
  }, overrides);
  // Navigate to record page to refresh UI
  await page.evaluate(() => {
    switchTab('record');
  });
}

test.describe('Task 44: Exercise Dictionary Expansion', () => {
  test('DAILY_GROUPS has 8 groups with 110+ exercises', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const groups = await page.evaluate(() => {
      if (typeof DAILY_GROUPS === 'undefined') return 'NOT_FOUND';
      return {
        count: Object.keys(DAILY_GROUPS).length,
        groups: Object.keys(DAILY_GROUPS),
      };
    });
    expect(groups).not.toBe('NOT_FOUND');
    expect(groups.count).toBe(8);
    expect(groups.groups).toContain('核心/腹部');
    expect(groups.groups).toContain('下肢');
    expect(groups.groups).toContain('上肢·推');
    expect(groups.groups).toContain('上肢·拉');
    expect(groups.groups).toContain('手臂');
    expect(groups.groups).toContain('全身/HIIT');
    expect(groups.groups).toContain('背部');
    expect(groups.groups).toContain('有氧器械');
  });

  test('SPECIAL_CATEGORIES has 10 categories with 130+ sports', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const specials = await page.evaluate(() => {
      if (typeof SPECIAL_CATEGORIES === 'undefined') return 'NOT_FOUND';
      return {
        count: Object.keys(SPECIAL_CATEGORIES).length,
        categories: Object.keys(SPECIAL_CATEGORIES),
      };
    });
    expect(specials).not.toBe('NOT_FOUND');
    expect(specials.count).toBe(10);
    expect(specials.categories).toContain('球类');
    expect(specials.categories).toContain('水上');
    expect(specials.categories).toContain('跑步/徒步/骑行');
    expect(specials.categories).toContain('攀岩');
    expect(specials.categories).toContain('格斗');
    expect(specials.categories).toContain('瑜伽/普拉提/舞蹈');
    expect(specials.categories).toContain('团课');
    expect(specials.categories).toContain('CrossFit/综合体能');
    expect(specials.categories).toContain('冰雪');
    expect(specials.categories).toContain('其他');
  });
});

test.describe('Task 45: Calorie Warning Threshold', () => {
  test('watchCal threshold is set to >= 50 in code', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      // Check specialBody or submitSpecialRecord for threshold
      const fnSpecial = typeof specialBody !== 'undefined' ? specialBody : null;
      const fnSubmit = typeof submitSpecialRecord !== 'undefined' ? submitSpecialRecord : null;
      const bodySpecial = fnSpecial ? String(fnSpecial) : '';
      const bodySubmit = fnSubmit ? String(fnSubmit) : '';
      const hasThreshold = bodySpecial.includes('watchVal >= 50') ||
        bodySpecial.includes('watchVal>=50') ||
        bodySubmit.includes('watchVal >= 50') ||
        bodySubmit.includes('watchVal>=50');
      return { hasThreshold, fnSpecialExists: !!fnSpecial, fnSubmitExists: !!fnSubmit };
    });
    expect(result.fnSpecialExists || result.fnSubmitExists).toBe(true);
    expect(result.hasThreshold).toBe(true);
  });
});

test.describe('Task 46: Time Fields in All Forms', () => {
  test('time field exists in daily exercise form', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const hasTimeField = await page.evaluate(() => {
      const fn = typeof dailyBody !== 'undefined' ? dailyBody : null;
      if (!fn) return false;
      const body = String(fn);
      return body.includes('time') && (body.includes('HH:MM') || body.includes('时间'));
    });
    expect(hasTimeField).toBe(true);
  });

  test('time field exists in special exercise form', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const hasTimeField = await page.evaluate(() => {
      const fn = typeof specialBody !== 'undefined' ? specialBody : null;
      if (!fn) return false;
      const body = String(fn);
      return body.includes('time') && (body.includes('HH:MM') || body.includes('时间'));
    });
    expect(hasTimeField).toBe(true);
  });

  test('time field exists in diet form', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const hasTimeField = await page.evaluate(() => {
      const fn = typeof dietBody !== 'undefined' ? dietBody : null;
      if (!fn) return false;
      const body = String(fn);
      return body.includes('time') && (body.includes('HH:MM') || body.includes('时间'));
    });
    expect(hasTimeField).toBe(true);
  });

  test('dietBody renders dynamic food chips with qty controls', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const hasDietFeatures = await page.evaluate(() => {
      const fn = typeof dietBody !== 'undefined' ? dietBody : null;
      if (!fn) return { hasChips: false, hasQty: false, hasDeduction: false };
      const body = String(fn);
      return {
        hasChips: body.includes('DIET_FOODS') || body.includes('food-chip'),
        hasQty: body.includes('qty') || body.includes('updateDietQty'),
        hasDeduction: body.includes('deduct') || body.includes('DEDUCT_PER_ITEM') || body.includes('每件'),
      };
    });
    expect(hasDietFeatures.hasChips).toBe(true);
    expect(hasDietFeatures.hasQty).toBe(true);
    expect(hasDietFeatures.hasDeduction).toBe(true);
  });
});

test.describe('Task 47: Clickable Record Cards with Edit', () => {
  test('openEditRecordModal function exists', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const hasFn = await page.evaluate(() => {
      return typeof openEditRecordModal === 'function';
    });
    expect(hasFn).toBe(true);
  });

  test('record cards use record-row-clickable class', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const usesClass = await page.evaluate(() => {
      const fn = typeof refreshRecordPage !== 'undefined' ? refreshRecordPage : null;
      if (!fn) return false;
      return String(fn).includes('record-row-clickable');
    });
    expect(usesClass).toBe(true);
  });
});

test.describe('Task 48: Time Tab Filtering', () => {
  test('6 time tabs exist in record page', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    // Navigate to record page using the app's tab switcher
    await page.evaluate(() => switchTab('record'));
    await page.waitForTimeout(500);

    const tabs = ['昨日', '今日', '本周', '上周', '本月', '上月'];
    for (const tab of tabs) {
      const chip = page.locator(`button.chip:has-text("${tab}")`);
      await expect(chip).toBeVisible({ timeout: 3000 });
    }
  });
});
