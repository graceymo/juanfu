// 验证专项运动在仪表盘"今日状态"和"记录"页面都显示"一级·二级"分类
import { test, expect } from '@playwright/test';
import path from 'path'; import { fileURLToPath } from 'url';
const BASE = 'file://' + path.resolve(fileURLToPath(import.meta.url), '../../public/prototype.html');

function makeTodayRecord(type, fields) {
  // 关键：使用本地时间格式（与页内 nowDateStr() 一致），避免 UTC/本地日期差异
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // 关键：createdAt 必须是毫秒时间戳（数字），与 Date.now() 比较；不能是 ISO 字符串
  const ts = new Date().getTime();
  return { id: 'r' + Math.random().toString(36).slice(2, 9), type, points: 77, photo: false, shared: false, feedText: '', date: today, time: '18:25', createdAt: ts, ...fields };
}

function fakeStateWithRecords() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    onboardingDone: true,    // 关键：loadAppState 检查的是 onboardingDone
    onboarded: true,
    nick: 'Gracey',
    circles: [],
    activeCircleId: null,
    quarterKey: '2026Q3',
    quarterPoints: 77,
    weeklyPoints: 77,
    streakDays: 1,
    todayRecords: [
      // 日常：group·exercise
      makeTodayRecord('daily', { group: '下肢', exercise: '深蹲', reps: 30, sets: 3 }),
      // 专项：category·sport
      makeTodayRecord('special', { category: '攀岩', sport: '室内难度', minutes: 90, watchCal: '650' }),
    ],
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeStateWithRecords());
  await page.goto(BASE);
  await page.waitForTimeout(800);
});

test('仪表盘今日状态摘要行：专项显示 "攀岩·室内难度 90min"', async ({ page }) => {
  // statusPopulated > 第一行 stat-meta（已完成运动的描述）
  const meta = await page.locator('#statusPopulated .stat-row').first().locator('.stat-meta').textContent();
  expect(meta).toContain('深蹲');
  // 关键断言：专项要带一级分类
  expect(meta).toContain('攀岩');
  expect(meta).toContain('室内难度');
  expect(meta).toMatch(/攀岩·室内难度 90min/);
});

test('仪表盘今日状态：运动汇总行的 meta 包含专项 "攀岩·室内难度 90min"', async ({ page }) => {
  // 今日状态只剩 2 行：① 已完成运动（汇总）② 已摄入垃圾食品
  // 专项运动合并到第 1 行的 stat-meta
  const row1 = page.locator('#statusPopulated .stat-row').nth(0);
  const meta = await row1.locator('.stat-meta').textContent();
  expect(meta).toContain('攀岩·室内难度');
  expect(meta).toContain('90min');
});

test('记录页面专项卡片：列表项 name 字段为 "攀岩·室内难度"', async ({ page }) => {
  await page.evaluate(() => switchTab('record'));
  await page.waitForTimeout(500);
  // 记录页面专项运动的 name 在 .stat-name 元素里
  const specialName = page.locator('#recordSpecialList .stat-name').first();
  const text = await specialName.textContent();
  expect(text).toBe('攀岩·室内难度');
});

test('记录页面专项卡片：日常运动仍是 "下肢·深蹲"（未被破坏）', async ({ page }) => {
  await page.evaluate(() => switchTab('record'));
  await page.waitForTimeout(500);
  const dailyName = page.locator('#recordDailyList .stat-name').first();
  const text = await dailyName.textContent();
  expect(text).toBe('下肢·深蹲');
});
