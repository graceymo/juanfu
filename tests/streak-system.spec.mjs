// 连续打卡系统测试（设计文档 3.5.4）
// 覆盖：基于实际记录的 streak 计算 / 频率周期映射 / 加成梯度查表 / 积分联动

import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE = 'file://' + resolve(__dirname, '..', 'public', 'prototype.html');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function makeRecord(type, date, fields) {
  const base = {
    id: 'r' + Math.random().toString(36).slice(2, 9),
    type, points: 18, photo: false, shared: false, feedText: '',
    date, time: '10:00', createdAt: new Date(date + 'T10:00').getTime()
  };
  const overrides = {};
  if (type === 'daily') Object.assign(overrides, { group: '下肢', exercise: '深蹲', reps: 30, sets: 3 });
  if (type === 'special') Object.assign(overrides, { category: '攀岩', sport: '室内难度', minutes: 90 });
  if (type === 'diet') Object.assign(overrides, { food: '奶茶', qty: 1 });
  return { ...base, ...overrides, ...fields };
}

function makeStateWithRecords(records) {
  // 累加器语义：weeklyPoints = records.points 之和（与 Dashboard #weeklyPoints + 排行榜同源）
  const total = (records || []).reduce((s, r) => s + (r.points || 0), 0);
  return {
    onboardingDone: true,
    unlocked: true,
    nick: 'Gracey', emoji: '🐙',
    freq: 'daily',
    circles: [
      {
        id: 'preset-1', name: '八组卷王', role: 'leader', code: 'AAA', members: 2, pending: false,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: total, isMe: true, isLeader: true },
          { emoji: '🦊', name: 'Monk', score: 80, isMe: false, isLeader: false }
        ],
        joinRequests: []
      }
    ],
    activeCircleId: 'preset-1',
    todayRecords: records,
    weeklyPoints: total, streakDays: 0,
    // quarterPoints 是本季度累加器，测试初始状态设为 0（表示本季度还没积累过）
    quarterPoints: 0,
    schedule: {},
    notifications: []
  };
}

// ==================== 1. Streak 计算 ====================
test('Daily 频率：连续 3 天运动 → streak = 3, bonus = +3（2 次起 +3）', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('daily', dateStr(1), { points: 18 }),
    makeRecord('daily', dateStr(2), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('3');
  const row3 = page.locator('#statusPopulated .stat-row').nth(2);
  await expect(row3.locator('.stat-value')).toContainText('+3');
  await expect(row3.locator('.stat-meta')).toContainText('3 天');
});

test('Daily 频率：只有今天一条运动 → streak = 1, bonus = 0（不满 2 次）', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('1');
  const row3 = page.locator('#statusPopulated .stat-row').nth(2);
  await expect(row3.locator('.stat-value')).toContainText('+0');
});

test('Daily 频率：每天连续 4 天 → streak = 4, bonus = +5（>=4 次 +5）', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('daily', dateStr(1), { points: 18 }),
    makeRecord('daily', dateStr(2), { points: 18 }),
    makeRecord('daily', dateStr(3), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('4');
  const row3 = page.locator('#statusPopulated .stat-row').nth(2);
  await expect(row3.locator('.stat-value')).toContainText('+5');
});

test('Daily 频率：7 天连续 → streak = 7, bonus = +10', async ({ page }) => {
  const today = todayStr();
  const records = [];
  for (let i = 0; i < 7; i++) {
    records.push(makeRecord('daily', dateStr(i), { points: 18 }));
  }
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords(records));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('7');
  const row3 = page.locator('#statusPopulated .stat-row').nth(2);
  await expect(row3.locator('.stat-value')).toContainText('+10');
});

// ==================== 2. 中断打断连续 ====================
test('中断打断连续：第 0/1/5 天运动，连续只到 day 0-1 → streak = 2', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('daily', dateStr(1), { points: 18 }),
    // dateStr(2) 没有记录（打断连续）
    makeRecord('daily', dateStr(4), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 最近连续段：today ✓, day-1 ✓, day-2 ✗ → streak = 2
  await expect(page.locator('#streakDays')).toContainText('2');
});

