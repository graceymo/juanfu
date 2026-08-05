// 验证 3 个新功能：
// 1) 平板支撑/侧平板/靠墙静蹲/V字支撑/悬挂举腿/健腹轮 → 个数切换为"分钟"单字段
// 2) 本周积分 = 本周所有 records 的 points 实时求和（拉齐记录板块本周 tab）
// 3) 今日状态右上角显示"今日净积分"

import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

function makeRecord(type, fields = {}) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const base = {
    id: 'r' + Math.random().toString(36).slice(2, 9),
    type, points: 18, photo: false, shared: false, feedText: '',
    date: today, time: '10:00', createdAt: now.getTime()
  };
  return { ...base, ...fields };
}

function makeState(records = []) {
  return {
    onboardingDone: true,
    unlocked: true,
    nick: 'Gracey', emoji: '🐙',
    circles: [
      {
        id: 'preset-1', name: '八组卷王', role: 'leader', code: 'AAA', members: 2, pending: false,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: 0, isMe: true, isLeader: true },
          { emoji: '🦊', name: 'Monk', score: 80, isMe: false, isLeader: false }
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

async function openDailyModalWithExercise(page, exercise) {
  await page.evaluate((ex) => {
    _dailyForm = { group: '核心/腹部', exercise: ex, reps: 30, sets: 3, date: nowDateStr(), time: nowHHMM(), photo: false, photoData: null };
    _editingRecordId = null;
    document.getElementById('recordModal').classList.add('show');
    document.getElementById('recordModal').dataset.type = 'daily';
    document.getElementById('modalTitle').textContent = '日常运动';
    document.getElementById('modalBody').innerHTML = dailyBody();
  }, exercise);
  await page.waitForTimeout(200);
}

// ============== 修复 1：平板支撑/等长收缩 → 分钟 ==============
test('修复1: 平板支撑表单切到单字段"时长（分钟）"，没有"个数/组数"', async ({ page }) => {
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState());
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await openDailyModalWithExercise(page, '平板支撑');

  // 标题应该出现"等长收缩"提示
  const labels = await page.locator('#modalBody .form-label').allTextContents();
  expect(labels.some(l => l.includes('分钟'))).toBe(true);
  // 不应再有"个数"和"组数"标签
  expect(labels.some(l => l.includes('个数'))).toBe(false);
  expect(labels.some(l => l.includes('组数'))).toBe(false);
});

test('修复1b: 平板支撑积分按"分钟 × ptsPerRep"算（0.6 × 3 = 2 → round 2）', async ({ page }) => {
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState());
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await openDailyModalWithExercise(page, '平板支撑');
  // 把 minutes 改成 3
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('#modalBody input[type="number"]');
    inputs[0].value = '3';
    updateDailySets('3');
  });
  await page.waitForTimeout(200);
  const ptsText = await page.locator('#modalBody .pi-value').textContent();
  // 0.6 × 3 = 1.8 → round 2
  expect(ptsText).toMatch(/\+2 分/);
});

test('修复1c: 等长收缩动作保存后 reps=null，列表显示 "3min" 而不是 "null×3"', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rec = makeRecord('daily', {
    group: '核心/腹部', exercise: '平板支撑', reps: null, sets: 3, points: 2, date: today
  });
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState([rec]));
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => switchTab('record'));
  await page.waitForTimeout(500);
  const meta = await page.locator('#recordDailyList .record-row-clickable .stat-meta').first().textContent();
  // 不应包含 "null×3"，应包含 "3min" 或 "3 分钟"
  expect(meta).not.toContain('null');
  expect(meta).toMatch(/3 ?min/);
});

test('修复1d: 非等长收缩动作（深蹲）保持"个数+组数"双字段', async ({ page }) => {
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState());
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await openDailyModalWithExercise(page, '深蹲');

  const labels = await page.locator('#modalBody .form-label').allTextContents();
  expect(labels).toContain('个数');
  expect(labels).toContain('组数');
  expect(labels.some(l => l.includes('时长（分钟）'))).toBe(false);
});

