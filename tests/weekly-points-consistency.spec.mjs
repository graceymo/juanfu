import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'http://localhost:8080/prototype.html';

const wKeyOf = (d = new Date()) => {
  const now = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow - 1));
  const year = monday.getFullYear();
  const start = new Date(year, 0, 1);
  const days = Math.floor((monday - start) / 86400000);
  return year + '-W' + String(Math.ceil(days / 7 + 1)).padStart(2, '0');
};

const fakeOldWeekState = (oldWeekKey, weeklyPoints = 95) => ({
  onboardingDone: true, hasCircle: true,
  nick: 'Gracey', emoji: '🐙', freq: 'daily',
  circles: [{
    id: 'c-princess', name: '原来你也是公主', role: 'leader', code: 'PRN00001',
    members: 2, pending: false, reward: '', weeklyReward: false,
    memberList: [
      { emoji: '🐙', name: 'Gracey', score: weeklyPoints, isMe: true, isLeader: true, joinDate: '2026-W21' },
      { emoji: '🦊', name: 'Monk',    score: 72, isMe: false, isLeader: false, joinDate: '2026-W22' }
    ],
    joinRequests: [],
    weeklyChampions: [
      { name: 'Gracey', emoji: '🐙', weekKey: '2026-W25', points: 130 }
    ]
  }],
  activeCircleId: 'c-princess',
  notifications: [],
  todayRecords: [],
  schedule: {},
  weeklyPoints,
  streakDays: 3, streakBonus: 3,
  // 新版 quarterPoints 是"本季度累加器"——与 weeklyPoints 语义不同
  // 用差异 > 20 的值，避免被 loadAppState 的数据迁移启发式清零
  quarterPoints: 500,
  quarterKey: '2026Q3',
  weekKey: oldWeekKey  // 旧周 → 触发 checkWeekReset
});

// ========== 1. 刷新时自动清零周累加器（不依赖 submit） ==========
test('刷新时自动清零跨周积分：累加器 + memberList[isMe].score + weekKey 全部归位', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeOldWeekState('2020-W01', 95));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    weeklyPoints: appState.weeklyPoints,
    memberScore: appState.circles[0].memberList.find(m => m.isMe).score,
    weekKey: appState.weekKey
  }));
  // 旧周加载后立即清零（checkWeekReset 在 refreshDashboard 入口触发）
  expect(after.weeklyPoints).toBe(0);
  expect(after.memberScore).toBe(0);
  expect(after.weekKey).toMatch(/^20\d{2}-W\d+$/);
  expect(after.weekKey).not.toBe('2020-W01');
});

// ========== 2. Dashboard #weeklyPoints / #quarterPoints 派生自 records（不走累加器） ==========
test('Dashboard #weeklyPoints / #quarterPoints = records sum in time window（不走累加器）', async ({ page }) => {
  // 注入 3 条本季度、本周内的 daily records（每日 30 分）
  // records sum this week = 3 × 30 = 90；records sum this quarter = 3 × 30 = 90
  const today = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const records = [0, 1, 2].map(i => {
    const dt = new Date(today); dt.setDate(dt.getDate() - i);
    return { type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 30,
             time: '10:00', date: fmt(dt), createdAt: dt.getTime() };
  });
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, { ...fakeOldWeekState(wKeyOf(), 9999), todayRecords: records }); // 同周（不触发清零）
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => ({
    wp: parseInt(document.getElementById('weeklyPoints').textContent, 10),
    qp: parseInt(document.getElementById('quarterPoints').textContent, 10),
    weeklyPoints: appState.weeklyPoints,
    quarterPoints: appState.quarterPoints,
    streakBonus: appState.streakBonus || 0
  }));
  // 关键断言：仪表盘 #weeklyPoints / #quarterPoints 不走累加器
  // 即使累加器被注入 9999，仪表盘也只显示记录之和（90）
  expect(result.wp).toBe(90);
  expect(result.qp).toBe(90);
  // 累加器被注入 9999 但不影响仪表盘
  expect(result.weeklyPoints).toBe(9999);
  expect(result.quarterPoints).toBe(500);
});

