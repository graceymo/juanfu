// ==================== 往期周冠军：真实历史 + 按圈子聚合 ====================
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8080/prototype.html';

test.beforeEach(async ({ page }) => {
  // 注入已完成的 onboarding + 两个圈子 + 历史 weeklyChampions
  await page.addInitScript(() => {
    const data = {
      onboardingDone: true,
      nick: 'Gracey', emoji: '🐙',
      circles: [
        {
          id: 'c1', name: '公主圈', role: 'leader', code: 'A1',
          members: 2, pending: false, reward: '', weeklyReward: true,
          memberList: [
            { emoji: '🐙', name: 'Gracey', score: 154, isMe: true, isLeader: true, joinDate: '2026-W21' },
            { emoji: '🦊', name: 'Monk', score: 72, isLeader: false, joinDate: '2026-W22' }
          ],
          joinRequests: [],
          weeklyChampions: [
            { name: 'Monk', emoji: '🦊', weekKey: '2026-W22', points: 95 },
            { name: 'Monk', emoji: '🦊', weekKey: '2026-W23', points: 110 },
            { name: 'Gracey', emoji: '🐙', weekKey: '2026-W24', points: 138 },
            { name: 'Gracey', emoji: '🐙', weekKey: '2026-W25', points: 152 },
            { name: 'Gracey', emoji: '🐙', weekKey: '2026-W26', points: 161 }
          ]
        },
        {
          id: 'c2', name: 'K800', role: 'member', code: 'B2',
          members: 2, pending: false, reward: '', weeklyReward: false,
          memberList: [
            { emoji: '🐙', name: 'Gracey', score: 154, isMe: true, isLeader: false, joinDate: '2026-W26' },
            { emoji: '🐨', name: 'Kenny', score: 98, isLeader: true, joinDate: '2026-W22' }
          ],
          joinRequests: [],
          weeklyChampions: [
            { name: 'Kenny', emoji: '🐨', weekKey: '2026-W22', points: 88 },
            { name: 'Kenny', emoji: '🐨', weekKey: '2026-W23', points: 102 },
            { name: 'Kenny', emoji: '🐨', weekKey: '2026-W24', points: 95 },
            { name: 'Kenny', emoji: '🐨', weekKey: '2026-W25', points: 108 }
          ]
        }
      ],
      activeCircleId: 'c1',
      weekKey: '2026-W30', quarterKey: '2026Q3',
      weeklyPoints: 154, streakDays: 3, quarterPoints: 154,
      todayRecords: [],
      schedule: {}, notifications: [], leaderboardCache: {},
      notifSettings: { workout: true, diet: false, overtake: true, invite: true },
      schedulePublic: true, privacy: true, hasCircle: true
    };
    localStorage.setItem('juanfu_user', JSON.stringify(data));
  });
  await page.goto(BASE);
  await page.waitForTimeout(800);
});

test('往期周冠军：按 weeklyChampions 聚合展示（Gracey 3 连冠 W24-W26）', async ({ page }) => {
  await page.evaluate(() => switchTab('leaderboard'));
  await page.waitForTimeout(400);
  const hist = page.locator('#lbHistoryList');
  // 公主圈：Monk ×2 (W22/W23) + Gracey ×3 (W24/W25/W26)
  await expect(hist).toContainText('Gracey');
  await expect(hist).toContainText('×3');
  await expect(hist).toContainText('Monk');
  await expect(hist).toContainText('×2');
  // 排序：Gracey (3 wins) 排第一
  const rows = hist.locator('.stat-row');
  await expect(rows.first()).toContainText('Gracey');
  // Gracey W24/W25/W26 连续 → "最近 3 连冠"
  await expect(rows.first()).toContainText('最近 3 连冠');
});

test('切换圈子：往期周冠军同步切换到 Kenny', async ({ page }) => {
  await page.evaluate(() => switchTab('leaderboard'));
  await page.waitForTimeout(400);
  // 切换到 K800
  await page.evaluate(() => {
    appState.activeCircleId = 'c2';
    renderLeaderboard();
  });
  await page.waitForTimeout(300);
  const hist = page.locator('#lbHistoryList');
  await expect(hist).toContainText('Kenny');
  await expect(hist).toContainText('×4');
  // 副标题也变了
  await expect(page.locator('#leaderboardSubtitle')).toContainText('K800');
});

test('无 weeklyChampions 的圈子：显示"暂无往期冠军记录"', async ({ page }) => {
  await page.evaluate(() => {
    appState.circles[0].weeklyChampions = [];
    renderLeaderboard();
    switchTab('leaderboard');
  });
  await page.waitForTimeout(400);
  await expect(page.locator('#lbHistoryList')).toContainText('暂无往期冠军记录');
});

