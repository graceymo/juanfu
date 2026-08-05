// 排行榜趋势（lb-trend）行为测试
// 关键不变量：末位（rank = 总人数）只能显示持平（—）或下降（▼），不可能显示上升（▲）
// 原因：末位已是最大排名数字，"上升"要求 current < previous，但 current = max 不可能 < previous

import { test, expect } from '@playwright/test';
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

const fmtLocal = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

// 构造 4 人圈子，Gracey 分数来自 records 求和（用 getWeekPointsFromRecords）
const makeRecords = (totalPoints) => [{
  id: 'r-trend', type: 'special', sport: '攀岩', minutes: 60,
  points: totalPoints, time: '10:00', date: fmtLocal(new Date()), createdAt: Date.now() - 1000
}];

const makeFourMemberState = (graceyPts = 130) => ({
  onboardingDone: true, hasCircle: true,
  nick: 'Gracey', emoji: '🐙', freq: 'daily',
  circles: [{
    id: 'c-trend', name: '趋势测试圈', role: 'leader', code: 'TRD00001',
    members: 4, pending: false, reward: '', weeklyReward: false,
    memberList: [
      { emoji: '🐙', name: 'Gracey', score: graceyPts, isMe: true,  isLeader: true,  joinDate: '2026-W21' },
      { emoji: '🦊', name: 'Monk',   score: 100, isMe: false, isLeader: false, joinDate: '2026-W21' },
      { emoji: '🐱', name: 'Lulu',   score: 80,  isMe: false, isLeader: false, joinDate: '2026-W21' },
      { emoji: '🐨', name: 'Kenny',  score: 60,  isMe: false, isLeader: false, joinDate: '2026-W21' }
    ],
    joinRequests: [],
    weeklyChampions: []
  }],
  activeCircleId: 'c-trend',
  notifications: [],
  todayRecords: makeRecords(graceyPts),
  schedule: {},
  weeklyPoints: graceyPts,
  streakDays: 0, streakBonus: 0,
  quarterPoints: 0,
  quarterKey: new Date().getFullYear() + 'Q' + Math.ceil((new Date().getMonth() + 1) / 3),
  weekKey: wKeyOf(),
  rankAtLastEvent: { 'c-trend': { Gracey: 1, Monk: 2, Lulu: 3, Kenny: 4 } }
});

// 读取排行榜 list 区域（.lb-row）某成员的 trend/rank
const readMemberTrend = async (page, name) => {
  return await page.evaluate((n) => {
    const rows = Array.from(document.querySelectorAll('.lb-row'));
    const row = rows.find(r => r.querySelector('.lb-name')?.textContent?.startsWith(n));
    if (!row) return null;
    const trend = row.querySelector('.lb-trend');
    return {
      cls: trend?.className,
      text: trend?.textContent?.trim(),
      rank: row.querySelector('.lb-rank')?.textContent?.trim()
    };
  }, name);
};

// 读取排行榜所有 list 成员
const readAllListMembers = async (page) => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.lb-row')).map(row => ({
      name: row.querySelector('.lb-name')?.textContent?.replace(' (我)', '').trim(),
      rank: row.querySelector('.lb-rank')?.textContent?.trim(),
      cls: row.querySelector('.lb-trend')?.className,
      text: row.querySelector('.lb-trend')?.textContent?.trim()
    }));
  });
};