// ========== 3. 时间窗不同：#quarterPoints ≥ #weeklyPoints ==========
test('时间窗不同：#quarterPoints 包含本周之前本周之后的记录；#weeklyPoints 仅本周', async ({ page }) => {
  // 注入 5 条记录：
  //   - 本周 2 条（最近 2 天，每天 20 分）
  //   - 本季度内、本周外 2 条（4 天前、5 天前，每天 25 分）
  //   - 上季度 1 条（60 天前，15 分）—— 应被季度窗口过滤掉
  const today = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rec = (daysAgo, points) => {
    const dt = new Date(today); dt.setDate(dt.getDate() - daysAgo);
    return { type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points,
             time: '10:00', date: fmt(dt), createdAt: dt.getTime() };
  };
  const records = [rec(0, 20), rec(1, 20), rec(4, 25), rec(5, 25), rec(60, 15)];
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, { ...fakeOldWeekState(wKeyOf(), 200), todayRecords: records });
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const records = appState.todayRecords || [];
    const weekSum = records.filter(r => isInPeriod(r, 'week')).reduce((s, r) => s + (r.points || 0), 0);
    const now = new Date();
    const qm = Math.floor(now.getMonth() / 3);
    const qStart = new Date(now.getFullYear(), qm * 3, 1).getTime();
    const qEnd = new Date(now.getFullYear(), qm * 3 + 3, 1).getTime();
    const quarterSum = records.filter(r => { const ts = recordDate(r); return ts >= qStart && ts < qEnd; }).reduce((s, r) => s + (r.points || 0), 0);
    return {
      wp: parseInt(document.getElementById('weeklyPoints').textContent, 10),
      qp: parseInt(document.getElementById('quarterPoints').textContent, 10),
      weekSum,
      quarterSum
    };
  });
  // #weeklyPoints = 本周内 records sum
  expect(result.wp).toBe(result.weekSum);
  // #quarterPoints = 本季度内 records sum（跨周但不跨季度的记录计入季度）
  expect(result.qp).toBe(result.quarterSum);
  // 季度累计 ≥ 本周积分（因为季度窗口包含本周窗口）
  expect(result.qp).toBeGreaterThanOrEqual(result.wp);
});

// ========== 4. 同一圈子内累加器跨周清零后排行榜分数同步清零 ==========
test('累加器跨周清零时所有圈子 memberList[isMe].score 同步清零', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    onboardingDone: true, hasCircle: true,
    nick: 'Gracey', emoji: '🐙', freq: 'daily',
    circles: [
      {
        id: 'c1', name: '公主圈', role: 'leader', code: 'C1',
        members: 2, pending: false, reward: '', weeklyReward: false,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: 50, isMe: true, isLeader: true, joinDate: '2026-W21' },
          { emoji: '🦊', name: 'Monk', score: 30, isMe: false, isLeader: false, joinDate: '2026-W22' }
        ], joinRequests: [], weeklyChampions: []
      },
      {
        id: 'c2', name: 'K800 品牌群', role: 'member', code: 'C2',
        members: 2, pending: false, reward: '', weeklyReward: false,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: 50, isMe: true, isLeader: false, joinDate: '2026-W22' },
          { emoji: '🐨', name: 'Kenny', score: 30, isMe: false, isLeader: true, joinDate: '2026-W22' }
        ], joinRequests: [], weeklyChampions: []
      }
    ],
    activeCircleId: 'c1',
    notifications: [],
    todayRecords: [],
    schedule: {},
    weeklyPoints: 50,
    streakDays: 0, streakBonus: 0,
    quarterPoints: 50,
    quarterKey: '2026Q3',
    weekKey: '2020-W01'  // 旧周
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    c1: appState.circles[0].memberList.find(m => m.isMe).score,
    c2: appState.circles[1].memberList.find(m => m.isMe).score,
    wp: appState.weeklyPoints
  }));
  // 两个圈子的 Gracey.score 都应该被清零（不只是当前活跃圈子）
  expect(after.c1).toBe(0);
  expect(after.c2).toBe(0);
  expect(after.wp).toBe(0);
});