// ============== 修复 2：本周积分 = records 求和（与记录板块同源） ==============
test('修复2: 本周积分 = 本周 records 求和（不走累加器）', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  // 构造本周 3 条 records：+18（运动）+ 77（专项）- 5（垃圾食品）= 90
  // appState.weeklyPoints 故意设错成 9999（验证仪表盘从 records 派生，不被累加器覆盖）
  const recs = [
    makeRecord('daily', { group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18, date: today }),
    makeRecord('special', { category: '攀岩', sport: '室内难度', minutes: 90, points: 77, date: today }),
    makeRecord('diet', { food: '奶茶', qty: 1, points: -5, date: today })
  ];
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, { ...makeState(recs), weeklyPoints: 9999 });
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(500);

  const weeklyText = await page.locator('#weeklyPoints').textContent();
  // 仪表盘从 records 派生（不被累加器 9999 覆盖）：18+77-5 = 90
  expect(weeklyText).toBe('90');
  // 同时 #quarterPoints 也从 records 派生 = 90
  const qPtsText = await page.locator('#quarterPoints').textContent();
  expect(weeklyText).toBe(qPtsText);
});

test('修复2b: 本周积分 = 0 时显示 0；提交新 record 后 weeklyPoints 累加 +points', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState());
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(() => switchTab('dashboard'));
  await page.waitForTimeout(300);

  // 初始无记录 → 0
  expect(await page.locator('#weeklyPoints').textContent()).toBe('0');

  // 走 finalizeSubmit 添加一条 record（模拟真实提交，weeklyPoints 应自动累加）
  await page.evaluate(() => {
    finalizeSubmit({
      id: 'r-1', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18,
      date: nowDateStr(), time: '10:00', createdAt: Date.now(),
      photo: false, photoData: null, shared: false, feedText: ''
    });
  });
  await page.waitForTimeout(300);
  // 18
  expect(await page.locator('#weeklyPoints').textContent()).toBe('18');
});

// ============== 修复 3：今日净积分右上角 ==============
test('修复3: 今日净积分显示在"今日状态"卡片标题右上角', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const recs = [
    makeRecord('daily', { group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18, date: today }),
    makeRecord('diet', { food: '炸鸡', qty: 1, points: -5, date: today })
  ];
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState(recs));
  await page.goto(BASE);
  await page.waitForTimeout(500);

  const text = await page.locator('#todayNetPoints').textContent();
  expect(text).toContain('今日净积分');
  // 18 - 5 = 13（绿色 +）
  expect(text).toContain('+13');
});

test('修复3b: 今日净积分 = 0 时显示 "±0"（灰色）', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const recs = [
    makeRecord('diet', { food: '炸鸡', qty: 1, points: -5, date: today }),
    makeRecord('diet', { food: '奶茶', qty: 1, points: 5, date: today })
  ];
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState(recs));
  await page.goto(BASE);
  await page.waitForTimeout(500);

  const text = await page.locator('#todayNetPoints').textContent();
  expect(text).toContain('±0');
});

test('修复3c: 今日净积分编辑日期从今天改到昨天 → 自动从右上角消失（=0）', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const recs = [
    makeRecord('daily', { group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18, date: today, time: '10:00' })
  ];
  await page.addInitScript((data) => { localStorage.setItem('juanfu_user', JSON.stringify(data)); }, makeState(recs));
  await page.goto(BASE);
  await page.waitForTimeout(500);

  // 初始 +18
  expect(await page.locator('#todayNetPoints').textContent()).toContain('+18');

  // 改到昨天
  await page.evaluate((data) => {
    appState.todayRecords[0].date = data.date;
    appState.todayRecords[0].time = '10:00';
    appState.todayRecords[0].createdAt = new Date(data.date + ' 10:00:00').getTime();
    refreshDashboard();
  }, { date: yesterdayDate });
  await page.waitForTimeout(300);

  // 变 ±0
  expect(await page.locator('#todayNetPoints').textContent()).toContain('±0');
});