// ==================== 3. 饮食不计入 streak ====================
test('饮食记录不参与 streak：只有饮食 → streak = 0', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('diet', today, { points: -5 }),
    makeRecord('diet', dateStr(1), { points: -5 }),
    makeRecord('diet', dateStr(2), { points: -5 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('0');
});

// ==================== 4. 多运动类型混合 ====================
test('Daily+Special 混合：3 天各有至少 1 次运动 → streak = 3', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('special', dateStr(1), { points: 77 }),
    makeRecord('daily', dateStr(2), { points: 18 }),
    makeRecord('special', dateStr(2), { points: 77 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('3');
});

// ==================== 5. 今日净积分含 streakBonus ====================
test('今日净积分 = 运动分 + streakBonus + 饮食扣分', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('special', today, { points: 77 }),
    makeRecord('diet', today, { points: -5 }),
    makeRecord('daily', dateStr(1), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 今日运动 = 18+77=95, diet=-5, streak=2→bonus=+3 → 净=93
  const netPtsEl = page.locator('#todayNetPoints');
  await expect(netPtsEl).toContainText('+93');
});

// ==================== 6. 本周积分 = 本周 records 加总（不含 streak） ====================
// 仪表盘 #weeklyPoints 改为从 todayRecords 过滤本周求和（拉齐记录板块本周 tab）；
// streak 是临时态奖励，单独在"连续打卡加分"行展示，不应重复计入 #weeklyPoints
test('本周积分 = 本周 records 加总（不含 streak）', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('special', today, { points: 77 }),
    makeRecord('diet', today, { points: -5 }),
    makeRecord('daily', dateStr(1), { points: 18 }),
    makeRecord('daily', dateStr(2), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // records sum 本周 = 18+77-5+18+18 = 126
  // streak 是临时态奖励，在"连续打卡加分"行单独展示，不重复计入 #weeklyPoints
  const wpText = await page.locator('#weeklyPoints').textContent();
  expect(parseInt(wpText, 10)).toBe(126);
});

// ==================== 7. 本周积分不含 streakBonus；本季度累计不含 streakBonus ====================
// 仪表盘两个时间窗都从 records 派生（本周/本季度），都不含 streak
test('本周积分 = records sum（不含 streak）；本季度累计 = records sum（不含 streak）', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    ...makeStateWithRecords([
      makeRecord('daily', today, { points: 18 }),
      makeRecord('daily', dateStr(1), { points: 18 }),
      makeRecord('daily', dateStr(2), { points: 18 }),
      makeRecord('daily', dateStr(3), { points: 18 })
    ]),
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // base=72 from records sum (4×18)
  // #weeklyPoints = 72（不含 streakBonus，streak 单独在"连续打卡加分"展示）
  const wpText = await page.locator('#weeklyPoints').textContent();
  expect(parseInt(wpText, 10)).toBe(72);
  // #quarterPoints = 72（与 #weeklyPoints 同源：本季度窗口包含本周窗口，且都是 records sum）
  const qpText = await page.locator('#quarterPoints').textContent();
  expect(parseInt(qpText, 10)).toBe(72);
});

// ==================== 8. Streak 行内容 ====================
test('Streak 行显示频率标签和正确分值', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('daily', dateStr(1), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const row3 = page.locator('#statusPopulated .stat-row').nth(2);
  await expect(row3.locator('.stat-name')).toContainText('连续打卡加分');
  await expect(row3.locator('.stat-meta')).toContainText('每日');
  await expect(row3.locator('.stat-meta')).toContainText('频率');
  await expect(row3.locator('.stat-value')).toContainText('+3');
});

// ==================== 9. 编辑日期改变 streak ====================
test('编辑 record.date 从今天改到 10 天前 → 最近连续段仅剩昨天 → streak = 1', async ({ page }) => {
  const today = todayStr();
  const oldDate = dateStr(10);
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('daily', today, { points: 18 }),
    makeRecord('daily', dateStr(1), { points: 18 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await expect(page.locator('#streakDays')).toContainText('2');

  // 把今天的记录改到 10 天前 → today 无记录，mostRecent=day-1，day-2 ✗ → streak=1
  await page.evaluate((newDate) => {
    appState.todayRecords[0].date = newDate;
    refreshDashboard();
  }, oldDate);
  await page.waitForTimeout(300);

  const sd = await page.locator('#streakDays').textContent();
  expect(parseInt(sd, 10)).toBe(1);
});
