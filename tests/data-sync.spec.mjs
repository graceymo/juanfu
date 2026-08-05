import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

// isMe 分数统一为本周 records 求和（与仪表盘 #weeklyPoints 同源）
// 注入 records 让 records sum = 130（与之前累加器测试数据一致）
const makeWeekRecords = (totalPoints) => {
  const now = new Date();
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
  // 用 special 类别，不受 daily 频次限制，单条 record 即可
  return [{
    id: 'r-mock', type: 'special', sport: '攀岩', minutes: 60, points: totalPoints,
    time: '10:00', date: today, createdAt: Date.now() - 1000
  }];
};

const fakeAppWithCircle = (qKey, wKey) => ({
  onboardingDone: true, hasCircle: true,
  nick: 'Gracey', emoji: '🐙', freq: 'daily',
  circles: [{
    id: 'c-princess', name: '原来你也是公主', role: 'leader', code: 'PRN00001',
    members: 2, pending: false, reward: '', weeklyReward: false,
    memberList: [
      { emoji: '🐙', name: 'Gracey', score: 130, isMe: true, isLeader: true },
      { emoji: '🦊', name: 'Monk',    score: 72, isMe: false, isLeader: false }
    ],
    joinRequests: []
  }],
  activeCircleId: 'c-princess',
  notifications: [],
  todayRecords: makeWeekRecords(130),
  schedule: {},
  weeklyPoints: 130,
  streakDays: 5,
  // 旧 quarterPoints 语义是"上周积分"，会被 loadAppState 启发式清零
  // 显式给一个与 weeklyPoints 差异 > 20 的值以避免被清零
  quarterPoints: 500,
  quarterKey: qKey,
  weekKey: wKey
});

test('数据源同步 1: 提交后 memberList[isMe].score 同步更新（季度累加器不变）', async ({ page }) => {
  const now = new Date();
  const qKey = now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3);

  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeAppWithCircle(qKey, undefined));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => ({
    memberScore: appState.circles[0].memberList.find(m => m.isMe).score,
    appQPts: appState.quarterPoints,
    weeklyPoints: appState.weeklyPoints
  }));
  expect(before.memberScore).toBe(130);
  expect(before.weeklyPoints).toBe(130);
  // quarterPoints 是本季度累加器——500（fakeAppWithCircle 注入的，与 weeklyPoints 差异 > 20 避免被清零）
  expect(before.appQPts).toBe(500);

  // 模拟提交 +20 分
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    finalizeSubmit({
      type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 20,
      time: '14:00', date: nowDateStr(), createdAt: Date.now()
    });
  });
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => ({
    memberScore: appState.circles[0].memberList.find(m => m.isMe).score,
    appQPts: appState.quarterPoints,
    weeklyPoints: appState.weeklyPoints
  }));
  // memberList + weeklyPoints 同步更新
  expect(after.memberScore).toBe(150);
  expect(after.weeklyPoints).toBe(150);
  // quarterPoints 不变（仅在跨周时累加，不在 submit 时变）
  expect(after.appQPts).toBe(500);
});

test('数据源同步 2: leaderboard 反映 memberList[isMe].score（唯一数据源）', async ({ page }) => {
  const now = new Date();
  const qKey = now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3);

  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeAppWithCircle(qKey, undefined));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // memberList[isMe].score=130（由 fakeAppWithCircle 注入）
  // 单独改 quarterPoints 不应影响排行榜（排行榜读 memberList）
  await page.evaluate(() => { appState.quarterPoints = 200; });
  await page.evaluate(() => switchTab('leaderboard'));
  await page.waitForTimeout(500);

  const podium = await page.locator('#lbPodium').textContent();
  // leaderboard 应读 memberList[isMe].score=130（而非 quarterPoints=200）
  expect(podium).toContain('130');
  expect(podium).not.toContain('200');
  expect(podium).toContain('Gracey');
  expect(podium).toContain('(我)');
});

test('数据源同步 3: 周切换时把上周 weeklyPoints 累加进 quarterPoints，memberList 同步清零（设计文档 3.5.5）', async ({ page }) => {
  const oldQKey = '2026Q3';
  const oldWKey = '2020-W01'; // 旧周，必定与当前周不同

  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeAppWithCircle(oldQKey, oldWKey));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 验证：旧周加载时立即触发 checkWeekReset()
  // ① memberList[isMe].score 已被清零（设计文档 3.5.5：每周一清零）
  // ② weeklyPoints 清零
  // ③ quarterPoints += 上周 weeklyPoints（130）= 500 + 130 = 630
  const before = await page.evaluate(() => ({
    memberScore: appState.circles[0].memberList.find(m => m.isMe).score,
    appQPts: appState.quarterPoints,
    weeklyPoints: appState.weeklyPoints,
    weekKey: appState.weekKey
  }));
  expect(before.memberScore).toBe(0);
  expect(before.weeklyPoints).toBe(0);
  expect(before.appQPts).toBe(630); // 500 + 130
  expect(before.weekKey).toMatch(/^20\d{2}-W\d+$/);

  // 提交新记录（应触发周切换 + 重置）
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    finalizeSubmit({
      type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 20,
      time: '14:00', date: nowDateStr(), createdAt: Date.now()
    });
  });
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => ({
    memberScore: appState.circles[0].memberList.find(m => m.isMe).score,
    appQPts: appState.quarterPoints,
    weeklyPoints: appState.weeklyPoints,
    wKey: appState.weekKey
  }));
  // 切换周后应先清零再累加，所以是 0 + 20 = 20（设计文档 3.5.5：每周一清零重新开始）
  expect(after.memberScore).toBe(20);
  expect(after.weeklyPoints).toBe(20);
  // quarterPoints 不变（只在跨周时累加；提交不改变）
  expect(after.appQPts).toBe(630);
  expect(after.wKey).toMatch(/^20\d{2}-W\d+$/);
});

test('数据源同步 4: leaderboard 反映提交后的最新分数', async ({ page }) => {
  const now = new Date();
  const qKey = now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3);

  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, fakeAppWithCircle(qKey, undefined));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 提交 2 次：+20 +30
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    finalizeSubmit({ type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 20, time: '10:00', date: nowDateStr(), createdAt: Date.now() });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    finalizeSubmit({ type: 'special', sport: '跑步', minutes: 30, points: 30, time: '11:00', date: nowDateStr(), createdAt: Date.now() });
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => switchTab('leaderboard'));
  await page.waitForTimeout(500);

  // Gracey 130 + 20 + 30 = 180, Monk 72, Gracey 应该 #1
  const podium = await page.locator('#lbPodium').textContent();
  expect(podium).toContain('180');
  expect(podium).toContain('Gracey');
});
