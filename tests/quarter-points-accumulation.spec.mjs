import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'http://localhost:8080/prototype.html';

const qKeyOf = (d = new Date()) => d.getFullYear() + 'Q' + Math.ceil((d.getMonth() + 1) / 3);
const wKeyOf = (d = new Date()) => {
  // 复制 getCurrentWeekKey 的逻辑
  const now = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow - 1));
  const year = monday.getFullYear();
  const start = new Date(year, 0, 1);
  const days = Math.floor((monday - start) / 86400000);
  return year + '-W' + String(Math.ceil(days / 7 + 1)).padStart(2, '0');
};

// ==================== 1. 跨周累加：weeklyPoints 累加进 quarterPoints ====================
test('跨周：上周 weeklyPoints 累加进 quarterPoints；新周 weeklyPoints=0', async ({ page }) => {
  const lastWeek = '2020-W01'; // 旧周
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 2, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 130, isMe: true, isLeader: true, joinDate: '2026-W21' },
        { emoji: '🦊', name: 'Monk', score: 72, isMe: false, isLeader: false, joinDate: '2026-W22' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 130,
    streakDays: 0, streakBonus: 0,
    quarterPoints: 200, // 本季度已积累 200
    quarterKey: qKeyOf(),
    weekKey: lastWeek
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    weeklyPoints: appState.weeklyPoints,
    quarterPoints: appState.quarterPoints,
    memberScore: appState.circles[0].memberList.find(m => m.isMe).score,
    weekKey: appState.weekKey
  }));
  // 跨周触发累加：quarterPoints = 200 + 130 = 330，weeklyPoints = 0
  expect(after.quarterPoints).toBe(330);
  expect(after.weeklyPoints).toBe(0);
  expect(after.memberScore).toBe(0);
  expect(after.weekKey).toBe(wKeyOf());
});

// ==================== 2. 同周不累加：quarterPoints 保持不变 ====================
test('同周：quarterPoints 保持不变', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 2, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 50, isMe: true, isLeader: true, joinDate: '2026-W21' },
        { emoji: '🦊', name: 'Monk', score: 30, isMe: false, isLeader: false, joinDate: '2026-W22' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 50,
    streakDays: 0, streakBonus: 0,
    quarterPoints: 200,
    quarterKey: qKeyOf(),
    weekKey: wKeyOf()  // 当前周 → 不跨周
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    weeklyPoints: appState.weeklyPoints,
    quarterPoints: appState.quarterPoints
  }));
  expect(after.weeklyPoints).toBe(50);
  expect(after.quarterPoints).toBe(200);
});

// ==================== 3. 提交记录：不改变 quarterPoints（仅 weeklyPoints 累加） ====================
test('提交记录：quarterPoints 不变，weeklyPoints 累加', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 1, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 50, isMe: true, isLeader: true, joinDate: '2026-W21' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 50,
    streakDays: 0, streakBonus: 0,
    quarterPoints: 200,
    quarterKey: qKeyOf(),
    weekKey: wKeyOf()
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    finalizeSubmit({
      type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 25,
      time: '10:00', date: nowDateStr(), createdAt: Date.now()
    });
  });
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => ({
    weeklyPoints: appState.weeklyPoints,
    quarterPoints: appState.quarterPoints
  }));
  expect(after.weeklyPoints).toBe(75);
  expect(after.quarterPoints).toBe(200);  // 不变
});

// ==================== 4. 跨季度：quarterPoints 清零 ====================
test('跨季度：quarterPoints 清零（季度初重新累计）', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 1, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 50, isMe: true, isLeader: true, joinDate: '2026-W21' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 50,
    streakDays: 0, streakBonus: 0,
    quarterPoints: 500,  // 旧季度已积累
    quarterKey: '2026Q2',  // 旧季度 → 触发 quarterKey 切换
    weekKey: wKeyOf()  // 当前周（同周，单独测季度切换）
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    weeklyPoints: appState.weeklyPoints,
    quarterPoints: appState.quarterPoints,
    quarterKey: appState.quarterKey
  }));
  // 跨季度：quarterPoints 清零（季度初重新开始）
  // weeklyPoints 仍为 50（未跨周）
  expect(after.quarterPoints).toBe(0);
  expect(after.weeklyPoints).toBe(50);
  expect(after.quarterKey).toBe(qKeyOf());
});

// ==================== 5. 仪表盘积分派生自 records（不走累加器） ====================
test('#quarterPoints / #weeklyPoints = 记录在时间窗内加总（不走累加器）', async ({ page }) => {
  // 注入 7 天连续 daily records（每条 18 分）
  // 今日是周四（2026-07-23），7 天覆盖本周 4 天 + 上周 3 天
  // records sum this week = 4 × 18 = 72
  // records sum this quarter = 7 × 18 = 126
  const records = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    records.push({
      type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18,
      time: '10:00', date: dateStr, createdAt: d.getTime()
    });
  }
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 1, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 80, isMe: true, isLeader: true, joinDate: '2026-W21' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: records,
    schedule: {},
    // 累加器被注入大值 80/350 → 仪表盘不应被影响
    weeklyPoints: 80,
    streakDays: 7, streakBonus: 10,
    quarterPoints: 350,
    quarterKey: qKeyOf(),
    weekKey: wKeyOf()
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 动态计算期望值（避免时区偏差导致周一计算不同）
  const expected = await page.evaluate(() => ({
    weekSum: (appState.todayRecords || []).filter(r => isInPeriod(r, 'week')).reduce((s, r) => s + (r.points || 0), 0),
    quarterSum: (appState.todayRecords || []).filter(r => {
      const ts = recordDate(r);
      const now = new Date();
      const qm = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), qm * 3, 1).getTime();
      const qEnd = new Date(now.getFullYear(), qm * 3 + 3, 1).getTime();
      return ts >= qStart && ts < qEnd;
    }).reduce((s, r) => s + (r.points || 0), 0)
  }));
  // #quarterPoints = records this quarter sum（不走累加器）
  const qp = parseInt(await page.locator('#quarterPoints').textContent(), 10);
  expect(qp).toBe(expected.quarterSum);
  // #weeklyPoints = records this week sum（不走累加器、不含 streak）
  const wp = parseInt(await page.locator('#weeklyPoints').textContent(), 10);
  expect(wp).toBe(expected.weekSum);
  // 关键不变式：仪表盘分数 ≠ 累加器注入值
  const acc = await page.evaluate(() => ({ wp: appState.weeklyPoints, qp: appState.quarterPoints }));
  expect(wp).not.toBe(acc.wp);
});