test.describe('排行榜趋势（lb-trend）', () => {
  test('① 末位 Kenny 永远不显示 ▲（关键不变量）', async ({ page }) => {
    // Kenny 一直第 4，基线也是 4，无任何变化 → 应显示持平
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, makeFourMemberState());
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    const kenny = await readMemberTrend(page, 'Kenny');
    expect(kenny).not.toBeNull();
    expect(kenny.rank).toBe('4');
    // 末位 Kenny 不可能显示 ▲（mock bug 的核心）
    expect(kenny.cls).not.toContain('up');
    expect(kenny.text).not.toMatch(/▲/);
    // 应该是持平
    expect(kenny.cls).toContain('flat');
  });

  test('② Kenny 被推到第 5 时显示 ▼（下降）', async ({ page }) => {
    // 4 人 → 加 Tom 0 分 → Kenny 60 > Tom 0 → Kenny 还是第 4
    // 改：加 Tom 150 分（> Kenny 60）→ Kenny 被推到第 5（末位）
    const state = makeFourMemberState();
    state.rankAtLastEvent = { 'c-trend': { Gracey: 1, Monk: 2, Lulu: 3, Kenny: 4 } };
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, state);
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // captureRankSnapshot BEFORE + 加 Tom 150 分
    await page.evaluate(() => {
      captureRankSnapshot('c-trend');
      appState.circles[0].memberList.push({
        emoji: '🐯', name: 'Tom', score: 150, isMe: false, isLeader: false, joinDate: '2026-W30'
      });
      refreshDashboard();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // 新排名：Gracey 130 (1) / Tom 150 (1) 并列？sort 不稳定
    // 用分高的 Tom 第 1：Tom 150 / Gracey 130 / Monk 100 / Lulu 80 / Kenny 60
    // Kenny 之前第 4，现在第 5 → ▼1
    const kenny = await readMemberTrend(page, 'Kenny');
    expect(kenny).not.toBeNull();
    expect(kenny.rank).toBe('5');
    expect(kenny.cls).toContain('down');
    expect(kenny.text).toMatch(/▼/);
    expect(kenny.text).toContain('1');
  });

  test('②b 末位永远不可能 ▲（不变量强化测试）', async ({ page }) => {
    // 构造一个让 Kenny 升到非末位的场景，验证原本的"末位" Lulu 不会 ▲
    const state = makeFourMemberState();
    state.rankAtLastEvent = { 'c-trend': { Gracey: 1, Monk: 2, Lulu: 3, Kenny: 4 } };
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, state);
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // Kenny 升到 200（从 60 升），变成第 1
    // 原排名 1/2/3/4 → 新排名：Kenny 1 / Gracey 2 / Monk 3 / Lulu 4
    // Lulu 之前第 3，现在第 4 → ▼1（被 Kenny 反超）
    await page.evaluate(() => {
      captureRankSnapshot('c-trend');
      appState.circles[0].memberList[3].score = 200; // Kenny
      refreshDashboard();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // 现在 Lulu 是末位（第 4）
    const lulu = await readMemberTrend(page, 'Lulu');
    expect(lulu).not.toBeNull();
    expect(lulu.rank).toBe('4');
    // Lulu 是末位，不可能 ▲
    expect(lulu.cls).not.toContain('up');
    // Lulu 之前第 3，现在第 4，应显示 ▼
    expect(lulu.cls).toContain('down');
  });

  test('③ 无 baseline 时显示 —（持平）', async ({ page }) => {
    const state = makeFourMemberState();
    state.rankAtLastEvent = {}; // 全新用户
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, state);
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    const kenny = await readMemberTrend(page, 'Kenny');
    expect(kenny.rank).toBe('4');
    expect(kenny.cls).toContain('flat');
    expect(kenny.text).toMatch(/—/);
  });

  test('④ 周重置后排名不变时所有趋势仍是持平', async ({ page }) => {
    // 模拟跨周：weekKey 设为上周。但 records 仍在本周，所以 Gracey 分数不变
    // 其他成员（Monk/Lulu/Kenny）的 memberList.score 也不变
    // 结果：所有排名不变，趋势都是持平（关键不变量：末位 Kenny 不会因为跨周就随机变 ▲）
    const state = makeFourMemberState();
    state.rankAtLastEvent = { 'c-trend': { Gracey: 1, Monk: 2, Lulu: 3, Kenny: 4 } };
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    state.weekKey = wKeyOf(lastWeek);
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, state);
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // 跨周后 Kenny 仍是第 4
    const kenny = await readMemberTrend(page, 'Kenny');
    expect(kenny).not.toBeNull();
    expect(kenny.rank).toBe('4');
    // 末位 Kenny 跨周后仍是持平（不会随机变 ▲）
    expect(kenny.cls).toContain('flat');
    expect(kenny.cls).not.toContain('up');
  });

  test('⑤ 跨圈子趋势互不影响（每个圈子独立 baseline）', async ({ page }) => {
    // c-trend: 4 成员（Gracey 130, Monk 100, Lulu 80, Kenny 60）
    // c-other: 4 成员（Rabbit 80, Doggy 30, Panda 20, Gracey 0）
    const state = makeFourMemberState();
    state.circles.push({
      id: 'c-other', name: '另一个圈子', role: 'member', code: 'OTH00002',
      members: 4, pending: false, reward: '', weeklyReward: false,
      memberList: [
        { emoji: '🐰', name: 'Rabbit', score: 80, isMe: false, isLeader: true,  joinDate: '2026-W21' },
        { emoji: '🐶', name: 'Doggy',  score: 30, isMe: false, isLeader: false, joinDate: '2026-W21' },
        { emoji: '🐼', name: 'Panda',  score: 20, isMe: false, isLeader: false, joinDate: '2026-W21' },
        { emoji: '🐙', name: 'Gracey', score: 0,   isMe: true,  isLeader: false, joinDate: '2026-W22' }
      ],
      joinRequests: [],
      weeklyChampions: []
    });
    // 各自的 baseline
    state.rankAtLastEvent = {
      'c-trend': { Gracey: 1, Monk: 2, Lulu: 3, Kenny: 4 },
      'c-other': { Rabbit: 1, Doggy: 2, Panda: 3, Gracey: 4 }
    };
    state.activeCircleId = 'c-trend';
    await page.addInitScript((data) => {
      localStorage.setItem('juanfu_user', JSON.stringify(data));
    }, state);
    await page.goto(BASE);
    await page.waitForTimeout(800);
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);

    // c-trend 活跃：Kenny 一直在第 4 → 持平
    const kennyA = await readMemberTrend(page, 'Kenny');
    expect(kennyA.rank).toBe('4');
    expect(kennyA.cls).toContain('flat');

    // 切到 c-other
    await page.evaluate(() => switchActiveCircle('c-other'));
    await page.waitForTimeout(500);

    // c-other 里 Gracey 分数从 records 派生 = 130（与 c-trend 共用 records）
    // 所以排名：Gracey 130 (1) / Rabbit 80 (2) / Doggy 30 (3) / Panda 20 (4)
    // Panda 之前第 3，现在第 4 → ▼1（被反超）
    const panda = await readMemberTrend(page, 'Panda');
    expect(panda.rank).toBe('4');
    expect(panda.cls).toContain('down');
    expect(panda.text).toMatch(/▼/);

    // 切回 c-trend，Kenny 仍是末位持平
    await page.evaluate(() => switchActiveCircle('c-trend'));
    await page.waitForTimeout(500);
    const kennyC = await readMemberTrend(page, 'Kenny');
    expect(kennyC.rank).toBe('4');
    expect(kennyC.cls).toContain('flat');
  });
});
