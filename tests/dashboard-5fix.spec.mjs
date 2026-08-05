// 验证 4 个最新修复：
// 1) 今日状态只剩 2 行（运动 + 垃圾食品）
// 2) 热力图 today 不覆盖 lvl 颜色
// 3) 社群 mock 帖子按 active circle 过滤
// 4) 改时间后热力图能正确反映 records 的 r.date
// （趋势图已删除，2026-07-22）

import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

function makeTodayRecord(type, fields) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const base = { id: 'r' + Math.random().toString(36).slice(2, 9), type, points: 18, photo: false, shared: false, feedText: '', date: today, time: '10:00', createdAt: now.getTime() };
  return { ...base, ...fields };
}

function makeStateWithRecords(records) {
  return {
    onboardingDone: true,
    unlocked: true,
    nick: 'Gracey', emoji: '🐙',
    circles: [
      {
        id: 'preset-1', name: '八组卷王', role: 'leader', code: 'AAA', members: 2, pending: false,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: 100, isMe: true, isLeader: true },
          { emoji: '🦊', name: 'Monk', score: 80, isMe: false, isLeader: false }
        ],
        joinRequests: []
      },
      {
        id: 'preset-2', name: 'K800 品牌群', role: 'member', code: 'K800ABCD', members: 2, pending: false,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: 50, isMe: true, isLeader: false },
          { emoji: '🐨', name: 'Kenny', score: 98, isMe: false, isLeader: true }
        ],
        joinRequests: []
      }
    ],
    activeCircleId: 'preset-1',
    todayRecords: records,
    weeklyPoints: 0, streakDays: 0, quarterPoints: 0,
    schedule: {},
    notifications: []
  };
}

// ============== 修复 1：今日状态只剩 2 行 ==============
test('修复1: 今日状态只有 2 行（运动 + 垃圾食品），无 record 明细', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeTodayRecord('daily', { group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18 }),
    makeTodayRecord('special', { category: '攀岩', sport: '室内难度', minutes: 90, watchCal: '650', points: 77 }),
    makeTodayRecord('diet', { food: '奶茶', qty: 1, points: -5 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const rowCount = await page.locator('#statusPopulated .stat-row').count();
  expect(rowCount).toBe(3); // 运动 + 垃圾食品 + 连续打卡加分

  // 第 1 行：运动汇总（深蹲 + 攀岩）
  const row1 = page.locator('#statusPopulated .stat-row').nth(0);
  await expect(row1.locator('.stat-name')).toContainText('已完成运动');
  await expect(row1.locator('.stat-meta')).toContainText('下肢·深蹲 30×3');
  await expect(row1.locator('.stat-meta')).toContainText('攀岩·室内难度 90min');
  await expect(row1.locator('.stat-value')).toContainText('95');  // 18+77

  // 第 2 行：垃圾食品汇总
  const row2 = page.locator('#statusPopulated .stat-row').nth(1);
  await expect(row2.locator('.stat-name')).toContainText('已摄入垃圾食品');
  await expect(row2.locator('.stat-meta')).toContainText('奶茶 1 杯');
  await expect(row2.locator('.stat-value')).toContainText('-5');
});

test('修复1b: 多种垃圾食品按食物聚合', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeTodayRecord('diet', { food: '奶茶', qty: 2, points: -10 }),
    makeTodayRecord('diet', { food: '炸鸡', qty: 1, points: -5 }),
    makeTodayRecord('diet', { food: '奶茶', qty: 1, points: -5 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const row2 = page.locator('#statusPopulated .stat-row').nth(1);
  const meta = await row2.locator('.stat-meta').textContent();
  expect(meta).toContain('奶茶 3 杯');
  expect(meta).toContain('炸鸡 1 杯');
  await expect(row2.locator('.stat-value')).toContainText('-20');
});

// ============== 修复 2：热力图 today 不覆盖 lvl ==============
test('修复2: 热力图 today 格子保留 lvl 颜色（用边框高亮）', async ({ page }) => {
  const now = new Date();
  const today = now.getDate();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    // 今天的记录，>=50 分 → lvl l4（蓝色 #4F8FE6）
    makeTodayRecord('special', { category: '攀岩', sport: '室内难度', minutes: 90, watchCal: '650', points: 77 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 找到今天格子
  const todayCell = page.locator(`#heatmapGrid .heatmap-cell:has-text("${today}")`).first();
  const cls = await todayCell.getAttribute('class');
  // today 应该有 l4 class
  expect(cls).toContain('l4');
  // 不应再被 background:var(--green) 覆盖
  const style = await todayCell.getAttribute('style');
  expect(style).not.toContain('background:var(--green)');
  // 应有边框
  expect(style).toContain('border:2px solid var(--green)');
});

test('修复2b: 改 records 日期后，热力图原日期变灰、新日期有色', async ({ page }) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const day10 = `${y}-${String(m).padStart(2, '0')}-10`;
  const day15 = `${y}-${String(m).padStart(2, '0')}-15`;
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    // 记录初始在 10 号（lvl 颜色），后面在测试里改为 15 号
    makeTodayRecord('special', { category: '攀岩', sport: '室内难度', minutes: 90, points: 77, date: day10, time: '10:00' })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 初始：10 号有色，15 号没色
  const cell10Before = page.locator(`#heatmapGrid .heatmap-cell:has-text("10")`).first();
  expect(await cell10Before.getAttribute('class')).toContain('l4');
  const cell15Before = page.locator(`#heatmapGrid .heatmap-cell:has-text("15")`).first();
  expect(await cell15Before.getAttribute('class')).not.toMatch(/l[1-4]/);

  // 改日期：10 → 15
  await page.evaluate((newDate) => {
    const r = appState.todayRecords[0];
    r.date = newDate;
    r.time = '10:00';
    refreshDashboard();
  }, day15);
  await page.waitForTimeout(300);

  // 改后：10 号变灰，15 号有色
  const cell10After = page.locator(`#heatmapGrid .heatmap-cell:has-text("10")`).first();
  expect(await cell10After.getAttribute('class')).not.toMatch(/l[1-4]/);
  const cell15After = page.locator(`#heatmapGrid .heatmap-cell:has-text("15")`).first();
  expect(await cell15After.getAttribute('class')).toContain('l4');
});

// ============== 修复 3：mock 帖子按 active circle 过滤 ==============
test('修复3: active=preset-1 时社群只显示 Monk/Gracey，不显示 Kenny', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([]));
  await page.goto(BASE);
  await page.waitForTimeout(800);
  // 切到社群 tab
  await page.evaluate(() => switchTab('community'));
  await page.waitForTimeout(500);

  const names = await page.locator('#communityFeedMock .post .post-name').allTextContents();
  expect(names).toContain('Monk');
  expect(names).toContain('Gracey');
  expect(names).not.toContain('Kenny');
});

test('修复3b: active=preset-2 时社群只显示 Kenny/Gracey，不显示 Monk', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([]));
  await page.goto(BASE);
  await page.waitForTimeout(800);
  // 切到 preset-2
  await page.evaluate(() => switchActiveCircle('preset-2'));
  await page.waitForTimeout(300);
  await page.evaluate(() => switchTab('community'));
  await page.waitForTimeout(500);

  const names = await page.locator('#communityFeedMock .post .post-name').allTextContents();
  expect(names).toContain('Kenny');
  expect(names).not.toContain('Monk');
});

// ============== 修复 3 之后的部分已删除（趋势图整体下线 2026-07-22） ==============