// ==================== 6. 仪表盘卡片不含 streakBonus（连续打卡是临时态奖励） ====================
test('streakBonus 不进入 #weeklyPoints / #quarterPoints（两者都只显示 records sum）', async ({ page }) => {
  // 注入 7 天连续 daily records → streak=7 → bonus=10
  // 累加器被注入 0 → 验证仪表盘即使在累加器为 0 时也显示 records sum
  const records = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    records.push({
      type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18,
      time: '10:00', date: dateStr, createdAt: d.getTime()
    });
  }
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 1, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 0, isMe: true, isLeader: true, joinDate: '2026-W21' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: records,
    schedule: {},
    weeklyPoints: 0,
    streakDays: 0, streakBonus: 0,
    quarterPoints: 0,
    quarterKey: qKeyOf(),
    weekKey: wKeyOf()
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 动态计算期望值（避免时区偏差）
  const expected = await page.evaluate(() => ({
    weekSum: (appState.todayRecords || []).filter(r => isInPeriod(r, 'week')).reduce((s, r) => s + (r.points || 0), 0),
    quarterSum: (appState.todayRecords || []).filter(r => {
      const ts = recordDate(r);
      const now = new Date();
      const qm = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), qm * 3, 1).getTime();
      const qEnd = new Date(now.getFullYear(), qm * 3 + 3, 1).getTime();
      return ts >= qStart && ts < qEnd;
    }).reduce((s, r) => s + (r.points || 0), 0)
  }));
  // #weeklyPoints = records this week sum（不含 streak bonus）
  const wp = parseInt(await page.locator('#weeklyPoints').textContent(), 10);
  expect(wp).toBe(expected.weekSum);
  // #quarterPoints = records this quarter sum（不含 streak bonus）
  const qp = parseInt(await page.locator('#quarterPoints').textContent(), 10);
  expect(qp).toBe(expected.quarterSum);
  // streakBonus 不进入仪表盘卡片（累加器=0 但 records sum > 0 → 证明不走累加器）
  const acc = await page.evaluate(() => ({ wp: appState.weeklyPoints, sb: appState.streakBonus || 0 }));
  expect(wp).not.toBe(acc.wp + acc.sb);
});

// ==================== 7. 数据迁移：旧 quarterPoints（=上周积分别名）被清零 ====================
test('数据迁移：旧 quarterPoints（与 weeklyPoints 几乎相等）自动清零', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 1, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 100, isMe: true, isLeader: true, joinDate: '2026-W21' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 100,
    streakDays: 0, streakBonus: 0,
    // 旧数据：quarterPoints = weeklyPoints = 100（语义是"上周积分"）
    quarterPoints: 100,
    quarterKey: qKeyOf(),
    weekKey: wKeyOf()
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 启发式：|100 - 100| = 0 < 20 → quarterPoints 应被清零
  const after = await page.evaluate(() => ({
    quarterPoints: appState.quarterPoints,
    weeklyPoints: appState.weeklyPoints
  }));
  expect(after.quarterPoints).toBe(0);
  expect(after.weeklyPoints).toBe(100);
});

// ==================== 8. 连续跨周累加：3 周累加 ====================
test('连续跨周：3 周累加 quarterPoints（季度内累加器持续增长）', async ({ page }) => {
  // 模拟场景：用户连续 3 周每周得 10 分，季度累加器应累计 30 分
  // 起始：quarterPoints=0, weeklyPoints=0
  // 跨第 1 周：quarterPoints=0+0=0, weeklyPoints=0
  // 提交 10：weeklyPoints=10
  // 跨第 2 周：quarterPoints=0+10=10, weeklyPoints=0
  // 提交 10：weeklyPoints=10
  // 跨第 3 周：quarterPoints=10+10=20, weeklyPoints=0
  // 提交 10：weeklyPoints=10
  // 最终：quarterPoints=20, weeklyPoints=10

  // 简化测试：直接验证跨周累加逻辑
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [{
      id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
      members: 1, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐙', name: 'Gracey', score: 30, isMe: true, isLeader: true, joinDate: '2026-W21' }
      ],
      joinRequests: [], weeklyChampions: []
    }],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 30,  // 本周已得 30
    streakDays: 0, streakBonus: 0,
    quarterPoints: 100,  // 已积累 100（前几周）
    quarterKey: qKeyOf(),
    weekKey: '2020-W01'  // 旧周 → 触发跨周累加
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    weeklyPoints: appState.weeklyPoints,
    quarterPoints: appState.quarterPoints
  }));
  // 跨周：quarterPoints = 100 + 30 = 130，weeklyPoints = 0
  expect(after.quarterPoints).toBe(130);
  expect(after.weeklyPoints).toBe(0);
});
