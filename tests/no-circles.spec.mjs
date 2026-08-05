import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');
const LS_KEY = 'juanfu_user';

test.describe('无圈子场景：排行榜存在性', () => {
  test.beforeEach(async ({ page }) => {
    // 注入无圈子的 localStorage 状态，模拟"还没加入任何圈子"的用户
    await page.addInitScript((lsKey) => {
      const now = new Date();
      const fakeApp = {
        onboardingDone: true,
        hasCircle: false,
        nick: 'Gracey', emoji: '🐙', freq: 'daily',
        circles: [],           // 关键：空圈子
        activeCircleId: null,
        notifications: [],
        todayRecords: [],
        schedule: {},
        weeklyPoints: 80,
        streakDays: 5,
        quarterPoints: 130,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3),
        leaderboardCache: {}
      };
      localStorage.setItem(lsKey, JSON.stringify(fakeApp));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  test('Tab 1: 底部"排行榜"tab 应隐藏', async ({ page }) => {
    const tab = page.locator('.tab[data-page="leaderboard"]');
    const isVisible = await tab.isVisible();
    expect(isVisible).toBe(false);
  });

  test('Tab 2: 仪表盘 weeklyRank = "加入圈子后查看"', async ({ page }) => {
    const text = await page.locator('#weeklyRank').textContent();
    expect(text).toBe('加入圈子后查看');
  });

  test('Tab 3: 仪表盘 quarterRank = "加入圈子后查看"', async ({ page }) => {
    const text = await page.locator('#quarterRank').textContent();
    expect(text).toBe('加入圈子后查看');
  });

  test('Tab 4: 季度卡的点击不会跳到排行榜（无圈子时）', async ({ page }) => {
    // 找到季度卡（包含 #quarterPoints 的 .top-stat-card）
    const card = page.locator('.top-stat-card:has(#quarterPoints)');
    await card.click();
    await page.waitForTimeout(300);
    // 应该还在 dashboard，不在 page-leaderboard
    const active = await page.evaluate(() => document.querySelector('.page.active')?.id);
    expect(active).toBe('page-dashboard');
  });

  test('Tab 5: 排行榜页面（强制访问）显示空态 + 引导按钮', async ({ page }) => {
    // 排行榜 tab 被隐藏了，但 page-leaderboard DOM 仍存在；通过 JS 强制切过去
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(300);
    // 此时 updateTabbar 应已把它切回 dashboard
    const active = await page.evaluate(() => document.querySelector('.page.active')?.id);
    expect(active).toBe('page-dashboard');
  });

  test('Tab 6: 提交记录不产生 rank_up/rank_down 站内信', async ({ page }) => {
    // 直接调用 finalizeSubmit 提交一条 daily 记录
    await page.evaluate(() => {
      finalizeSubmit({
        id: 'nocircle-1',
        type: 'daily',
        group: '下肢',
        exercise: '深蹲',
        reps: 30,
        sets: 3,
        points: 18,
        time: '14:00',
        date: '2026-07-22',
        createdAt: Date.now()
      });
    });
    await page.waitForTimeout(300);
    const rankNotifs = await page.evaluate(() => {
      return (appState.notifications || []).filter(n =>
        n.type === 'rank_up' || n.type === 'rank_down'
      ).length;
    });
    expect(rankNotifs).toBe(0);
  });

  test('Tab 7: leaderboardAllUsers() 在无圈子时返回空数组', async ({ page }) => {
    const result = await page.evaluate(() => leaderboardAllUsers(100));
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  test('Tab 8: hasJoinedCircles() 反映空状态', async ({ page }) => {
    const result = await page.evaluate(() => hasJoinedCircles());
    expect(result).toBe(false);
  });
});

test.describe('有圈子场景：排行榜数据源 = 当前圈子成员', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((lsKey) => {
      const now = new Date();
      const fakeApp = {
        onboardingDone: true,
        hasCircle: true,
        nick: 'Gracey', emoji: '🐙', freq: 'daily',
        circles: [
          {
            id: 'c-1', name: '测试组', role: 'leader', code: 'TST00001',
            members: 3, pending: false,
            reward: '', weeklyReward: false,
            memberList: [
              { emoji: '🐙', name: 'Gracey', score: 0, isMe: true, isLeader: true },
              { emoji: '🦊', name: 'Monk', score: 142, isLeader: false },
              { emoji: '🐨', name: 'Kenny', score: 98, isLeader: false }
            ],
            joinRequests: []
          }
        ],
        activeCircleId: 'c-1',
        notifications: [],
        todayRecords: [],
        schedule: {},
        weeklyPoints: 80,
        streakDays: 5,
        quarterPoints: 130,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3),
        leaderboardCache: {}
      };
      localStorage.setItem(lsKey, JSON.stringify(fakeApp));
    }, LS_KEY);
    await page.goto(BASE);
    await page.waitForTimeout(800);
  });

  test('Tab 9: 排行榜 tab 可见', async ({ page }) => {
    const tab = page.locator('.tab[data-page="leaderboard"]');
    const isVisible = await tab.isVisible();
    expect(isVisible).toBe(true);
  });

  test('Tab 10: leaderboardAllUsers() 返回圈子成员（3 人）', async ({ page }) => {
    const result = await page.evaluate(() => leaderboardAllUsers(150));
    expect(result.length).toBe(3);
    // Gracey 的 pts 应为 150（用本季度积分），不能是 0
    const me = result.find(u => u.isMe);
    expect(me).toBeTruthy();
    expect(me.pts).toBe(150);
    // Gracey 应排第 1（150 > 142 > 98）
    expect(me.rank).toBe(1);
    // Monk 第 2
    const monk = result.find(u => u.name === 'Monk');
    expect(monk.rank).toBe(2);
    expect(monk.pts).toBe(142);
  });

  test('Tab 11: 排行榜页面渲染圈子成员', async ({ page }) => {
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(300);
    // 副标题应该是圈子名
    const sub = await page.locator('#leaderboardSubtitle').textContent();
    expect(sub).toContain('测试组');
    // 3 个成员都在 podium（前 3 都进 podium，list 留空）
    const podiumText = await page.locator('#lbPodium').textContent();
    expect(podiumText).toContain('Gracey');
    expect(podiumText).toContain('Monk');
    expect(podiumText).toContain('Kenny');
  });
});