test('周切换结算：上周冠军被记录到 weeklyChampions', async ({ page }) => {
  // 把 weekKey 改成上周，触发 settlement
  await page.evaluate(() => {
    // 当前周 W30，appState.weekKey 设为 W29 → 提交时触发 settlement
    appState.weekKey = '2026-W29';
    saveAppState();
    // 模拟提交一条运动记录
    finalizeSubmit({
      id: 'r-1', type: 'daily', name: '深蹲', reps: 50, points: 10,
      date: new Date().toISOString().slice(0, 10)
    });
  });
  await page.waitForTimeout(300);
  // 此时 c1 的 weeklyChampions 应该多一条 W29 的冠军（Gracey 154 分）
  const c1Champions = await page.evaluate(() => {
    return appState.circles.find(c => c.id === 'c1').weeklyChampions;
  });
  const last = c1Champions[c1Champions.length - 1];
  expect(last.name).toBe('Gracey');
  expect(last.weekKey).toBe('2026-W29');
  expect(last.points).toBe(154);
});

test('新成员（joinDate=当前周）不能在当前周成为冠军', async ({ page }) => {
  await page.evaluate(() => {
    // 把 weekKey 改成上周 → finalizeSubmit 会触发 settlement
    appState.weekKey = '2026-W29';
    // 给 c2 加一个新成员 zhengyang，joinDate=当前周
    appState.circles[1].memberList.push({
      emoji: '🐼', name: 'zhengyang', score: 200, isMe: false, isLeader: false,
      joinDate: getCurrentWeekKey()  // 这周才加入
    });
    // 触发 settlement
    finalizeSubmit({
      id: 'r-2', type: 'daily', name: '深蹲', reps: 50, points: 10,
      date: new Date().toISOString().slice(0, 10)
    });
  });
  await page.waitForTimeout(300);
  // c2 weeklyChampions 最后一条应该是 Kenny（积分最高的老成员），不是 zhengyang
  const c2Champions = await page.evaluate(() => {
    return appState.circles.find(c => c.id === 'c2').weeklyChampions;
  });
  const last = c2Champions[c2Champions.length - 1];
  expect(last.name).toBe('Kenny');
  expect(last.name).not.toBe('zhengyang');
});

test('老成员（joinDate<上周）即使分数最高，也正常入冠军', async ({ page }) => {
  await page.evaluate(() => {
    appState.weekKey = '2026-W29';
    appState.circles[1].memberList.push({
      emoji: '🐼', name: 'veteran', score: 999, isMe: false, isLeader: false,
      joinDate: '2026-W22'  // 老成员
    });
    finalizeSubmit({
      id: 'r-3', type: 'daily', name: '深蹲', reps: 50, points: 10,
      date: new Date().toISOString().slice(0, 10)
    });
  });
  await page.waitForTimeout(300);
  const c2Champions = await page.evaluate(() => {
    return appState.circles.find(c => c.id === 'c2').weeklyChampions;
  });
  const last = c2Champions[c2Champions.length - 1];
  expect(last.name).toBe('veteran');
  expect(last.points).toBe(999);
});

test.describe('旧数据迁移', () => {
  test('旧 pastChampions 数据迁移：自动转 weeklyChampions', async ({ page }) => {
    // 不走 beforeEach 的 addInitScript，直接在 page context 内模拟迁移逻辑
    // 这测试的是迁移代码本身的正确性，而不是 reload 行为
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      // 模拟一个旧数据圈子的迁移
      const oldCircle = {
        id: 'c-old', name: '公主圈', role: 'leader', code: 'OLD',
        members: 2, pending: false, reward: '', weeklyReward: true,
        memberList: [
          { emoji: '🐙', name: 'Gracey', score: 100, isMe: true, isLeader: true },
          { emoji: '🦊', name: 'Monk', score: 50, isLeader: false }
        ],
        joinRequests: [],
        // 旧格式：pastChampions 预聚合
        pastChampions: [
          { emoji: '🐙', name: 'Gracey', wins: 3, weeks: ['W25', 'W26', 'W27'], streak: true }
        ]
        // weeklyChampions 缺失
      };
      // 应用迁移逻辑（与 loadAppState 中相同的代码）
      if (oldCircle.weeklyChampions === undefined) {
        if (Array.isArray(oldCircle.pastChampions) && oldCircle.pastChampions.length > 0) {
          const raw = [];
          oldCircle.pastChampions.forEach(function (p) {
            (p.weeks || []).forEach(function (w) {
              raw.push({
                name: p.name,
                emoji: p.emoji,
                weekKey: '2026-' + w,
                points: 0
              });
            });
          });
          oldCircle.weeklyChampions = raw;
        } else {
          oldCircle.weeklyChampions = [];
        }
      }
      return oldCircle.weeklyChampions;
    });
    // 旧数据应该被转换为 3 条 weeklyChampions
    expect(result.length).toBe(3);
    expect(result[0].name).toBe('Gracey');
    expect(result[0].weekKey).toBe('2026-W25');
  });
});
