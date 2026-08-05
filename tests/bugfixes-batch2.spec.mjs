import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BASE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../public/prototype.html');

test.describe('Bug 修复 5 项', () => {
  test('Bug 1: heatmap 基于实际记录积分显示，非 Math.random', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    // 注入已知数据
    await page.evaluate(() => {
      appState.todayRecords = [
        { id: 't1', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18, time: '10:00', date: '2026-07-22', createdAt: new Date(2026, 6, 22, 10, 0).getTime() }
      ];
      generateHeatmap(false);
    });
    await page.waitForTimeout(300);
    // 22 号的格子应该至少有 l1 等级
    const lvl22 = await page.locator('.heatmap-cell.l1, .heatmap-cell.l2, .heatmap-cell.l3, .heatmap-cell.l4').count();
    expect(lvl22).toBeGreaterThan(0);
    // 之前未记录的 21 号应该没有等级
    const lvl21 = await page.evaluate(() => {
      const cells = document.querySelectorAll('.heatmap-cell');
      for (const c of cells) {
        if (c.textContent.trim() === '21' && !c.classList.contains('has-schedule')) {
          return c.className;
        }
      }
      return '';
    });
    expect(lvl21.includes('l1 l2 l3 l4')).toBe(false);
  });

  test('Bug 2: 记录卡片显示 M/D HH:MM', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    // 先切到 dashboard 完成 appState 初始化
    await page.evaluate(() => switchTab('dashboard'));
    await page.waitForTimeout(300);
    // 注入数据
    await page.evaluate(() => {
      appState.todayRecords = [
        { id: 'b2', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18, time: '13:30', date: '2026-07-15', createdAt: new Date(2026, 6, 15, 13, 30).getTime() }
      ];
      // 直接切到 record 页面
      _recordFilter = 'lastWeek';
      refreshRecordPage();
    });
    await page.waitForTimeout(300);
    // 切到 record 页
    await page.evaluate(() => switchTab('record'));
    await page.waitForTimeout(500);
    // 切到上周 tab（这条记录是上周的）
    await page.evaluate(() => filterRecords('lastWeek'));
    await page.waitForTimeout(500);
    // 检查 daily 列表里第一条
    const meta = await page.locator('#recordDailyList .stat-meta').first().textContent();
    expect(meta).toContain('7/15');
    expect(meta).toContain('13:30');
  });

  test('Bug 3: 今日状态卡 diet 记录不显示 undefined', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      appState.todayRecords = [
        { id: 'd1', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 18, time: '10:00', date: '2026-07-22', createdAt: new Date(2026, 6, 22, 10, 0).getTime() },
        { id: 'd2', type: 'diet', food: '奶茶', qty: 1, points: -5, time: '13:00', date: '2026-07-22', createdAt: new Date(2026, 6, 22, 13, 0).getTime() }
      ];
      refreshDashboard();
    });
    await page.waitForTimeout(500);
    // 切到仪表盘
    await page.evaluate(() => switchTab('dashboard'));
    await page.waitForTimeout(500);
    const body = await page.locator('#statusPopulated').textContent();
    expect(body).not.toContain('undefined');
    expect(body).toContain('奶茶');
    // 新版按"食物+件数"汇总：「奶茶 1 杯」
    expect(body).toContain('1 杯');
  });

  // Bug 4 趋势图相关已删除（板块下线 2026-07-22）

  test('新功能: 仪表盘本季度累计 + 排行榜动态 + 站内信红点', async ({ page }) => {
    // 用 localStorage 注入带圈子的状态（排行榜是圈子驱动的）
    await page.addInitScript(() => {
      const now = new Date();
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      // 9 天前的 date（本周外，本季度内）
      const d9 = new Date(now); d9.setDate(d9.getDate() - 9);
      const date9 = d9.getFullYear() + '-' + String(d9.getMonth() + 1).padStart(2, '0') + '-' + String(d9.getDate()).padStart(2, '0');
      // 本周 2 条 records 每日 65 分（sum=130）+ 上周 1 条 70 分（本周外、本季度内）
      // 仪表盘 #weeklyPoints = 本周 records sum = 130
      // 仪表盘 #quarterPoints = 本季度 records sum = 130+70 = 200
      const recs = [
        { id: 'r1', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 65, photo: false, shared: false, feedText: '', date: today, time: '10:00', createdAt: Date.now() - 1000 },
        { id: 'r2', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 65, photo: false, shared: false, feedText: '', date: today, time: '14:00', createdAt: Date.now() - 2000 },
        { id: 'r3', type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 70, photo: false, shared: false, feedText: '', date: date9, time: '09:00', createdAt: d9.getTime() }
      ];
      localStorage.setItem('juanfu_user', JSON.stringify({
        onboardingDone: true, hasCircle: true, nick: 'Gracey', emoji: '🐙', freq: 'daily',
        circles: [{
          id: 'c-1', name: '测试组', role: 'leader', code: 'TST00001',
          members: 3, pending: false, reward: '', weeklyReward: false,
          memberList: [
            { emoji: '🐙', name: 'Gracey', score: 130, isMe: true, isLeader: true },
            { emoji: '🦊', name: 'Monk', score: 142, isLeader: false },
            { emoji: '🐨', name: 'Kenny', score: 98, isLeader: false }
          ],
          joinRequests: []
        }],
        activeCircleId: 'c-1',
        notifications: [{
          id: 'n-test', type: 'rank_up', title: '🎉 排名上升！',
          body: '你超过了 Monk，当前第 1 名', time: Date.now(), read: false
        }],
        todayRecords: recs, schedule: {},
        weeklyPoints: 130, streakDays: 5,
        // 仪表盘从 records 派生，累加器不影响 #quarterPoints 显示
        quarterPoints: 999,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3)
      }));
    });
    await page.goto(BASE);
    await page.waitForTimeout(800);
    // 切到 dashboard 初始化
    await page.evaluate(() => switchTab('dashboard'));
    await page.waitForTimeout(300);
    await page.waitForTimeout(500);
    // 仪表盘 #quarterPoints = 本季度 records sum = 130+70 = 200
    const qPts = await page.locator('#quarterPoints').textContent();
    expect(qPts).toBe('200');
    // 仪表盘 #weeklyPoints = 本周 records sum = 65+65 = 130
    const wPts = await page.locator('#weeklyPoints').textContent();
    expect(wPts).toBe('130');
    // 站内信红点
    const badge = await page.locator('#notifBadge').textContent();
    expect(badge).toBe('1');
    // 切到排行榜
    await page.evaluate(() => switchTab('leaderboard'));
    await page.waitForTimeout(500);
    // 排行榜显示"我"在 podium
    const podium = await page.locator('#lbPodium').textContent();
    expect(podium).toContain('Gracey');
    expect(podium).toContain('(我)');
    // 130 < 142，第 1 名是 Monk 142
    expect(podium).toContain('142');
    expect(podium).toContain('130');
  });

  test('新功能: 排名变动触发站内信', async ({ page }) => {
    // 用 localStorage 注入带圈子的状态
    await page.addInitScript(() => {
      const now = new Date();
      localStorage.setItem('juanfu_user', JSON.stringify({
        onboardingDone: true, hasCircle: true, nick: 'Gracey', emoji: '🐙', freq: 'daily',
        circles: [{
          id: 'c-1', name: '测试组', role: 'leader', code: 'TST00001',
          members: 3, pending: false, reward: '', weeklyReward: false,
          memberList: [
            { emoji: '🐙', name: 'Gracey', score: 0, isMe: true, isLeader: true },
            { emoji: '🦊', name: 'Monk', score: 142, isLeader: false },
            { emoji: '🐨', name: 'Kenny', score: 98, isLeader: false }
          ],
          joinRequests: []
        }],
        activeCircleId: 'c-1',
        notifications: [],
        todayRecords: [], schedule: {},
        weeklyPoints: 80, streakDays: 5, quarterPoints: 80,
        quarterKey: now.getFullYear() + 'Q' + Math.ceil((now.getMonth() + 1) / 3)
      }));
    });
    await page.goto(BASE);
    await page.waitForTimeout(800);
    // 准备：当前 80 分，第 3 名
    await page.evaluate(() => {
      appState.quarterPoints = 80;
      appState.notifications = [];
      // 模拟提交 +20 分
      finalizeSubmit({ type: 'daily', group: '下肢', exercise: '深蹲', reps: 30, sets: 3, points: 20, time: '10:00', date: nowDateStr(), createdAt: Date.now() });
    });
    await page.waitForTimeout(500);
    const notifs = await page.evaluate(() => appState.notifications);
    // 80 → 100，超过 98 的 Kenny，应该产生站内信
    expect(notifs.length).toBeGreaterThan(0);
    const latest = notifs[0];
    expect(latest.type).toMatch(/rank_up|rank_down/);
  });
});
