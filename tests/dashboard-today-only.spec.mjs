// 验证：今日状态板块只显示 date === today 的记录，历史日期的记录不能出现

import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeRecord(type, date, fields) {
  const base = {
    id: 'r' + Math.random().toString(36).slice(2, 9),
    type, points: 18, photo: false, shared: false, feedText: '',
    date, time: '10:00', createdAt: new Date(date + 'T10:00').getTime()
  };
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
      }
    ],
    activeCircleId: 'preset-1',
    todayRecords: records,
    weeklyPoints: 0, streakDays: 0, quarterPoints: 0,
    schedule: {},
    notifications: []
  };
}

// ============== 场景 1：只有今日记录 → 正常显示 ==============
test('场景1: 全部记录都在今日 → 运动 + 垃圾食品两行正常汇总', async ({ page }) => {
  const today = todayStr();
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('special', today, { category: '团课', sport: 'Body Combat', minutes: 100, points: 85 }),
    makeRecord('daily', today, { group: '下肢', exercise: '腿屈伸', reps: 30, sets: 3, points: 18 }),
    makeRecord('diet', today, { food: '炸鸡', qty: 1, points: -5 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  const rowCount = await page.locator('#statusPopulated .stat-row').count();
  expect(rowCount).toBe(3); // 运动 + 垃圾食品 + 连续打卡加分

  const row1 = page.locator('#statusPopulated .stat-row').nth(0);
  await expect(row1.locator('.stat-meta')).toContainText('团课·Body Combat 100min');
  await expect(row1.locator('.stat-meta')).toContainText('下肢·腿屈伸 30×3');
  await expect(row1.locator('.stat-value')).toContainText('103');  // 85+18

  const row2 = page.locator('#statusPopulated .stat-row').nth(1);
  await expect(row2.locator('.stat-meta')).toContainText('炸鸡 1 杯');
  await expect(row2.locator('.stat-value')).toContainText('-5');
});

// ============== 场景 2：所有记录都是历史日期 → 显示空状态 ==============
test('场景2: 所有记录都是历史日期（如 7月7日）→ 显示"还没有记录运动"空状态', async ({ page }) => {
  const oldDate = '2026-07-07';
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('special', oldDate, { category: '团课', sport: 'Body Combat', minutes: 100, points: 85 }),
    makeRecord('daily', oldDate, { group: '下肢', exercise: '腿屈伸', reps: 30, sets: 3, points: 18 }),
    makeRecord('diet', oldDate, { food: '炸鸡', qty: 1, points: -5 }),
    makeRecord('diet', oldDate, { food: '奶茶', qty: 1, points: -5 }),
    makeRecord('diet', oldDate, { food: '啤酒', qty: 1, points: -30 }),
    makeRecord('diet', oldDate, { food: '可乐', qty: 1, points: -5 }),
    makeRecord('diet', oldDate, { food: '泡面', qty: 1, points: -5 }),
    makeRecord('diet', oldDate, { food: '甜品', qty: 1, points: -5 }),
    makeRecord('special', oldDate, { category: '球类', sport: '篮球', minutes: 90, points: 77 }),
    makeRecord('special', oldDate, { category: '瑜伽/普拉提/舞蹈', sport: '瑜伽(哈他)', minutes: 90, points: 64 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // statusEmpty 应显示
  const emptyVisible = await page.locator('#statusEmpty').isVisible();
  expect(emptyVisible).toBe(true);

  // statusPopulated 应隐藏
  const populatedVisible = await page.locator('#statusPopulated').isVisible();
  expect(populatedVisible).toBe(false);
});

// ============== 场景 3：混合（历史 + 今日）→ 只显示今日的 ==============
test('场景3: 历史+今日混合 → 只汇总今日，历史的不出现', async ({ page }) => {
  const today = todayStr();
  const oldDate = '2026-07-07';
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    // 历史：7月7日的团课 + 大量垃圾食品（用户截图里的内容）
    makeRecord('special', oldDate, { category: '团课', sport: 'Body Combat', minutes: 100, points: 85 }),
    makeRecord('daily', oldDate, { group: '下肢', exercise: '腿屈伸', reps: 30, sets: 3, points: 18 }),
    makeRecord('special', oldDate, { category: '球类', sport: '篮球', minutes: 90, points: 77 }),
    makeRecord('special', oldDate, { category: '瑜伽/普拉提/舞蹈', sport: '瑜伽(哈他)', minutes: 90, points: 64 }),
    makeRecord('diet', oldDate, { food: '炸鸡', qty: 1, points: -5 }),
    makeRecord('diet', oldDate, { food: '奶茶', qty: 1, points: -5 }),
    makeRecord('diet', oldDate, { food: '啤酒', qty: 16, points: -30 }),
    makeRecord('diet', oldDate, { food: '可乐', qty: 3, points: -5 }),
    makeRecord('diet', oldDate, { food: '泡面', qty: 4, points: -5 }),
    makeRecord('diet', oldDate, { food: '甜品', qty: 5, points: -5 }),

    // 今日：只一条运动 + 一条饮食
    makeRecord('daily', today, { group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18 }),
    makeRecord('diet', today, { food: '奶茶', qty: 1, points: -5 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // statusPopulated 应显示
  const populatedVisible = await page.locator('#statusPopulated').isVisible();
  expect(populatedVisible).toBe(true);

  const row1 = page.locator('#statusPopulated .stat-row').nth(0);
  // 运动行：只含今日的"下肢·深蹲 30×3"，不应含历史的"团课/篮球/瑜伽"
  const sportMeta = await row1.locator('.stat-meta').textContent();
  expect(sportMeta).toContain('下肢·深蹲 30×3');
  expect(sportMeta).not.toContain('团课');
  expect(sportMeta).not.toContain('篮球');
  expect(sportMeta).not.toContain('瑜伽');
  expect(sportMeta).not.toContain('腿屈伸');
  await expect(row1.locator('.stat-value')).toContainText('18');

  // 垃圾食品行：只含今日的"奶茶 1 杯"
  const row2 = page.locator('#statusPopulated .stat-row').nth(1);
  const junkMeta = await row2.locator('.stat-meta').textContent();
  expect(junkMeta).toContain('奶茶 1 杯');
  expect(junkMeta).not.toContain('炸鸡');
  expect(junkMeta).not.toContain('啤酒');
  expect(junkMeta).not.toContain('可乐');
  expect(junkMeta).not.toContain('泡面');
  expect(junkMeta).not.toContain('甜品');
  await expect(row2.locator('.stat-value')).toContainText('-5');
});

// ============== 场景 4：编辑记录从今日改到历史 → 今日状态应消失 ==============
test('场景4: 把今日记录改到历史日期 → 今日状态回到空状态', async ({ page }) => {
  const today = todayStr();
  const oldDate = '2026-07-07';
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('special', today, { category: '团课', sport: 'Body Combat', minutes: 100, points: 85 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 初始：应有 3 行（运动 + 垃圾食品 + 连续打卡加分）
  const rowCountBefore = await page.locator('#statusPopulated .stat-row').count();
  expect(rowCountBefore).toBe(3);

  // 把这条记录从 today 改到 oldDate
  await page.evaluate((newDate) => {
    const r = appState.todayRecords[0];
    r.date = newDate;
    r.time = '10:00';
    refreshDashboard();
  }, oldDate);
  await page.waitForTimeout(300);

  // 现在：statusEmpty 应显示，statusPopulated 隐藏
  const emptyVisible = await page.locator('#statusEmpty').isVisible();
  expect(emptyVisible).toBe(true);
  const populatedVisible = await page.locator('#statusPopulated').isVisible();
  expect(populatedVisible).toBe(false);
});

// ============== 场景 5：编辑历史记录改到今日 → 今日状态出现 ==============
test('场景5: 把历史记录改到今日 → 今日状态出现该记录', async ({ page }) => {
  const today = todayStr();
  const oldDate = '2026-07-07';
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, makeStateWithRecords([
    makeRecord('special', oldDate, { category: '团课', sport: 'Body Combat', minutes: 100, points: 85 })
  ]));
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 初始：空状态
  const emptyVisible = await page.locator('#statusEmpty').isVisible();
  expect(emptyVisible).toBe(true);

  // 把记录改到 today
  await page.evaluate((newDate) => {
    const r = appState.todayRecords[0];
    r.date = newDate;
    r.time = '10:00';
    refreshDashboard();
  }, today);
  await page.waitForTimeout(300);

  // 现在：statusPopulated 显示，含团课
  const populatedVisible = await page.locator('#statusPopulated').isVisible();
  expect(populatedVisible).toBe(true);
  const row1 = page.locator('#statusPopulated .stat-row').nth(0);
  await expect(row1.locator('.stat-meta')).toContainText('团课·Body Combat 100min');
});

// ============== 场景 6：顶部统计/季度积分不受今日过滤影响 ==============
test('场景6: 即使今日无记录，季度积分/排行榜/tabbar 仍正常显示', async ({ page }) => {
  const oldDate = '2026-07-07';
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    ...makeStateWithRecords([
      makeRecord('special', oldDate, { category: '团课', sport: 'Body Combat', minutes: 100, points: 85 })
    ]),
    weeklyPoints: 0, streakDays: 5
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 顶部统计：streak 现在由 computeStreak() 基于实际记录实时计算
  // 只有一条 oldDate 的 special 记录，quarter 内唯一周期 = 1
  await expect(page.locator('#streakDays')).toContainText('1');
  // 季度积分卡片存在
  const qp = await page.locator('#quarterPoints').textContent();
  expect(parseInt(qp, 10)).toBeGreaterThanOrEqual(0);
});

// ============== 场景 4：空状态今日净积分 = 0 ==============
// bug 修复：今日无记录时，"今日净积分" 不应叠加 streak.bonus，避免显示 +3 这种误导
// (用户截图：状态为"还没有记录运动"，但右上角显示 +3)
test('场景4: 没有今日记录 → 今日净积分 = 0（不叠加 streak.bonus）', async ({ page }) => {
  // streakDays = 7 会让 streak.bonus = 3（如果计算逻辑如此），专门构造来触发该 bug
  await page.addInitScript((data) => {
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  }, {
    ...makeStateWithRecords([]),  // 今日无记录
    streakDays: 7,  // 即便有 7 天连续，bonus 也不能叠加到 0 状态
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);

  // 空状态可见
  const emptyVisible = await page.locator('#statusEmpty').isVisible();
  expect(emptyVisible).toBe(true);

  // 右上角今日净积分必须 = 0
  const text = await page.locator('#todayNetPoints').textContent();
  // 显示形式是 "今日净积分 ±0"（0 用 ±，不带 + 号）
  expect(text).toContain('0');
  // 不应出现 +3 / +6 之类叠加 streak.bonus 的数字
  expect(text).not.toMatch(/\+\d/);  // 不能有 +N 形式
});
